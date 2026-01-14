import { Request, Response, NextFunction } from "express";
import { incrementRedisKey } from "../services/redis";

// Rate limits - can be overridden via env vars for testing
// High defaults for load testing, use strict values in production via env vars
const RATE_LIMITS: Record<string, { max: number; window: number }> = {
  "/api/login": { max: parseInt(process.env.RATE_LIMIT_LOGIN || "5000"), window: 900 },
  "/api/register": { max: parseInt(process.env.RATE_LIMIT_REGISTER || "5000"), window: 3600 },
  "/api/telegramAuth": { max: parseInt(process.env.RATE_LIMIT_TG || "500"), window: 3600 },
  "/api/deposit": { max: parseInt(process.env.RATE_LIMIT_DEPOSIT || "1000"), window: 60 },
  "/api/withdraw": { max: parseInt(process.env.RATE_LIMIT_WITHDRAW || "500"), window: 300 },
};

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const path = req.path;
  const limit = RATE_LIMITS[path];
  
  if (!limit) {
    return next();
  }

  const key = `rate_limit:${path}:${req.ip}`;
  const count = await incrementRedisKey(key, limit.window);

  if (count > limit.max) {
    return res.status(429).json({ error: "Too many requests" });
  }

  res.setHeader("X-RateLimit-Limit", limit.max.toString());
  res.setHeader("X-RateLimit-Remaining", Math.max(0, limit.max - count).toString());
  
  next();
}
