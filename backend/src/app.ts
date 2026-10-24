import path from "path";
import fs from "fs";
import { prisma } from "./lib/prisma";
import { requireAuth, userIdOf } from "./middleware/requireAuth";
/**
 * Builds the Express application: middleware, then routes, then the error
 * handler last. Kept separate from index.ts so tests can import the app
 * without starting a server.
 */
import cors from "cors";
import express from "express";
import { env, UPLOAD_DIR, BACKEND_ROOT } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRoutes } from "./routes/auth.routes";
import { claimRoutes } from "./routes/claim.routes";
import { foundReportRoutes } from "./routes/foundReport.routes";
import { lostReportRoutes } from "./routes/lostReport.routes";
import { notificationRoutes } from "./routes/notification.routes";
import { oneMapRoutes } from "./routes/onemap.routes";
import { userRoutes } from "./routes/user.routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });

  // Allow the Vite dev server to call this API.
  app.use(cors({ origin: env.corsOrigin }));

  // Same-origin browser writes require a custom header; cross-site forms cannot supply it.
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers["x-requested-with"] !== "FoundIt" ||
        (req.headers.origin && req.headers.origin !== env.corsOrigin))
    )
      return res.status(403).json({ error: "Invalid request origin." });
    next();
  });
  // Parse JSON request bodies. (Report forms are multipart and are parsed by
  // multer inside their own routes instead.)
  app.use(express.json());

  // Authorise photos before serving them; retained claim history stays participant-only.
  app.use(
    "/uploads",
    requireAuth,
    async (req, res, next) => {
      try {
        const filename = path.basename(req.path);
        const found = await prisma.foundItemReport.findFirst({
          where: { photoPath: filename },
        });
        const lost = await prisma.lostItemReport.findFirst({
          where: { photoPath: filename },
        });
        const viewer = userIdOf(req);
        const participant =
          lost &&
          (lost.userId === viewer ||
            (await prisma.ownershipClaim.count({
              where: { lostReportId: lost.id, foundReport: { userId: viewer } },
            })) > 0);
        const foundParticipant =
          found &&
          (!found.deletedAt ||
            found.userId === viewer ||
            (await prisma.ownershipClaim.count({
              where: { foundReportId: found.id, claimantId: viewer },
            })) > 0);
        if (!foundParticipant && !participant)
          return res.status(404).json({ error: "Photo not found." });
        res.setHeader("Cache-Control", "private, no-store");
        next();
      } catch (e) {
        next(e);
      }
    },
    express.static(UPLOAD_DIR),
  );

  // A quick way to check the server is alive.
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/lost-reports", lostReportRoutes);
  app.use("/api/found-reports", foundReportRoutes);
  app.use("/api/claims", claimRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/onemap", oneMapRoutes);

  const web = path.resolve(BACKEND_ROOT, "../frontend/dist");
  if (fs.existsSync(path.join(web, "index.html"))) {
    app.use(express.static(web));
    app.get("*", (req, res, next) =>
      req.path.startsWith("/api/") || req.path.startsWith("/uploads/")
        ? next()
        : res.sendFile(path.join(web, "index.html")),
    );
  }
  // Anything unmatched.
  app.use((_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );

  // Must be registered last: turns thrown errors into JSON responses.
  app.use(errorHandler);

  return app;
}
