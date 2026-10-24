import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { unauthorized } from "../lib/errors";
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}
export const COOKIE_NAME = "foundit_session";
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const cookie = (req.headers.cookie ?? "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(COOKIE_NAME + "="))
      ?.slice(COOKIE_NAME.length + 1);
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : cookie;
    if (!token) throw unauthorized();
    const id = crypto.createHash("sha256").update(token).digest("hex");
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.expiresAt.getTime() <= Date.now())
      throw unauthorized("Your session has expired. Please log in again.");
    req.userId = session.userId;
    req.sessionId = id;
    next();
  } catch (e) {
    next(e);
  }
}
export function userIdOf(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
