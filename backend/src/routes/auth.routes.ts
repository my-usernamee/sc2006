/** Routes for registering, logging in and out (SRS 4.1). */
import { prisma } from "../lib/prisma";
import { COOKIE_NAME } from "../middleware/requireAuth";
import { Router } from "express";
import { toAccountDto } from "../dto";
import { wrap } from "../middleware/errorHandler";
import { requireAuth, userIdOf } from "../middleware/requireAuth";
import * as authService from "../services/auth.service";
import { loginSchema, registerSchema } from "../validation/schemas";

export const authRoutes = Router();

// REQ-1 to REQ-4
authRoutes.post(
  "/register",
  wrap(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, token } = await authService.register(input);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400000,
    });
    res.status(201).json({ user: toAccountDto(user) });
  }),
);

// REQ-5, REQ-6
authRoutes.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { user, token } = await authService.login(email, password);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400000,
    });
    res.json({ user: toAccountDto(user) });
  }),
);

/** End this session on the server as well as clearing the browser cookie. */
authRoutes.post(
  "/logout",
  requireAuth,
  wrap(async (req, res) => {
    await prisma.session.deleteMany({ where: { id: req.sessionId } });
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.json({ ok: true });
  }),
);

// Used on page load to check the saved token is still valid.
authRoutes.get(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const user = await authService.getUser(userIdOf(req));
    res.json(toAccountDto(user));
  }),
);
