/**
 * Creates the in-app notifications described in the SRS. There is no email and
 * no push service - a notification is simply a row in the database that the
 * user sees the next time they open the notifications page.
 */
import { NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma';

/** REQ-51: tell a Lost Item Owner that a possible match was found. */
export function notifyMatchFound(recipientId: string, matchResultId: string) {
  return prisma.notification.create({
    data: { recipientId, type: NotificationType.MATCH_FOUND, matchResultId },
  });
}

/** REQ-64: tell a Finder that someone has claimed their found item. */
export function notifyClaimSubmitted(recipientId: string, claimId: string) {
  return prisma.notification.create({
    data: { recipientId, type: NotificationType.CLAIM_SUBMITTED, claimId },
  });
}

/** REQ-71: tell a Lost Item Owner the outcome of their claim. */
export function notifyClaimDecision(
  recipientId: string,
  claimId: string,
  approved: boolean,
) {
  return prisma.notification.create({
    data: {
      recipientId,
      type: approved ? NotificationType.CLAIM_APPROVED : NotificationType.CLAIM_REJECTED,
      claimId,
    },
  });
}

/** The notification list for one user, newest first. */
export async function listNotifications(userId: string) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      matchResult: { include: { foundReport: true } },
      claim: { include: { foundReport: true, lostReport: true } },
    },
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    createdAt: n.createdAt,
    read: n.readAt !== null,
    // Enough detail for the list; opening one loads the full page.
    matchScore: n.matchResult?.matchScore ?? null,
    foundReportId: n.matchResult?.foundReportId ?? n.claim?.foundReportId ?? null,
    lostReportId: n.claim?.lostReportId ?? null,
    claimId: n.claimId,
    itemName: n.matchResult?.foundReport.itemName ?? n.claim?.foundReport.itemName ?? null,
  }));
}

export function countUnread(userId: string) {
  return prisma.notification.count({ where: { recipientId: userId, readAt: null } });
}

export async function markAsRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId },
    data: { readAt: new Date() },
  });
}
