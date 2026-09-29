/**
 * Authentication middleware.
 * Reads the "Authorization: Bearer <token>" header, checks the JWT signature,
 * and attaches the user's id to the request. Every protected route uses this.
 */
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from '../lib/errors';

// Tell TypeScript that requests may carry a userId that we put there.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';

  if (!header.startsWith('Bearer ')) {
    return next(unauthorized());
  }

  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.jwtSecret) as {
      sub: string;
    };
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized('Your session has expired. Please log in again.'));
  }
}

/** Helper for route handlers: the user id, guaranteed to exist after requireAuth. */
export function userIdOf(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
