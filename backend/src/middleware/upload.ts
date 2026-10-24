import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { Request, Response, NextFunction } from "express";
import { UPLOAD_DIR } from "../config/env";
import { badRequest } from "../lib/errors";
import { prisma } from "../lib/prisma";
const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("photo");
/** Decode actual image data, strip metadata and save one normalised WebP. Remove failed-request uploads. */
export function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  receive(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next();
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 25000000 });
      const meta = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format ?? ""))
        throw badRequest("Photo must be a valid JPEG, PNG or WebP image.");
      const filename = crypto.randomBytes(16).toString("hex") + ".webp";
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await image
        .rotate()
        .webp({ quality: 85 })
        .toFile(path.join(UPLOAD_DIR, filename));
      req.file.filename = filename;
      res.once("finish", () => {
        if (res.statusCode >= 400)
          void fs
            .unlink(path.join(UPLOAD_DIR, filename))
            .catch(() => undefined);
      });
      next();
    } catch (e) {
      next(
        e instanceof Error && "status" in e
          ? e
          : badRequest(
              "Photo could not be decoded. Use a valid JPEG, PNG or WebP image.",
            ),
      );
    }
  });
}
export function photoUrl(filename: string | null): string | null {
  return filename ? `/uploads/${filename}` : null;
}
/** Delete a replaced file only if no report or retained claim history references it. */
export async function removeUnusedPhoto(filename: string | null) {
  if (!filename) return;
  try {
    const [lost, found] = await Promise.all([
      prisma.lostItemReport.count({ where: { photoPath: filename } }),
      prisma.foundItemReport.count({ where: { photoPath: filename } }),
    ]);
    if (!lost && !found)
      await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => undefined);
  } catch (e) {
    console.error("Could not clean up an unused photo", e);
  }
}
