/** Ownership claim routes (SRS 4.6). */
import { Router } from 'express';
import { toClaimDto } from '../dto';
import { wrap } from '../middleware/errorHandler';
import { requireAuth, userIdOf } from '../middleware/requireAuth';
import * as claimService from '../services/claim.service';
import { createClaimSchema } from '../validation/schemas';

export const claimRoutes = Router();

claimRoutes.use(requireAuth);

// REQ-60 to REQ-62, REQ-64
claimRoutes.post(
  '/',
  wrap(async (req, res) => {
    const { foundReportId, lostReportId } = createClaimSchema.parse(req.body);
    const claim = await claimService.submitClaim(userIdOf(req), foundReportId, lostReportId);
    res.status(201).json({ id: claim.id, status: claim.status });
  }),
);

/** Claims waiting for me to review, because I found the item. */
claimRoutes.get(
  '/incoming',
  wrap(async (req, res) => {
    const claims = await claimService.listIncoming(userIdOf(req));
    res.json(claims.map((c) => toClaimDto(c, { viewerIsFinder: true })));
  }),
);

/** Claims I have submitted for items I lost. */
claimRoutes.get(
  '/outgoing',
  wrap(async (req, res) => {
    const claims = await claimService.listOutgoing(userIdOf(req));
    res.json(claims.map((c) => toClaimDto(c, { viewerIsFinder: false })));
  }),
);

/**
 * REQ-65, REQ-66, REQ-70: the review screen.
 * toClaimDto adds the two private descriptions only when the viewer is the
 * Finder, and adds the Telegram usernames only once the claim is approved.
 */
claimRoutes.get(
  '/:id',
  wrap(async (req, res) => {
    const { claim, isFinder } = await claimService.getClaim(req.params.id, userIdOf(req));
    res.json(toClaimDto(claim, { viewerIsFinder: isFinder }));
  }),
);

// REQ-67, REQ-69, REQ-70, REQ-71
claimRoutes.post(
  '/:id/approve',
  wrap(async (req, res) => {
    await claimService.approveClaim(req.params.id, userIdOf(req));
    const { claim, isFinder } = await claimService.getClaim(req.params.id, userIdOf(req));
    res.json(toClaimDto(claim, { viewerIsFinder: isFinder }));
  }),
);

// REQ-67, REQ-68, REQ-71
claimRoutes.post(
  '/:id/reject',
  wrap(async (req, res) => {
    await claimService.rejectClaim(req.params.id, userIdOf(req));
    const { claim, isFinder } = await claimService.getClaim(req.params.id, userIdOf(req));
    res.json(toClaimDto(claim, { viewerIsFinder: isFinder }));
  }),
);
