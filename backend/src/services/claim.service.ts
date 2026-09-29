/**
 * Ownership Claims and contact exchange (SRS 4.6, REQ-60 to REQ-71).
 *
 * The claim state machine:
 *
 *                    submitClaim()
 *      (none) ---------------------------> PENDING
 *                                            |  lost report stays ACTIVE but frozen
 *                                            |  found report stays OPEN  but frozen
 *                        +-------------------+-------------------+
 *              reject()  |                                       |  approve()
 *                        v                                       v
 *                    REJECTED                                APPROVED
 *          reports unfrozen (REQ-68)             lost -> RESOLVED, found -> CLOSED
 *                                                Telegram usernames revealed (REQ-70)
 *
 * Both decisions are final.
 */
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { notifyClaimDecision, notifyClaimSubmitted } from './notification.service';

/**
 * REQ-63: while a claim is Pending, the reports attached to it may not be
 * edited or deleted. The report services call this before every change.
 */
export async function assertNoPendingClaim(target: {
  lostReportId?: string;
  foundReportId?: string;
}) {
  const pending = await prisma.ownershipClaim.findFirst({
    where: { status: 'PENDING', ...target },
  });

  if (pending) {
    throw conflict(
      'This report is part of an ownership claim that is still being reviewed, so it cannot be changed right now.',
    );
  }
}

/** REQ-60 to REQ-62, REQ-64: a Lost Item Owner claims an Open found report. */
export async function submitClaim(
  claimantId: string,
  foundReportId: string,
  lostReportId: string,
) {
  const foundReport = await prisma.foundItemReport.findUnique({
    where: { id: foundReportId },
  });
  if (!foundReport) throw notFound('Found item report not found.');

  // REQ-60: only Open found reports can be claimed.
  if (foundReport.status !== 'OPEN') {
    throw conflict('This item has already been returned to its owner.');
  }

  // You cannot claim an item you reported finding yourself.
  if (foundReport.userId === claimantId) {
    throw badRequest('You cannot claim your own found item report.');
  }

  // REQ-61: the claim must use one of the claimant's own Active lost reports.
  const lostReport = await prisma.lostItemReport.findUnique({ where: { id: lostReportId } });
  if (!lostReport) throw notFound('Lost item report not found.');
  if (lostReport.userId !== claimantId) throw forbidden('That is not your lost item report.');
  if (lostReport.status !== 'ACTIVE') {
    throw conflict('That lost item report has already been resolved.');
  }

  // Only one claim at a time may be pending on either report, otherwise the
  // freeze in REQ-63 would be ambiguous.
  await assertNoPendingClaim({ foundReportId });
  await assertNoPendingClaim({ lostReportId });

  const claim = await prisma.ownershipClaim.create({
    data: { claimantId, foundReportId, lostReportId }, // status defaults to PENDING (REQ-62)
  });

  // REQ-64: let the Finder know there is something to review.
  await notifyClaimSubmitted(foundReport.userId, claim.id);

  return claim;
}

/** Loads a claim with everything the review screen needs. */
export async function getClaim(claimId: string, viewerId: string) {
  const claim = await prisma.ownershipClaim.findUnique({
    where: { id: claimId },
    include: {
      lostReport: { include: { user: true } },
      foundReport: { include: { user: true } },
    },
  });
  if (!claim) throw notFound('Claim not found.');

  const isFinder = claim.foundReport.userId === viewerId;
  const isClaimant = claim.claimantId === viewerId;

  // Only the two people involved may look at a claim at all.
  if (!isFinder && !isClaimant) throw forbidden('You are not part of this claim.');

  return { claim, isFinder };
}

/** Claims waiting for this user to review, as the Finder. */
export function listIncoming(userId: string) {
  return prisma.ownershipClaim.findMany({
    where: { foundReport: { userId } },
    orderBy: { createdAt: 'desc' },
    include: {
      lostReport: { include: { user: true } },
      foundReport: { include: { user: true } },
    },
  });
}

/** Claims this user has submitted, as the Lost Item Owner. */
export function listOutgoing(userId: string) {
  return prisma.ownershipClaim.findMany({
    where: { claimantId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      lostReport: { include: { user: true } },
      foundReport: { include: { user: true } },
    },
  });
}

/** Shared checks before the Finder may decide a claim (REQ-67). */
async function loadPendingClaimForFinder(claimId: string, finderId: string) {
  const claim = await prisma.ownershipClaim.findUnique({
    where: { id: claimId },
    include: { foundReport: true },
  });
  if (!claim) throw notFound('Claim not found.');

  if (claim.foundReport.userId !== finderId) {
    throw forbidden('Only the finder of this item can review this claim.');
  }
  if (claim.status !== 'PENDING') {
    throw conflict('This claim has already been reviewed.');
  }
  return claim;
}

/**
 * REQ-69, REQ-70, REQ-71: approve a claim.
 * The claim, both report statuses and the notification are written together in
 * one transaction, so the system can never end up half-updated.
 */
export async function approveClaim(claimId: string, finderId: string) {
  const claim = await loadPendingClaimForFinder(claimId, finderId);

  await prisma.$transaction([
    prisma.ownershipClaim.update({
      where: { id: claimId },
      data: { status: 'APPROVED', decidedAt: new Date() },
    }),
    // REQ-69: the two reports are closed off automatically.
    prisma.lostItemReport.update({
      where: { id: claim.lostReportId },
      data: { status: 'RESOLVED' },
    }),
    prisma.foundItemReport.update({
      where: { id: claim.foundReportId },
      data: { status: 'CLOSED' },
    }),
  ]);

  // REQ-71: tell the claimant the outcome. From now on both users can see each
  // other's Telegram username (REQ-70, applied in dto/index.ts).
  await notifyClaimDecision(claim.claimantId, claim.id, true);
}

/**
 * REQ-68, REQ-71: reject a claim.
 * The reports keep their existing statuses and simply become editable again,
 * because the freeze in REQ-63 only applies while a claim is Pending.
 */
export async function rejectClaim(claimId: string, finderId: string) {
  const claim = await loadPendingClaimForFinder(claimId, finderId);

  await prisma.ownershipClaim.update({
    where: { id: claimId },
    data: { status: 'REJECTED', decidedAt: new Date() },
  });

  await notifyClaimDecision(claim.claimantId, claim.id, false);
}
