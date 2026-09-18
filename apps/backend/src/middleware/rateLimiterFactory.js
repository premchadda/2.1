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
    // Admin bypass restored per product requirement (user 17-09: admin not rate-limited).
    // Verified admin (req.user set by protect) skips all tiers; unverified requests still limited.
    // DISABLE_RATE_LIMITER honored only outside production (fail-closed in prod).
    skip: (req) => {
      if (isUserAdminRequest(req)) return true;
      if (process.env.DISABLE_RATE_LIMITER === "true") {
        if (process.env.NODE_ENV === "production") {
          console.warn(
            "[rateLimiter] DISABLE_RATE_LIMITER=true ignored in production",
          );
          return false;
        }
        return true;
      }
      return false;
    },
  });
};

export const RATE_LIMIT_TIERS = Object.keys(RATE_LIMITS).reduce((acc, key) => {
  acc[key] = createRateLimiter(key);
  return acc;
}, {});
