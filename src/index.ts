import { env, isDev } from "./lib/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";

import { requireAdmin, requireUser } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import meRouter from "./routes/me";
import clubsRouter from "./routes/clubs";
import gamesRouter from "./routes/games";
import rewardsRouter from "./routes/rewards";
import coursesRouter from "./routes/courses";
import adminRouter from "./routes/admin";
import { startScheduler } from "./services/rewards";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.frontendUrls.includes("*") || env.frontendUrls.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(morgan(isDev ? "dev" : "combined"));

app.get("/", (_req, res) => {
  res.json({ name: "arcade-api", ok: true });
});
app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use(
  "/api",
  rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }),
);
app.use(clerkMiddleware());

app.use("/api/me", requireUser, meRouter);
app.use("/api/clubs", requireUser, clubsRouter);
app.use("/api/games", requireUser, gamesRouter);
app.use("/api/rewards", requireUser, rewardsRouter);
app.use("/api/courses", requireUser, coursesRouter);
app.use("/api/admin", requireUser, requireAdmin, adminRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`🚀 API ready on http://localhost:${env.port}`);
  startScheduler(env.autoFinalize);
});
