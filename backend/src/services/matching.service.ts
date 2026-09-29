/**
 * Runs the matching algorithm and decides when to send notifications.
 *
 * The maths itself lives in ../domain/matching.ts. This file only deals with
 * reading reports from the database, saving Match Results, and calling the
 * notification service.
 *
 * When does matching run? (SRS 4.4.2 / REQ-41 to REQ-44, REQ-54)
 *   - a Lost Item Report is created   -> compare with all OPEN found reports
 *   - a Found Item Report is created  -> compare with all ACTIVE lost reports
 *   - either report is edited in a field used by matching -> recompare
 *   - a lost report's threshold changes -> re-check existing scores only
 *
 * Only ACTIVE lost reports and OPEN found reports are ever compared (REQ-44).
 */
import { FoundItemReport, LostItemReport } from '@prisma/client';
import { calculateMatchScore, MatchInput } from '../domain/matching';
import { prisma } from '../lib/prisma';
import { notifyMatchFound } from './notification.service';

/** Pulls out only the fields the algorithm needs. */
function lostToInput(r: LostItemReport): MatchInput {
  return {
    category: r.category,
    colour: r.colour,
    brand: r.brand,
    date: r.dateLost,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

function foundToInput(r: FoundItemReport): MatchInput {
  return {
    category: r.category,
    colour: r.colour,
    brand: r.brand,
    date: r.dateFound,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

/**
 * Scores one pair, saves the result, and sends a notification if it is due.
 *
 * A notification is sent when (REQ-51):
 *   score >= the lost report's threshold, AND
 *   this pair has never triggered a notification before (REQ-52).
 * A score of 0 never notifies, which keeps REQ-47 true even for a threshold of 0.
 */
async function scoreAndSavePair(lost: LostItemReport, found: FoundItemReport) {
  const score = calculateMatchScore(lostToInput(lost), foundToInput(found));

  // Save (or update) the single row for this pair.
  const match = await prisma.matchResult.upsert({
    where: {
      lostReportId_foundReportId: { lostReportId: lost.id, foundReportId: found.id },
    },
    create: { lostReportId: lost.id, foundReportId: found.id, matchScore: score },
    update: { matchScore: score },
  });

  const shouldNotify =
    score > 0 && score >= lost.notificationThreshold && !match.notified;

  if (shouldNotify) {
    await notifyMatchFound(lost.userId, match.id);
    await prisma.matchResult.update({
      where: { id: match.id },
      data: { notified: true },
    });
  }
}

/** REQ-41 / REQ-43: compare one lost report against every OPEN found report. */
export async function matchLostReport(lostReportId: string) {
  const lost = await prisma.lostItemReport.findUnique({ where: { id: lostReportId } });
  if (!lost || lost.status !== 'ACTIVE') return;

  const foundReports = await prisma.foundItemReport.findMany({ where: { status: 'OPEN' } });

  for (const found of foundReports) {
    await scoreAndSavePair(lost, found);
  }
}

/** REQ-42 / REQ-43: compare one found report against every ACTIVE lost report. */
export async function matchFoundReport(foundReportId: string) {
  const found = await prisma.foundItemReport.findUnique({ where: { id: foundReportId } });
  if (!found || found.status !== 'OPEN') return;

  const lostReports = await prisma.lostItemReport.findMany({ where: { status: 'ACTIVE' } });

  for (const lost of lostReports) {
    await scoreAndSavePair(lost, found);
  }
}

/**
 * REQ-54: the threshold changed, so re-check the scores we already have.
 * Nothing is recalculated here - the scores are unchanged, only the decision
 * about whether they are high enough to notify.
 */
export async function reEvaluateThreshold(lostReportId: string) {
  const lost = await prisma.lostItemReport.findUnique({ where: { id: lostReportId } });
  if (!lost || lost.status !== 'ACTIVE') return;

  const matches = await prisma.matchResult.findMany({
    where: { lostReportId, notified: false },
  });

  for (const match of matches) {
    if (match.matchScore > 0 && match.matchScore >= lost.notificationThreshold) {
      await notifyMatchFound(lost.userId, match.id);
      await prisma.matchResult.update({ where: { id: match.id }, data: { notified: true } });
    }
  }
}

/**
 * REQ-53: the list of possible matches for one lost report, best score first.
 * Only matches that actually reached the threshold are shown.
 */
export async function listMatchesForLostReport(lostReportId: string) {
  const lost = await prisma.lostItemReport.findUnique({ where: { id: lostReportId } });
  if (!lost) return [];

  return prisma.matchResult.findMany({
    where: { lostReportId, matchScore: { gte: lost.notificationThreshold, gt: 0 } },
    orderBy: { matchScore: 'desc' },
    include: { foundReport: { include: { user: { select: { displayName: true } } } } },
  });
}

/** True if the given field names include anything the algorithm uses (REQ-43). */
export function affectsMatching(changedFields: string[]): boolean {
  const matchingFields = ['category', 'colour', 'brand', 'dateLost', 'dateFound', 'latitude', 'longitude'];
  return changedFields.some((f) => matchingFields.includes(f));
}
