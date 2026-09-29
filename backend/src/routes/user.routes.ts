/** Account management (SRS 4.1, REQ-7). */
import { Router } from 'express';
import { toAccountDto } from '../dto';
import { wrap } from '../middleware/errorHandler';
import { requireAuth, userIdOf } from '../middleware/requireAuth';
import * as authService from '../services/auth.service';
import { updateAccountSchema } from '../validation/schemas';

export const userRoutes = Router();

userRoutes.use(requireAuth);

userRoutes.get(
  '/me',
  wrap(async (req, res) => {
    const user = await authService.getUser(userIdOf(req));
    res.json(toAccountDto(user));
  }),
);

// REQ-7: display name and Telegram username only. Email cannot be changed.
userRoutes.patch(
  '/me',
  wrap(async (req, res) => {
    const input = updateAccountSchema.parse(req.body);
    const user = await authService.updateAccount(userIdOf(req), input);
    res.json(toAccountDto(user));
  }),
);
