import { dbHelpers } from "../infrastructure/database/postgres-helpers.js";
import { logAuditEvent } from "./audit.middleware.js";
import logger from "../infrastructure/logger/logger.js";
import { getRuntimeSecuritySettings } from "../services/SettingsService.js";
import { isUserAdminRequest } from "./auth.middleware.js";

export const LOCKOUT_CONFIG = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  WINDOW_MINUTES: 30,
  PROGRESSIVE_LOCKOUT: true,
  PROGRESSIVE_FACTORS: [
    { attempts: 3, lockoutMinutes: 5 },
    { attempts: 5, lockoutMinutes: 15 },
    { attempts: 10, lockoutMinutes: 60 },
    { attempts: 20, lockoutMinutes: 1440 },
  ],
};

const getClientIp = (req) => {
  if (req?.ip) {
    let ip = String(req.ip).trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (ip === "::1") return "127.0.0.1";
    if (ip) return ip;
  }
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    const first = String(forwardedFor).split(",")[0].trim();
    if (first.startsWith("::ffff:")) return first.slice(7);
    return first;
  }
  const sock = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (sock) {
    if (sock.startsWith("::ffff:")) return sock.slice(7);
    if (sock === "::1") return "127.0.0.1";
    return sock;
  }
  return "unknown";
};

export const checkAccountLockout = async (email, ipAddress) => {
  const securitySettings = await getRuntimeSecuritySettings();
  const maxAttempts = Math.max(
    1,
    securitySettings.maxLoginAttempts || LOCKOUT_CONFIG.MAX_ATTEMPTS,
  );
  const lockoutWindow = new Date(
    Date.now() - LOCKOUT_CONFIG.WINDOW_MINUTES * 60 * 1000,
  );

  const attempts = await dbHelpers.pool.query(
    `SELECT COUNT(*) as attempt_count
     FROM login_attempts
     WHERE (email = $1 OR ip_address = $2)
       AND attempted_at > $3
       AND successful = false`,
    [email.toLowerCase(), ipAddress, lockoutWindow],
  );

  const attemptCount = parseInt(attempts.rows[0]?.attempt_count || 0);

  if (attemptCount === 0) {
    return { locked: false, attemptCount, lockoutMinutes: 0 };
  }

  let lockoutMinutes = 0;

  // Respect admin-configured maxLoginAttempts as the minimum threshold.
  // Previously progressive factors locked at 3 attempts even if admin set
  // maxLoginAttempts=10, making the toggle effectively useless.
  if (attemptCount < maxAttempts) {
    // Not yet at threshold — no lockout regardless of progressive factors.
    lockoutMinutes = 0;
  } else if (LOCKOUT_CONFIG.PROGRESSIVE_LOCKOUT) {
    for (const factor of LOCKOUT_CONFIG.PROGRESSIVE_FACTORS) {
      // Factor only applies if its threshold is >= admin maxAttempts, or
      // attemptCount already exceeds both.
      // We treat maxAttempts as overriding any lower factor threshold.
      const effectiveAttempts = Math.max(factor.attempts, maxAttempts);
      if (attemptCount >= effectiveAttempts) {
        lockoutMinutes = factor.lockoutMinutes;
      }
    }
    // Fallback: if no progressive factor matched but we are at/above maxAttempts,
    // apply base duration so the toggle still enforces *some* lockout.
    if (lockoutMinutes === 0) {
      lockoutMinutes = LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES;
    }
  } else if (attemptCount >= maxAttempts) {
    lockoutMinutes = LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES;
  }

  if (lockoutMinutes === 0) {
    return { locked: false, attemptCount, lockoutMinutes: 0 };
  }

  const recentFailedAttempts = await dbHelpers.pool.query(
    `SELECT attempted_at
     FROM login_attempts
     WHERE (email = $1 OR ip_address = $2)
       AND successful = false
     ORDER BY attempted_at DESC
     LIMIT 1`,
    [email.toLowerCase(), ipAddress],
  );

  if (recentFailedAttempts.rows.length > 0) {
    const lastAttempt = new Date(recentFailedAttempts.rows[0].attempted_at);
    const lockoutEnd = new Date(
      lastAttempt.getTime() + lockoutMinutes * 60 * 1000,
    );
    const now = new Date();

    if (now < lockoutEnd) {
      const remainingSeconds = Math.ceil((lockoutEnd - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return {
        locked: true,
        attemptCount,
        lockoutMinutes: remainingMinutes,
        lockoutExpires: lockoutEnd.toISOString(),
      };
    }
  }

  return { locked: false, attemptCount, lockoutMinutes: 0 };
};

export const recordLoginAttempt = async (
  email,
  ipAddress,
  successful,
  userAgent,
) => {
  try {
    await dbHelpers.pool.query(
      `INSERT INTO login_attempts (email, ip_address, successful, attempted_at)
       VALUES ($1, $2, $3, NOW())`,
      [email.toLowerCase(), ipAddress, successful],
    );

    if (process.env.NODE_ENV !== "production") {
      logger.info(
        { email, ipAddress, successful },
        `[Login Attempt] ${successful ? "SUCCESS" : "FAILED"}`,
      );
    }
  } catch (error) {
    logger.error(
      { err: error, email, ipAddress },
      "[Login Attempt] Failed to record attempt",
    );
  }
};

// Covers login, password reset, OTP, and 2FA verification endpoints.
// Each endpoint records login_attempts so progressive lockout applies across
// all of them.
const LOCKOUT_PATHS = [
  "/login",
  "/reset-password",
  "/verify-otp",
  "/forgot-password",
  "/2fa/verify",
  "/2fa/enroll",
  "/login/2fa",
];
const isLockoutPath = (path) => {
  if (!path) return false;
  if (path === "/login" || path.endsWith("/auth/login")) return true;
  if (path === "/reset-password" || path.endsWith("/auth/reset-password"))
    return true;
  if (path === "/verify-otp" || path.endsWith("/auth/verify-otp")) return true;
  if (path === "/forgot-password" || path.endsWith("/auth/forgot-password"))
    return true;
  if (
    path === "/2fa/verify" ||
    path.endsWith("/auth/2fa/verify") ||
    path.endsWith("/2fa/verify")
  )
    return true;
  if (
    path === "/2fa/enroll" ||
    path.endsWith("/auth/2fa/enroll") ||
    path.endsWith("/2fa/enroll")
  )
    return true;
  if (
    path === "/login/2fa" ||
    path.endsWith("/auth/login/2fa") ||
    path.endsWith("/login/2fa")
  )
    return true;
  return LOCKOUT_PATHS.some((p) => path === p || path.endsWith(p));
};

export const lockoutMiddleware = async (req, res, next) => {
  // Never lock out admin requests
  if (isUserAdminRequest(req)) {
    return next();
  }

  // Apply brute-force protection to login, password reset, OTP, and 2FA verification
  if (!isLockoutPath(req.path)) {
    return next();
  }

  // Check body.email first, fall back to body.identifier, then authenticated req.user.email
  const email = req.body?.email || req.body?.identifier || req.user?.email;

  const ipAddress = getClientIp(req);

  if (!email) {
    // Still enforce IP-only lockout for forgot-password when email is absent
    const ipLockout = await checkAccountLockout("", ipAddress);
    if (ipLockout.locked) {
      return res.status(429).json({
        success: false,
        message: `Too many attempts from this IP. Please try again in ${ipLockout.lockoutMinutes} minutes.`,
        code: "ACCOUNT_LOCKED",
        retryAfter: ipLockout.lockoutMinutes * 60,
      });
    }
    return next();
  }
  const lockoutStatus = await checkAccountLockout(email, ipAddress);

  if (lockoutStatus.locked) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn(
        `[Lockout] Account locked for ${email} from IP ${ipAddress}. ` +
          `Attempts: ${lockoutStatus.attemptCount}, Remaining: ${lockoutStatus.lockoutMinutes} minutes`,
      );
    }

    // LOW-04 FIX: Use standardized logAuditEvent instead of raw insertOne
    await logAuditEvent({
      action: "login_lockout",
      resource: "auth",
      adminEmail: email.toLowerCase(),
      ipAddress,
      userAgent: req.headers["user-agent"],
      details: {
        attemptCount: lockoutStatus.attemptCount,
        lockoutMinutes: lockoutStatus.lockoutMinutes,
        lockoutExpires: lockoutStatus.lockoutExpires,
      },
      status: "blocked",
      requestMethod: req.method,
      requestPath: req.originalUrl,
    });

    return res.status(429).json({
      success: false,
      message: `Account temporarily locked due to too many failed attempts. Please try again in ${lockoutStatus.lockoutMinutes} minutes.`,
      code: "ACCOUNT_LOCKED",
      retryAfter: lockoutStatus.lockoutMinutes * 60,
    });
  }

  // Use response finish event to record successful login attempts.
  // NOTE: auth.controller.js also records successful logins directly in its
  // handler; when it does, it sets res.locals.loginAttemptRecorded = true so
  // this finish handler skips the duplicate insert (was double-logging every
  // successful login).
  res.on("finish", () => {
    // Check if response indicates successful login (2xx status with success: true)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Only record if this was a login attempt (email present in request)
      if (email && !res.locals.loginAttemptRecorded) {
        recordLoginAttempt(email, ipAddress, true, req.headers["user-agent"]);
      }
    }
  });

  next();
};

export const clearLoginAttempts = async (email) => {
  try {
    await dbHelpers.pool.query(
      `DELETE FROM login_attempts WHERE email = $1 AND successful = false`,
      [email.toLowerCase()],
    );
  } catch (error) {
    logger.error("[Login] Failed to clear attempts:", error.message);
  }
};

export default {
  LOCKOUT_CONFIG,
  checkAccountLockout,
  recordLoginAttempt,
  lockoutMiddleware,
  clearLoginAttempts,
};
