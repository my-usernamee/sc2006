/**
 * Lost Item Reports (SRS 4.2, REQ-9 to REQ-25).
 * After every change that could affect matching, the matching service is asked
 * to recompare this report (REQ-41, REQ-43, REQ-54).
 */
import { forbidden, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { LostReportInput } from '../validation/schemas';
import { assertNoPendingClaim } from './claim.service';
import { affectsMatching, matchLostReport, reEvaluateThreshold } from './matching.service';

/** Loads a report and checks the logged-in user owns it. */
export async function getOwnedReport(reportId: string, userId: string) {
  const report = await prisma.lostItemReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound('Lost item report not found.');
  if (report.userId !== userId) throw forbidden('This is not your report.');
  return report;
}

export function listMyReports(userId: string) {
  return prisma.lostItemReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/** REQ-9, REQ-22, REQ-23: create the report, then look for matches. */
export async function createReport(
  userId: string,
  input: LostReportInput,
  photoFilename: string | null,
) {
  const report = await prisma.lostItemReport.create({
    data: {
      userId,
      itemName: input.itemName,
      category: input.category,
      colour: input.colour,
      brand: input.brand, // null means "Unknown"
      dateLost: input.dateLost,
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      notificationThreshold: input.notificationThreshold,
      privateDescription: input.privateDescription ?? null,
      photoPath: photoFilename,
      // status defaults to ACTIVE (REQ-23)
    },
  });

  // REQ-41: compare the new report against every open found report.
  await matchLostReport(report.id);

  return report;
}

/**
 * REQ-24: edit an Active report, as long as no claim on it is Pending (REQ-63).
 */
export async function updateReport(
  reportId: string,
  userId: string,
  input: LostReportInput,
  photoFilename: string | null,
) {
  const existing = await getOwnedReport(reportId, userId);

  if (existing.status !== 'ACTIVE') {
    throw forbidden('This report has been resolved and can no longer be edited.');
  }
  await assertNoPendingClaim({ lostReportId: reportId });

  const thresholdChanged = existing.notificationThreshold !== input.notificationThreshold;

  // Which matching-relevant fields actually changed? (REQ-43)
  const changedFields: string[] = [];
  if (existing.category !== input.category) changedFields.push('category');
  if (existing.colour !== input.colour) changedFields.push('colour');
  if (existing.brand !== input.brand) changedFields.push('brand');
  if (existing.dateLost.getTime() !== input.dateLost.getTime()) changedFields.push('dateLost');
  if (existing.latitude !== input.latitude) changedFields.push('latitude');
  if (existing.longitude !== input.longitude) changedFields.push('longitude');

  const report = await prisma.lostItemReport.update({
    where: { id: reportId },
    data: {
      itemName: input.itemName,
      category: input.category,
      colour: input.colour,
      brand: input.brand,
      dateLost: input.dateLost,
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      notificationThreshold: input.notificationThreshold,
      privateDescription: input.privateDescription ?? null,
      // Keep the old photo if the user did not upload a new one.
      ...(photoFilename ? { photoPath: photoFilename } : {}),
    },
  });

  if (affectsMatching(changedFields)) {
    // REQ-43: the scores themselves have to be worked out again.
    await matchLostReport(report.id);
  } else if (thresholdChanged) {
    // REQ-54: scores are unchanged, only re-check which ones now qualify.
    await reEvaluateThreshold(report.id);
  }

  return report;
}

/** REQ-25: delete an Active report that has no pending claim. */
export async function deleteReport(reportId: string, userId: string) {
  const existing = await getOwnedReport(reportId, userId);

  if (existing.status !== 'ACTIVE') {
    throw forbidden('This report has been resolved and can no longer be deleted.');
  }
  await assertNoPendingClaim({ lostReportId: reportId });

  // Match results are removed automatically (onDelete: Cascade in the schema).
  await prisma.lostItemReport.delete({ where: { id: reportId } });
}
