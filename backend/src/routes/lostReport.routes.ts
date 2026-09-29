/** Lost Item Report routes (SRS 4.2) and the match list (REQ-53). */
import { Router } from 'express';
import { toOwnLostDto, toPublicFoundDto } from '../dto';
import { wrap } from '../middleware/errorHandler';
import { requireAuth, userIdOf } from '../middleware/requireAuth';
import { uploadPhoto } from '../middleware/upload';
import * as lostService from '../services/lostReport.service';
import { listMatchesForLostReport } from '../services/matching.service';
import { lostReportSchema } from '../validation/schemas';

export const lostReportRoutes = Router();

lostReportRoutes.use(requireAuth);

// The user's own lost reports.
lostReportRoutes.get(
  '/mine',
  wrap(async (req, res) => {
    const reports = await lostService.listMyReports(userIdOf(req));
    res.json(reports.map(toOwnLostDto));
  }),
);

// REQ-9 to REQ-23. Sent as multipart because of the optional photo (REQ-17).
lostReportRoutes.post(
  '/',
  uploadPhoto,
  wrap(async (req, res) => {
    const input = lostReportSchema.parse(req.body);
    const report = await lostService.createReport(
      userIdOf(req),
      input,
      req.file?.filename ?? null,
    );
    res.status(201).json(toOwnLostDto(report));
  }),
);

lostReportRoutes.get(
  '/:id',
  wrap(async (req, res) => {
    const report = await lostService.getOwnedReport(req.params.id, userIdOf(req));
    res.json(toOwnLostDto(report));
  }),
);

// REQ-53: the possible matches for this report, best score first.
lostReportRoutes.get(
  '/:id/matches',
  wrap(async (req, res) => {
    await lostService.getOwnedReport(req.params.id, userIdOf(req)); // ownership check
    const matches = await listMatchesForLostReport(req.params.id);

    res.json(
      matches.map((m) => ({
        matchScore: m.matchScore,
        foundReport: toPublicFoundDto(m.foundReport),
      })),
    );
  }),
);

// REQ-24 (and REQ-43 / REQ-54, handled inside the service)
lostReportRoutes.put(
  '/:id',
  uploadPhoto,
  wrap(async (req, res) => {
    const input = lostReportSchema.parse(req.body);
    const report = await lostService.updateReport(
      req.params.id,
      userIdOf(req),
      input,
      req.file?.filename ?? null,
    );
    res.json(toOwnLostDto(report));
  }),
);

// REQ-25
lostReportRoutes.delete(
  '/:id',
  wrap(async (req, res) => {
    await lostService.deleteReport(req.params.id, userIdOf(req));
    res.json({ ok: true });
  }),
);
