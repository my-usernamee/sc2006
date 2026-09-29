/** In-app notification routes (REQ-51, REQ-53, REQ-64, REQ-71). */
import { Router } from 'express';
import { wrap } from '../middleware/errorHandler';
import { requireAuth, userIdOf } from '../middleware/requireAuth';
import * as notificationService from '../services/notification.service';

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

notificationRoutes.get(
  '/',
  wrap(async (req, res) => {
    res.json(await notificationService.listNotifications(userIdOf(req)));
  }),
);

/** Used for the badge in the navigation bar. */
notificationRoutes.get(
  '/unread-count',
  wrap(async (req, res) => {
    res.json({ count: await notificationService.countUnread(userIdOf(req)) });
  }),
);

notificationRoutes.patch(
  '/:id/read',
  wrap(async (req, res) => {
    await notificationService.markAsRead(userIdOf(req), req.params.id);
    res.json({ ok: true });
  }),
);
