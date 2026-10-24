/**
 * Ownership Claims and contact exchange (SRS 4.6, REQ-61 to REQ-72).
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
 *          reports unfrozen (REQ-69)             lost -> RESOLVED, found -> CLOSED
 *                                                Telegram usernames revealed (REQ-71)
 *
 * Both decisions are final.
 */
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { atomic, Store } from "../lib/transaction";

/**
 * REQ-64: while a claim is Pending, the reports attached to it may not be
 * edited or deleted. The report services call this before every change.
 */
export async function assertNoPendingClaim(
  target: {
    lostReportId?: string;
    foundReportId?: string;
  },
  tx: Store = prisma,
) {
  const pending = await tx.ownershipClaim.findFirst({
    where: { status: "PENDING", ...target },
  });

  if (pending) {
    throw conflict(
      "This report is part of an ownership claim that is still being reviewed, so it cannot be changed right now.",
    );
  }
}

/** Submit and notify in one serializable transaction. */
export async function submitClaim(
  claimantId: string,
  foundReportId: string,
  lostReportId: string,
) {
  return atomic(async (tx) => {
    const found = await tx.foundItemReport.findUnique({
      where: { id: foundReportId },
    });
    const lost = await tx.lostItemReport.findUnique({
      where: { id: lostReportId },
    });
    if (!found || found.deletedAt || !lost || lost.deletedAt)
      throw notFound("Report not found.");
    if (found.status !== "OPEN" || lost.status !== "ACTIVE")
      throw conflict("Both reports must still be Active / Open.");
    if (lost.userId !== claimantId)
      throw forbidden("That is not your lost item report.");
    if (found.userId === claimantId)
      throw badRequest("You cannot claim your own found report.");
    await assertNoPendingClaim({ foundReportId }, tx);
    await assertNoPendingClaim({ lostReportId }, tx);
    const claim = await tx.ownershipClaim.create({
      data: { claimantId, foundReportId, lostReportId },
    });
    await tx.notification.create({
      data: {
        recipientId: found.userId,
        type: "CLAIM_SUBMITTED",
        claimId: claim.id,
      },
    });
    return claim;
  });
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
  if (!claim) throw notFound("Claim not found.");

  const isFinder = claim.foundReport.userId === viewerId;
  const isClaimant = claim.claimantId === viewerId;

  // Only the two people involved may look at a claim at all.
  if (!isFinder && !isClaimant)
    throw forbidden("You are not part of this claim.");

  return { claim, isFinder };
}

/** Claims waiting for this user to review, as the Finder. */
export function listIncoming(userId: string) {
  return prisma.ownershipClaim.findMany({
    where: { foundReport: { userId } },
    orderBy: { createdAt: "desc" },
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
    orderBy: { createdAt: "desc" },
    include: {
      lostReport: { include: { user: true } },
      foundReport: { include: { user: true } },
    },
  });
}

/** Conditional decision and its effects are committed exactly once. */
async function decideClaim(
  claimId: string,
  finderId: string,
  approved: boolean,
) {
  return atomic(async (tx) => {
    const claim = await tx.ownershipClaim.findUnique({
      where: { id: claimId },
      include: { foundReport: true, lostReport: true },
    });
    if (!claim) throw notFound("Claim not found.");
    if (claim.foundReport.userId !== finderId)
      throw forbidden("Only the Finder may review this claim.");
    if (claim.status !== "PENDING")
      throw conflict("This claim has already been reviewed.");
    if (
      claim.foundReport.deletedAt ||
      claim.lostReport.deletedAt ||
      claim.foundReport.status !== "OPEN" ||
      claim.lostReport.status !== "ACTIVE"
    )
      throw conflict("These reports are no longer available.");
    const changed = await tx.ownershipClaim.updateMany({
      where: { id: claimId, status: "PENDING" },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
      },
    });
    if (changed.count !== 1)
      throw conflict("This claim has already been reviewed.");
    if (approved) {
      await tx.lostItemReport.update({
        where: { id: claim.lostReportId },
        data: { status: "RESOLVED" },
      });
      await tx.foundItemReport.update({
        where: { id: claim.foundReportId },
        data: { status: "CLOSED" },
      });
    }
    await tx.notification.create({
      data: {
        recipientId: claim.claimantId,
        claimId,
        type: approved ? "CLAIM_APPROVED" : "CLAIM_REJECTED",
      },
    });
  });
}
export const approveClaim = (id: string, userId: string) =>
  decideClaim(id, userId, true);
export const rejectClaim = (id: string, userId: string) =>
  decideClaim(id, userId, false);
