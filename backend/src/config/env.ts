/**
 * Reads and checks environment variables once, at start-up.
 * Nothing else in the app is allowed to read process.env directly, so there is
 * a single place to look when something is misconfigured.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy backend/.env.example to backend/.env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  // OneMap is optional: the app still runs without it, you just cannot look up
  // a location name from the map (see services/onemap.service.ts).
  oneMapToken: process.env.ONEMAP_TOKEN ?? '',
  oneMapEmail: process.env.ONEMAP_EMAIL ?? '',
  oneMapPassword: process.env.ONEMAP_PASSWORD ?? '',
};

/** Where uploaded images are written to on disk. */
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
