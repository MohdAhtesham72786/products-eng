import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { existsSync } from "node:fs";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRouter, requireSession } from "./auth.js";
import { companiesRouter } from "./routes/companies.js";
import { jobsRouter } from "./routes/jobs.js";
import { settingsRouter } from "./routes/settings.js";
import { actionsRouter } from "./routes/actions.js";
import { outreachRouter } from "./routes/outreach.js";
import { ApiError, errorHandler } from "./errors.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1 FROM migrations LIMIT 1");
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin"),
        site = req.get("sec-fetch-site");
      const allowed = [
        config.APP_ORIGIN,
        ...(!config.production
          ? [
              "http://localhost:5173",
              "http://127.0.0.1:3000",
              "http://127.0.0.1:5173",
            ]
          : []),
      ];
      if (site === "cross-site" || (origin && !allowed.includes(origin)))
        return next(
          new ApiError(
            403,
            "ORIGIN_REJECTED",
            "Request origin is not allowed.",
          ),
        );
      if (config.production && !origin && req.cookies?.sd_session)
        return next(
          new ApiError(
            403,
            "ORIGIN_REQUIRED",
            "Authenticated changes require an Origin header.",
          ),
        );
    }
    next();
  });
  app.use("/api/auth", authRouter);
  app.use("/api", requireSession);
  app.use("/api/companies", companiesRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/actions", actionsRouter);
  app.use("/api", outreachRouter);
  app.use("/api", (_req, res) =>
    res
      .status(404)
      .json({ code: "NOT_FOUND", message: "API endpoint not found." }),
  );
  const publicDir = path.resolve("dist/public");
  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(publicDir, "index.html")),
    );
  }
  app.use(errorHandler);
  return app;
}
