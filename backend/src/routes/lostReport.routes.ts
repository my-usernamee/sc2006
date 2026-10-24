import { prisma } from "../lib/prisma";
import { notFound, forbidden } from "../lib/errors";
import { reportPermissions } from "../lib/permissions";
import { removeUnusedPhoto } from "../middleware/upload";
/** Lost Item Report routes (SRS 4.2) and the match list (REQ-53). */
import { Router } from "express";
import { toOwnLostDto, toPublicFoundDto } from "../dto";
import { wrap } from "../middleware/errorHandler";
import { requireAuth, userIdOf } from "../middleware/requireAuth";
import { uploadPhoto } from "../middleware/upload";
import * as lostService from "../services/lostReport.service";
import { listMatchesForLostReport } from "../services/matching.service";
import { lostReportSchema } from "../validation/schemas";

export const lostReportRoutes = Router();

lostReportRoutes.use(requireAuth);

// The user's own lost reports.
lostReportRoutes.get(
  "/mine",
  wrap(async (req, res) => {
    const reports = await lostService.listMyReports(userIdOf(req));
    res.json(
      await Promise.all(
        reports.map(async (report) => ({
          ...toOwnLostDto(report),
          ...(await reportPermissions(report, userIdOf(req), "lost")),
        })),
      ),
    );
  }),
);

// REQ-9 to REQ-23. Sent as multipart because of the optional photo (REQ-17).
lostReportRoutes.post(
  "/",
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
  "/:id",
  wrap(async (req, res) => {
    const report = await lostService.getOwnedReport(
      req.params.id,
      userIdOf(req),
    );
    res.json({
      ...toOwnLostDto(report),
      ...(await reportPermissions(report, userIdOf(req), "lost")),
    });
  }),
);

// REQ-53: the possible matches for this report, best score first.
lostReportRoutes.get(
  "/:id/matches",
  wrap(async (req, res) => {
    await lostService.getOwnedReport(req.params.id, userIdOf(req)); // ownership check
    const matches = await listMatchesForLostReport(req.params.id);

    res.json(
      matches.map((m) => ({
        id: m.id,
        lostReportId: m.lostReportId,
        matchScore: m.matchScore,
        foundReport: toPublicFoundDto(m.foundReport),
      })),
    );
  }),
);

// REQ-24 (and REQ-43 / REQ-54, handled inside the service)
lostReportRoutes.put(
  "/:id",
  (req, _res, next) => {
    lostService
      .getOwnedReport(req.params.id, userIdOf(req))
      .then(() => next())
      .catch(next);
  },
  uploadPhoto,
  wrap(async (req, res) => {
    const input = lostReportSchema.parse(req.body);
    const old = await lostService.getOwnedReport(req.params.id, userIdOf(req));
    const report = await lostService.updateReport(
      req.params.id,
      userIdOf(req),
      input,
      req.file?.filename ?? null,
    );
    if (req.file) await removeUnusedPhoto(old.photoPath);
    res.json({
      ...toOwnLostDto(report),
      ...(await reportPermissions(report, userIdOf(req), "lost")),
    });
  }),
);

// REQ-25
lostReportRoutes.delete(
  "/:id",
  wrap(async (req, res) => {
    const old = await lostService.getOwnedReport(req.params.id, userIdOf(req));
    await lostService.deleteReport(req.params.id, userIdOf(req));
    await removeUnusedPhoto(old.photoPath);
    res.json({ ok: true });
  }),
);

lostReportRoutes.get(
  "/:id/matches/:matchId",
  wrap(async (req, res) => {
    const match = await prisma.matchResult.findUnique({
      where: { id: req.params.matchId },
      include: {
        lostReport: true,
        foundReport: { include: { user: { select: { displayName: true } } } },
      },
    });
    if (!match || match.lostReportId !== req.params.id)
      throw notFound("Match not found.");
    if (match.lostReport.userId !== userIdOf(req))
      throw forbidden("This is not your match.");
    const available =
      !match.lostReport.deletedAt &&
      !match.foundReport.deletedAt &&
      match.lostReport.status === "ACTIVE" &&
      match.foundReport.status === "OPEN" &&
      match.eligible;
    res.json({
      id: match.id,
      matchScore: match.matchScore,
      lostReportId: match.lostReportId,
      lostItemName: match.lostReport.itemName,
      available,
      foundReport: {
        ...toPublicFoundDto(match.foundReport),
        ...(await reportPermissions(match.foundReport, userIdOf(req), "found")),
      },
    });
  }),
);
