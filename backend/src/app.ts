/**
 * Builds the Express application: middleware, then routes, then the error
 * handler last. Kept separate from index.ts so tests can import the app
 * without starting a server.
 */
import cors from 'cors';
import express from 'express';
import { env, UPLOAD_DIR } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth.routes';
import { claimRoutes } from './routes/claim.routes';
import { foundReportRoutes } from './routes/foundReport.routes';
import { lostReportRoutes } from './routes/lostReport.routes';
import { notificationRoutes } from './routes/notification.routes';
import { oneMapRoutes } from './routes/onemap.routes';
import { userRoutes } from './routes/user.routes';

export function createApp() {
  const app = express();

  // Allow the Vite dev server to call this API.
  app.use(cors({ origin: env.corsOrigin }));

  // Parse JSON request bodies. (Report forms are multipart and are parsed by
  // multer inside their own routes instead.)
  app.use(express.json());

  // Uploaded photos are served as plain static files.
  app.use('/uploads', express.static(UPLOAD_DIR));

  // A quick way to check the server is alive.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/lost-reports', lostReportRoutes);
  app.use('/api/found-reports', foundReportRoutes);
  app.use('/api/claims', claimRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/onemap', oneMapRoutes);

  // Anything unmatched.
  app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

  // Must be registered last: turns thrown errors into JSON responses.
  app.use(errorHandler);

  return app;
}
