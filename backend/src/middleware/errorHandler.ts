/**
 * The last middleware in the chain. Anything a route throws ends up here and
 * is turned into a JSON response of the shape { error: "message" }.
 */
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Our own, deliberately thrown errors.
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Validation errors: report the first problem in plain language.
  if (err instanceof ZodError) {
    const first = err.errors[0];
    const field = first.path.join('.');
    return res.status(400).json({ error: field ? `${field}: ${first.message}` : first.message });
  }

  // File upload problems (too large, wrong field name, ...).
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 5 MB or smaller.' : 'Photo upload failed.';
    return res.status(400).json({ error: message });
  }

  // Anything else is a bug: log it, but do not leak details to the user.
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
}

/** Wraps an async route handler so thrown errors reach errorHandler. */
export function wrap(
  handler: (req: Request, res: Response) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
