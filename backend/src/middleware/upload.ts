/**
 * Image upload handling (REQ-17 for lost reports, REQ-30 for found reports).
 * Files are saved to backend/uploads with a random filename and served as
 * static files from /uploads. One image per report, 5 MB maximum.
 */
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { UPLOAD_DIR } from '../config/env';
import { badRequest } from '../lib/errors';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // A random name so photo URLs cannot be guessed by other users.
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, randomName + path.extname(file.originalname).toLowerCase());
  },
});

export const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(badRequest('Photo must be a JPEG, PNG or WebP image.'));
    }
    cb(null, true);
  },
}).single('photo');

/** Turns a stored filename into the URL path the frontend uses. */
export function photoUrl(filename: string | null): string | null {
  return filename ? `/uploads/${filename}` : null;
}
