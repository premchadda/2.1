import rateLimit from "express-rate-limit";
import { isUserAdminRequest } from "./auth.middleware.js";

const RATE_LIMITS = Object.freeze({
  strict: { windowMs: 60 * 1000, max: 5, label: "strict" },
  moderate: { windowMs: 60 * 1000, max: 30, label: "moderate" },
  relaxed: { windowMs: 60 * 1000, max: 60, label: "relaxed" },
  generous: { windowMs: 15 * 60 * 1000, max: 1000, label: "generous" },
});

export const createRateLimiter = (tier = "generous") => {
  const config = RATE_LIMITS[tier] || RATE_LIMITS.generous;
  // Dev multiplier ONLY when NODE_ENV=development (not test/staging/production)
  const isDev = process.env.NODE_ENV === "development";
  return rateLimit({
    windowMs: config.windowMs,
    max: isDev ? config.max * 10 : config.max,
    message: {
      success: false,
      message: `Too many requests (${config.label} limit), please try again later.`,
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip only for verified admin (req.user set by protect) — unverified origin/jwt.decode bypass removed
    skip: (req) =>
      process.env.DISABLE_RATE_LIMITER === "true" || isUserAdminRequest(req),
  });
};

export const RATE_LIMIT_TIERS = Object.keys(RATE_LIMITS).reduce((acc, key) => {
  acc[key] = createRateLimiter(key);
  return acc;
}, {});
