/** Found Item Report routes (SRS 4.3) and browsing/searching (SRS 4.5). */
import { Router } from 'express';
import { toOwnFoundDto, toPublicFoundDto } from '../dto';
import { wrap } from '../middleware/errorHandler';
import { requireAuth, userIdOf } from '../middleware/requireAuth';
import { uploadPhoto } from '../middleware/upload';
import * as foundService from '../services/foundReport.service';
import { browseQuerySchema, foundReportSchema } from '../validation/schemas';

export const foundReportRoutes = Router();

// REQ-55: browsing requires being logged in.
foundReportRoutes.use(requireAuth);

/**
 * REQ-55 to REQ-59: browse Open found reports with optional search and filters.
 * toPublicFoundDto strips the Telegram username and private description (REQ-59).
 */
foundReportRoutes.get(
  '/',
  wrap(async (req, res) => {
    const filters = browseQuerySchema.parse(req.query);
    const { reports, total, page, pageSize } = await foundService.browse(filters);

    res.json({
      reports: reports.map(toPublicFoundDto),
      total,
      page,
      pageSize,
    });
  }),
);

// The user's own found reports (they may see their own private description).
foundReportRoutes.get(
  '/mine',
  wrap(async (req, res) => {
    const reports = await foundService.listMyReports(userIdOf(req));
    res.json(reports.map(toOwnFoundDto));
  }),
);

// REQ-26 to REQ-38. The photo is required (REQ-30), checked in the service.
foundReportRoutes.post(
  '/',
  uploadPhoto,
  wrap(async (req, res) => {
    const input = foundReportSchema.parse(req.body);
    const report = await foundService.createReport(
      userIdOf(req),
      input,
      req.file?.filename ?? null,
    );
    res.status(201).json(toOwnFoundDto(report));
  }),
);

foundReportRoutes.get(
  '/:id',
  wrap(async (req, res) => {
    const report = await foundService.getReport(req.params.id);

    // The owner sees their own private description; everyone else does not.
    const isOwner = report.userId === userIdOf(req);
    res.json(isOwner ? toOwnFoundDto(report) : toPublicFoundDto(report));
  }),
);

// REQ-39
foundReportRoutes.put(
  '/:id',
  uploadPhoto,
  wrap(async (req, res) => {
    const input = foundReportSchema.parse(req.body);
    const report = await foundService.updateReport(
      req.params.id,
      userIdOf(req),
      input,
      req.file?.filename ?? null,
    );
    res.json(toOwnFoundDto(report));
  }),
);

// REQ-40
foundReportRoutes.delete(
  '/:id',
  wrap(async (req, res) => {
    await foundService.deleteReport(req.params.id, userIdOf(req));
    res.json({ ok: true });
  }),
);
