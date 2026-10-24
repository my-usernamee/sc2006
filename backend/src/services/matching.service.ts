import { Prisma } from "@prisma/client";
import crypto from "crypto";
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
import { FoundItemReport, LostItemReport } from "@prisma/client";
import { calculateMatchScore, MatchInput } from "../domain/matching";
import { prisma } from "../lib/prisma";
import { atomic, Store } from "../lib/transaction";

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
 * Hard-rejected pairs never notify. An eligible pair rounded to zero can meet threshold zero.
 */
/** Batch persistence avoids one database round trip per report pair. */
async function scorePairs(
  pairs: Array<{ lost: LostItemReport; found: FoundItemReport }>,
  tx: Store,
) {
  for (let offset = 0; offset < pairs.length; offset += 300) {
    const batch = pairs.slice(offset, offset + 300);
    if (!batch.length) continue;
    const now = new Date();
    const values = batch.map(
      ({ lost, found }) =>
        Prisma.sql`(${crypto.randomUUID()},${lost.id},${found.id},${calculateMatchScore(lostToInput(lost), foundToInput(found))},${found.dateFound.getTime() >= lost.dateLost.getTime() && found.category === lost.category},false,${now},${now})`,
    );
    await tx.$executeRaw(
      Prisma.sql`INSERT INTO "MatchResult" (id,"lostReportId","foundReportId","matchScore",eligible,notified,"createdAt","updatedAt") VALUES ${Prisma.join(values)} ON CONFLICT ("lostReportId","foundReportId") DO UPDATE SET "matchScore"=EXCLUDED."matchScore",eligible=EXCLUDED.eligible,"updatedAt"=EXCLUDED."updatedAt"`,
    );
    const candidates = await tx.matchResult.findMany({
      where: {
        OR: batch.map(({ lost, found }) => ({
          lostReportId: lost.id,
          foundReportId: found.id,
        })),
        notified: false,
        eligible: true,
      },
      include: { lostReport: true },
    });
    const due = candidates.filter(
      (m) => m.matchScore >= m.lostReport.notificationThreshold,
    );
    if (due.length) {
      await tx.notification.createMany({
        data: due.map((m) => ({
          recipientId: m.lostReport.userId,
          type: "MATCH_FOUND" as const,
          matchResultId: m.id,
        })),
        skipDuplicates: true,
      });
      await tx.matchResult.updateMany({
        where: { id: { in: due.map((m) => m.id) } },
        data: { notified: true },
      });
    }
  }
}

/** REQ-41 / REQ-43: compare one lost report against every OPEN found report. */
async function matchLostReportIn(lostReportId: string, tx: Store) {
  const lost = await tx.lostItemReport.findUnique({
    where: { id: lostReportId },
  });
  if (!lost || lost.status !== "ACTIVE" || lost.deletedAt) return;

  const foundReports = await tx.foundItemReport.findMany({
    where: { status: "OPEN", deletedAt: null },
  });

  await scorePairs(
    foundReports.map((found) => ({ lost, found })),
    tx,
  );
}

/** REQ-42 / REQ-43: compare one found report against every ACTIVE lost report. */
async function matchFoundReportIn(foundReportId: string, tx: Store) {
  const found = await tx.foundItemReport.findUnique({
    where: { id: foundReportId },
  });
  if (!found || found.status !== "OPEN" || found.deletedAt) return;

  const lostReports = await tx.lostItemReport.findMany({
    where: { status: "ACTIVE", deletedAt: null },
  });

  await scorePairs(
    lostReports.map((lost) => ({ lost, found })),
    tx,
  );
}

/**
 * REQ-54: the threshold changed, so re-check the scores we already have.
 * Nothing is recalculated here - the scores are unchanged, only the decision
 * about whether they are high enough to notify.
 */
async function reEvaluateThresholdIn(lostReportId: string, tx: Store) {
  const lost = await tx.lostItemReport.findUnique({
    where: { id: lostReportId },
  });
  if (!lost || lost.status !== "ACTIVE" || lost.deletedAt) return;

  const matches = await tx.matchResult.findMany({
    where: {
      lostReportId,
      notified: false,
      eligible: true,
      foundReport: { status: "OPEN", deletedAt: null },
    },
  });

  const due = matches.filter((m) => m.matchScore >= lost.notificationThreshold);
  if (due.length) {
    await tx.notification.createMany({
      data: due.map((m) => ({
        recipientId: lost.userId,
        type: "MATCH_FOUND" as const,
        matchResultId: m.id,
      })),
      skipDuplicates: true,
    });
    await tx.matchResult.updateMany({
      where: { id: { in: due.map((m) => m.id) } },
      data: { notified: true },
    });
  }
}

/**
 * REQ-53: the list of possible matches for one lost report, best score first.
 * Only matches that actually reached the threshold are shown.
 */
export async function listMatchesForLostReport(
  lostReportId: string,
  tx: Store = prisma,
) {
  const lost = await tx.lostItemReport.findUnique({
    where: { id: lostReportId },
  });
  if (!lost || lost.deletedAt || lost.status !== "ACTIVE") return [];

  return tx.matchResult.findMany({
    where: {
      lostReportId,
      eligible: true,
      foundReport: { status: "OPEN", deletedAt: null },
      matchScore: { gte: lost.notificationThreshold },
    },
    orderBy: { matchScore: "desc" },
    include: {
      foundReport: { include: { user: { select: { displayName: true } } } },
    },
  });
}

/** True if the given field names include anything the algorithm uses (REQ-43). */
export function affectsMatching(changedFields: string[]): boolean {
  const matchingFields = [
    "category",
    "colour",
    "brand",
    "dateLost",
    "dateFound",
    "latitude",
    "longitude",
  ];
  return changedFields.some((f) => matchingFields.includes(f));
}

export const matchLostReport = (id: string, tx?: Store) =>
  tx ? matchLostReportIn(id, tx) : atomic((t) => matchLostReportIn(id, t));
export const matchFoundReport = (id: string, tx?: Store) =>
  tx ? matchFoundReportIn(id, tx) : atomic((t) => matchFoundReportIn(id, t));
export const reEvaluateThreshold = (id: string, tx?: Store) =>
  tx
    ? reEvaluateThresholdIn(id, tx)
    : atomic((t) => reEvaluateThresholdIn(id, t));
