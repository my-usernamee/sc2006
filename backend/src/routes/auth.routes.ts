/** Routes for registering, logging in and out (SRS 4.1). */
import { Router } from 'express';
import { toAccountDto } from '../dto';
import { wrap } from '../middleware/errorHandler';
import { requireAuth, userIdOf } from '../middleware/requireAuth';
import * as authService from '../services/auth.service';
import { loginSchema, registerSchema } from '../validation/schemas';

export const authRoutes = Router();

// REQ-1 to REQ-4
authRoutes.post(
  '/register',
  wrap(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, token } = await authService.register(input);
    res.status(201).json({ token, user: toAccountDto(user) });
  }),
);

// REQ-5, REQ-6
authRoutes.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { user, token } = await authService.login(email, password);
    res.json({ token, user: toAccountDto(user) });
  }),
);

// REQ-8. The token is stateless, so logging out just means the frontend throws
// it away. This endpoint exists so the action is explicit in the API.
authRoutes.post('/logout', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

// Used on page load to check the saved token is still valid.
authRoutes.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const user = await authService.getUser(userIdOf(req));
    res.json(toAccountDto(user));
  }),
);
