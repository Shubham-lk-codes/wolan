import compression from "compression";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import {
  errorHandler,
  notFound,
  requestContext,
  sanitizeRequest,
} from "@wolan/shared/middleware";
import { env } from "./config/env.js";
import { driverRouter } from "./routes/index.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    requestContext,
    helmet(),
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) callback(null, true);
        else callback(new Error("Origin not allowed by CORS"));
      },
    }),
    compression(),
    express.json({ limit: "1mb" }),
    sanitizeRequest,
  );
  if (!env.isTest) app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.get("/api/v1/driver/health", (_request, response) =>
    response.json({
      success: true,
      data: {
        service: "wolan-driver-api",
        database:
          mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      },
    }),
  );
  app.use(
    "/api/v1/driver",
    rateLimit({ windowMs: 60_000, limit: 300 }),
    driverRouter,
  );
  app.use(notFound, errorHandler);
  return app;
}
export default createApp();
