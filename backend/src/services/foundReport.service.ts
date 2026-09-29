/**
 * Found Item Reports (SRS 4.3, REQ-26 to REQ-40) and browsing (SRS 4.5).
 */
import { Prisma } from '@prisma/client';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { FoundReportInput } from '../validation/schemas';
import { assertNoPendingClaim } from './claim.service';
import { affectsMatching, matchFoundReport } from './matching.service';

const PAGE_SIZE = 12;

export async function getOwnedReport(reportId: string, userId: string) {
  const report = await prisma.foundItemReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound('Found item report not found.');
  if (report.userId !== userId) throw forbidden('This is not your report.');
  return report;
}

export async function getReport(reportId: string) {
  const report = await prisma.foundItemReport.findUnique({
    where: { id: reportId },
    include: { user: { select: { displayName: true } } },
  });
  if (!report) throw notFound('Found item report not found.');
  return report;
}

export function listMyReports(userId: string) {
  return prisma.foundItemReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * REQ-55 to REQ-58: browse Open found reports, optionally searching by item
 * name and filtering by category and colour.
 */
export async function browse(filters: {
  q?: string;
  category?: string;
  colour?: string;
  page: number;
}) {
  const where: Prisma.FoundItemReportWhereInput = {
    status: 'OPEN', // REQ-55: only Open reports are browsable
    ...(filters.q
      ? { itemName: { contains: filters.q, mode: 'insensitive' } } // REQ-57
      : {}),
    ...(filters.category ? { category: filters.category as never } : {}), // REQ-58
    ...(filters.colour ? { colour: filters.colour as never } : {}), // REQ-58
  };

  const [reports, total] = await Promise.all([
    prisma.foundItemReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { displayName: true } } },
    }),
    prisma.foundItemReport.count({ where }),
  ]);

  return { reports, total, page: filters.page, pageSize: PAGE_SIZE };
}

/** REQ-26, REQ-30, REQ-37, REQ-38: create the report, then look for matches. */
export async function createReport(
  userId: string,
  input: FoundReportInput,
  photoFilename: string | null,
) {
  // REQ-27 / REQ-30: unlike a lost report, the photo is compulsory here.
  if (!photoFilename) {
    throw badRequest('A photograph of the found item is required.');
  }

  const report = await prisma.foundItemReport.create({
    data: {
      userId,
      itemName: input.itemName,
      category: input.category,
      colour: input.colour,
      brand: input.brand,
      dateFound: input.dateFound,
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      privateDescription: input.privateDescription ?? null,
      photoPath: photoFilename,
      // status defaults to OPEN (REQ-38)
    },
  });

  // REQ-42: compare the new report against every active lost report.
  await matchFoundReport(report.id);

  return report;
}

/** REQ-39: edit an Open report, as long as no claim on it is Pending (REQ-63). */
export async function updateReport(
  reportId: string,
  userId: string,
  input: FoundReportInput,
  photoFilename: string | null,
) {
  const existing = await getOwnedReport(reportId, userId);

  if (existing.status !== 'OPEN') {
    throw forbidden('This report has been closed and can no longer be edited.');
  }
  await assertNoPendingClaim({ foundReportId: reportId });

  const changedFields: string[] = [];
  if (existing.category !== input.category) changedFields.push('category');
  if (existing.colour !== input.colour) changedFields.push('colour');
  if (existing.brand !== input.brand) changedFields.push('brand');
  if (existing.dateFound.getTime() !== input.dateFound.getTime()) changedFields.push('dateFound');
  if (existing.latitude !== input.latitude) changedFields.push('latitude');
  if (existing.longitude !== input.longitude) changedFields.push('longitude');

  const report = await prisma.foundItemReport.update({
    where: { id: reportId },
    data: {
      itemName: input.itemName,
      category: input.category,
      colour: input.colour,
      brand: input.brand,
      dateFound: input.dateFound,
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      privateDescription: input.privateDescription ?? null,
      ...(photoFilename ? { photoPath: photoFilename } : {}),
    },
  });

  // REQ-43: recompare if anything the algorithm uses has changed.
  if (affectsMatching(changedFields)) {
    await matchFoundReport(report.id);
  }

  return report;
}

/** REQ-40: delete an Open report that has no pending claim. */
export async function deleteReport(reportId: string, userId: string) {
  const existing = await getOwnedReport(reportId, userId);

  if (existing.status !== 'OPEN') {
    throw forbidden('This report has been closed and can no longer be deleted.');
  }
  await assertNoPendingClaim({ foundReportId: reportId });

  await prisma.foundItemReport.delete({ where: { id: reportId } });
}
