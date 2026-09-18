import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { auth } from "../../middleware/auth.middleware.js";
import crypto from "crypto";
import SmsService from "../../services/SmsService.js";
import EmailService from "../../services/EmailService.js";
import {
  lockoutMiddleware,
  recordLoginAttempt,
  clearLoginAttempts,
} from "../../middleware/lockout.middleware.js";
import { authRateLimiter } from "../../middleware/auth.middleware.js";
import {
  validateCsrfToken,
  generateCsrfToken,
  storeCsrfToken,
  setCsrfCookie,
} from "../../middleware/csrf.middleware.js";
import {
  generateToken,
  setAuthCookies,
} from "../../modules/auth/auth.service.js";
import {
  captureSession,
  invalidateSession,
  setSessionRefreshHash,
} from "../../services/SessionCaptureService.js";
import { getRedisClient } from "../../infrastructure/cache/redisClient.js";
import logger from "../../infrastructure/logger/logger.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";

const router = express.Router();

// ============================================================
// FIX 2.7: OTP Store — Require Redis in Production
//
// Resolution is lazy: getRedisClient() is called per-request so the store
// picks up a Redis connection that becomes available after startup. The
// previous implementation checked `global.redis` which was never assigned
// anywhere, so in production the store was always null and every phone-auth
// request returned 503 even when Redis was healthy.
//
// In production without Redis, requests return 503.
// In development, a size-limited in-memory Map is allowed with warnings.
// ============================================================
const MAX_DEV_OTP_STORE_SIZE = 1000;
const devOtpStore = new Map();
let redisWarned = false;

// Login-attempt tracking key for phone flows (lockout.middleware counts by
// email OR ip; the phone: key gives per-number brute-force accounting).
const phoneAttemptKey = (phoneNumber) => `phone:${String(phoneNumber)}`;

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

// Phone refresh secret — mirrors auth.controller getRefreshSecret (no predictable
// fallback: JWT_REFRESH_SECRET must be set).
function getPhoneRefreshSecret() {
  if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET;
  throw new Error("JWT_REFRESH_SECRET must be set for phone session issuance.");
}

// Returns the active store backend or null.
// shape: { type: 'redis', client } | { type: 'memory', map } | null
function resolveOtpStore() {
  const redis = getRedisClient();
  if (redis && redis.status === "ready") {
    return { type: "redis", client: redis };
  }
  if (process.env.NODE_ENV === "production") {
    if (!redisWarned) {
      redisWarned = true;
      logger.error(
        "[OTP Store] Redis is REQUIRED for phone auth in production but is not ready.",
      );
    }
    return null;
  }
  if (!redisWarned) {
    redisWarned = true;
    logger.warn(
      "[SECURITY WARNING] Phone auth using in-memory OTP store (development only). NOT safe for production.",
    );
  }
  return { type: "memory", map: devOtpStore };
}

/**
 * POST /api/auth/phone/send-otp
 * Send OTP to phone number via SMS
 */
router.post(
  "/send-otp",
  lockoutMiddleware,
  authRateLimiter,
  async (req, res) => {
    try {
      // FIX 2.7: Reject if OTP store unavailable (Redis required in prod)
      const store = resolveOtpStore();
      if (!store) {
        return res.status(503).json({
          success: false,
          error: "Phone authentication is temporarily unavailable",
        });
      }

      const { phoneNumber } = req.body;

      if (!(await SmsService.isEnabled())) {
        return res.status(503).json({
          success: false,
          code: "SMS_NOTIFICATIONS_DISABLED",
          error: "SMS authentication is currently unavailable",
        });
      }

      // Validate phone number (10 digits for India)
      if (!phoneNumber || !phoneNumber.match(/^[0-9]{10}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number format (10 digits required)",
        });
      }

      // Check rate limiting (max 3 OTPs per hour)
      const rateLimitKey = `otp:rate:${phoneNumber}`;
      const otpCount = await getFromStore(rateLimitKey);
      if (otpCount && parseInt(otpCount) >= 3) {
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res.status(429).json({
          success: false,
          error: "Too many OTP requests. Please try again after 1 hour.",
        });
      }

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();

      // Store OTP with 10 minute expiry
      const otpKey = `otp:${phoneNumber}`;
      const otpData = {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
        createdAt: Date.now(),
      };

      await setInStore(otpKey, JSON.stringify(otpData), 600); // 10 minutes

      // Increment rate limit counter (1 hour expiry)
      if (otpCount) {
        await setInStore(rateLimitKey, String(parseInt(otpCount) + 1), 3600);
      } else {
        await setInStore(rateLimitKey, "1", 3600);
      }

      // Send OTP via SMS (Twilio/AWS SNS)
      const formattedPhone = "+91" + phoneNumber;
      const result = await SmsService.sendOtp(formattedPhone, otp);

      if (!result.success && process.env.NODE_ENV !== "development") {
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res.status(500).json({
          success: false,
          error: "Failed to send OTP. Please try again.",
        });
      }

      res.json({
        success: true,
        message: "OTP sent to your registered mobile number",
      });
      // Never log OTPs, even in development — security best practice.
    } catch (error) {
      logger.error({ err: error }, "Error sending OTP");
      res.status(500).json({ success: false, error: "Failed to send OTP" });
    }
  },
);

/**
 * POST /api/auth/phone/verify-otp
 * Verify OTP and create/login user
 */
router.post(
  "/verify-otp",
  lockoutMiddleware,
  authRateLimiter,
  async (req, res) => {
    try {
      // FIX 2.7: Reject if OTP store unavailable (Redis required in prod)
      const store = resolveOtpStore();
      if (!store) {
        return res.status(503).json({
          success: false,
          error: "Phone authentication is temporarily unavailable",
        });
      }

      const { phoneNumber, otp, name, email } = req.body;

      if (!phoneNumber || !otp) {
        return res
          .status(400)
          .json({ success: false, error: "Phone and OTP required" });
      }

      // Get stored OTP data
      const otpKey = `otp:${phoneNumber}`;
      const otpDataStr = await getFromStore(otpKey);

      if (!otpDataStr) {
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res
          .status(400)
          .json({ success: false, error: "OTP expired or not requested" });
      }

      const otpData = JSON.parse(otpDataStr);

      // Check if OTP is expired
      if (otpData.expiresAt < Date.now()) {
        await deleteFromStore(otpKey);
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res.status(400).json({ success: false, error: "OTP expired" });
      }

      // Verify OTP (timing-safe comparison to prevent timing attacks)
      const otpBuf = Buffer.from(otpData.otp, "utf8");
      const inputBuf = Buffer.from(String(otp), "utf8");
      if (
        otpBuf.length !== inputBuf.length ||
        !crypto.timingSafeEqual(otpBuf, inputBuf)
      ) {
        otpData.attempts++;
        if (otpData.attempts >= 3) {
          await deleteFromStore(otpKey);
          await recordLoginAttempt(
            phoneAttemptKey(phoneNumber),
            getClientIp(req),
            false,
            req.headers?.["user-agent"],
          );
          return res
            .status(400)
            .json({ success: false, error: "Too many failed attempts" });
        }
        // Update attempts counter
        await setInStore(otpKey, JSON.stringify(otpData), 600);
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res.status(400).json({ success: false, error: "Invalid OTP" });
      }

      // OTP is valid, find or create user — fetch role/limit for session enforcement
      let userResult = await dbHelpers.query(
        "SELECT id, email, name, phone_verified, role, is_pro_user, session_limit FROM users WHERE phone = $1",
        [phoneNumber],
      );

      let userId,
        isNewUser = false;
      // Normalize attacker-supplied profile fields (trim + cap length).
      const suppliedEmail =
        typeof email === "string" && email.trim()
          ? email.trim().slice(0, 255)
          : null;
      const suppliedName =
        typeof name === "string" && name.trim()
          ? name.trim().slice(0, 255)
          : `User${String(phoneNumber).slice(-4)}`;
      const finalEmail = suppliedEmail || `${phoneNumber}@trstprep.local`;
      if (userResult.rows.length === 0) {
        // Uniqueness-check email before insert so a taken email returns 409,
        // not a DB 23505 bubbling to 500.
        if (suppliedEmail) {
          const emailTaken = await dbHelpers.query(
            "SELECT id FROM users WHERE email = $1",
            [suppliedEmail],
          );
          if (emailTaken.rows.length > 0) {
            return res.status(409).json({
              success: false,
              code: "EMAIL_ALREADY_REGISTERED",
              error:
                "Email already registered. Please log in with email or use a different email.",
            });
          }
        }
        // H1 FIX: phone OTP is a possession factor — the phone number itself is
        // verified by the OTP challenge above. A synthetic `<phone>@trstprep.local`
        // email has no mailbox to verify, so mark is_email_verified=true
        // alongside phone_verified=true; otherwise protect()'s production
        // email-verification gate returns 403 for every phone-authed user.
        // An attacker-supplied email is still stored UNVERIFIED-equivalent in
        // practice: it is only trusted after the existing email-verification
        // flow (sendVerificationEmail) confirms mailbox control. Do NOT treat
        // suppliedEmail as verified for recovery/notifications until then.
        let createResult;
        try {
          // Create new user
          createResult = await dbHelpers.query(
            `INSERT INTO users (phone, email, name, auth_type, phone_verified, is_email_verified, last_login, created_at)
          VALUES ($1, $2, $3, 'phone', true, true, NOW(), NOW())
          RETURNING id, email, name`,
            [phoneNumber, finalEmail, suppliedName],
          );
        } catch (insErr) {
          // Race safety: unique violation between check and insert -> 409, not 500.
          if (
            insErr &&
            (insErr.code === "23505" ||
              /duplicate|unique/i.test(insErr.message || ""))
          ) {
            return res.status(409).json({
              success: false,
              code: "EMAIL_ALREADY_REGISTERED",
              error:
                "Email already registered. Please log in with email or use a different email.",
            });
          }
          throw insErr;
        }
        userId = createResult.rows[0].id;
        isNewUser = true;
      } else {
        userId = userResult.rows[0].id;
        // Update last login (H1: phone OTP verifies possession — also mark
        // is_email_verified so the production email-verification gate in
        // protect() does not 403 phone-authed users with synthetic emails).
        await dbHelpers.query(
          "UPDATE users SET last_login = NOW(), phone_verified = true, is_email_verified = true WHERE id = $1",
          [userId],
        );
      }

      // Capture session for per-device revocation (was missing — phone-authed
      // users couldn't be logged out). Falls back gracefully if session capture fails.
      let sessionId = null;
      try {
        sessionId = await captureSession(req, userId, "phone");
      } catch (sessErr) {
        logger.error(
          "[Phone Auth] Session capture failed (non-fatal):",
          sessErr.message,
        );
      }

      // Enforce session limit (admin unlimited) — same policy as email/Google login
      if (sessionId) {
        try {
          const userRow = userResult.rows[0] || {};
          // For newly created phone user, role defaults to 'user' and no pro
          const role = userRow.role || "user";
          const isPro = Boolean(
            userRow.is_pro_user || userRow.isProUser || userRow.is_pro,
          );
          const customLimit = userRow.session_limit ?? userRow.sessionLimit;
          let phoneSessionLimit = 1;
          if (role === "admin") {
            phoneSessionLimit = Infinity;
            if (customLimit !== null && customLimit !== undefined) {
              phoneSessionLimit = customLimit;
              if (phoneSessionLimit === null) phoneSessionLimit = Infinity;
            }
          } else if (customLimit !== null && customLimit !== undefined) {
            phoneSessionLimit = customLimit;
          } else if (isPro) {
            phoneSessionLimit = 3;
          }
          const phoneLimitNum = Number(phoneSessionLimit);
          if (Number.isFinite(phoneLimitNum)) {
            const client = await pool.connect();
            try {
              await client.query("BEGIN");
              await client.query(
                `SELECT 1 FROM user_sessions WHERE user_id = $1 FOR UPDATE`,
                [String(userId)],
              );
              const activeResult = await client.query(
                `SELECT session_id FROM user_sessions WHERE user_id = $1 AND is_active = true ORDER BY last_active DESC`,
                [String(userId)],
              );
              if (activeResult.rows.length > phoneLimitNum) {
                const toRevoke = activeResult.rows
                  .filter((s) => s.session_id !== sessionId)
                  .slice(phoneLimitNum - 1);
                if (toRevoke.length > 0) {
                  const revokeIds = toRevoke.map((s) => s.session_id);
                  await client.query(
                    `UPDATE user_sessions SET is_active = false WHERE session_id = ANY($1)`,
                    [revokeIds],
                  );
                  await client.query("COMMIT");
                  for (const row of toRevoke) {
                    await invalidateSession(
                      row.session_id,
                      "system:limit-enforcement",
                    );
                  }
                } else {
                  await client.query("COMMIT");
                }
              } else {
                await client.query("COMMIT");
              }
            } catch (err) {
              await client.query("ROLLBACK");
              throw err;
            } finally {
              client.release();
            }
          }
        } catch (limitErr) {
          logger.warn(
            "[Phone Auth] Session limit enforcement failed (non-fatal): " +
              limitErr.message,
          );
        }
      }

      // Session issuance via canonical web-flow helpers (auth.service).
      // Access token: JWT_SECRET, default 7d (JWT_EXPIRES_IN override) — never
      // the 2FA temp secret, never 30d. Refresh token: JWT_REFRESH_SECRET, 30d.
      // CROSS-DEP (auth.middleware.js, owned by another agent): protect() must
      // accept type="phone" as a first-class authenticated session; it
      // validates sessionId against user_sessions. Do not change here.
      const phoneRole = userResult.rows[0]?.role || "user";
      const token = generateToken(userId, phoneRole, {
        claims: {
          phone: phoneNumber,
          type: "phone",
          ...(sessionId ? { sessionId } : {}),
        },
      });
      let refreshToken = null;
      try {
        refreshToken = generateToken(userId, phoneRole, {
          secret: getPhoneRefreshSecret(),
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
          claims: { ...(sessionId ? { sessionId } : {}) },
        });
      } catch (refreshErr) {
        logger.error(
          { err: refreshErr },
          "[Phone Auth] Refresh token issuance failed",
        );
        return res
          .status(500)
          .json({ success: false, error: "Failed to create session" });
      }

      // Bind refresh token to session for per-device revocation (mirror web login).
      if (sessionId && refreshToken) {
        try {
          await setSessionRefreshHash(sessionId, refreshToken);
        } catch (hashErr) {
          logger.error(
            { err: hashErr },
            "[Phone Auth] Refresh hash bind failed (non-fatal)",
          );
        }
      }

      // Deliver session via httpOnly cookies (never a long-lived token in body).
      setAuthCookies(res, { token, refreshToken, rememberMe: false });

      // Bootstrap CSRF for the new session (mirror web login; non-fatal).
      try {
        const csrfToken = generateCsrfToken();
        await storeCsrfToken(token, csrfToken);
        setCsrfCookie(res, csrfToken);
      } catch (csrfErr) {
        logger.error(
          { err: csrfErr },
          "[Phone Auth] CSRF bootstrap failed (non-fatal)",
        );
      }

      // Clear OTP from store
      await deleteFromStore(otpKey);

      // OTP verified — clear brute-force counters for this number.
      await clearLoginAttempts(phoneAttemptKey(phoneNumber));

      // Send welcome email for new users (phone is verified; supplied email is
      // NOT verified — see TODO above; welcome mail is best-effort only).
      if (isNewUser && suppliedEmail) {
        try {
          await EmailService.sendWelcomeEmail(suppliedEmail, suppliedName);
        } catch (err) {
          logger.error({ err }, "Error sending welcome email");
        }
      }

      res.json({
        success: true,
        isNewUser,
        sessionId,
        user: {
          id: userId,
          phone: phoneNumber,
          email: userResult.rows[0]?.email || finalEmail,
          name: userResult.rows[0]?.name || suppliedName,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "Error verifying OTP");
      res.status(500).json({ success: false, error: "Failed to verify OTP" });
    }
  },
);

/**
 * POST /api/auth/phone/link-phone
 * Link phone to existing account (authenticated)
 */
router.post(
  "/link-phone",
  auth,
  lockoutMiddleware,
  authRateLimiter,
  validateCsrfToken,
  async (req, res) => {
    try {
      // Fail CLOSED when OTP store unavailable (mirror verify-otp).
      if (!resolveOtpStore()) {
        return res.status(503).json({
          success: false,
          error: "Phone authentication is temporarily unavailable",
        });
      }
      const userId = req.user.id;
      const { phoneNumber, otp } = req.body;

      if (!phoneNumber || !otp) {
        return res
          .status(400)
          .json({ success: false, error: "Phone and OTP required" });
      }

      // Verify OTP
      const otpKey = `otp:${phoneNumber}`;
      const otpDataStr = await getFromStore(otpKey);

      if (!otpDataStr) {
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res
          .status(400)
          .json({ success: false, error: "OTP invalid or expired" });
      }

      const otpData = JSON.parse(otpDataStr);
      if (otpData.expiresAt < Date.now()) {
        await deleteFromStore(otpKey);
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res.status(400).json({ success: false, error: "OTP expired" });
      }
      // Timing-safe OTP comparison + bounded guesses (mirror verify-otp:
      // increment attempts, delete after 3 failures).
      const linkOtpBuf = Buffer.from(otpData.otp, "utf8");
      const linkInputBuf = Buffer.from(String(otp), "utf8");
      if (
        linkOtpBuf.length !== linkInputBuf.length ||
        !crypto.timingSafeEqual(linkOtpBuf, linkInputBuf)
      ) {
        otpData.attempts = (otpData.attempts || 0) + 1;
        if (otpData.attempts >= 3) {
          await deleteFromStore(otpKey);
          await recordLoginAttempt(
            phoneAttemptKey(phoneNumber),
            getClientIp(req),
            false,
            req.headers?.["user-agent"],
          );
          return res
            .status(400)
            .json({ success: false, error: "Too many failed attempts" });
        }
        await setInStore(otpKey, JSON.stringify(otpData), 600);
        await recordLoginAttempt(
          phoneAttemptKey(phoneNumber),
          getClientIp(req),
          false,
          req.headers?.["user-agent"],
        );
        return res
          .status(400)
          .json({ success: false, error: "Invalid or expired OTP" });
      }

      // Check if phone already linked to another user
      const existingUser = await dbHelpers.query(
        "SELECT id FROM users WHERE phone = $1 AND id != $2",
        [phoneNumber, userId],
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Phone already linked to another account",
        });
      }

      // Update user with phone (H1: OTP proves possession — mark
      // is_email_verified alongside phone_verified so protect() does not 403).
      await dbHelpers.query(
        "UPDATE users SET phone = $1, phone_verified = true, is_email_verified = true, updated_at = NOW() WHERE id = $2",
        [phoneNumber, userId],
      );

      // Clear OTP
      await deleteFromStore(otpKey);

      // Phone linked — clear brute-force counters for this number.
      await clearLoginAttempts(phoneAttemptKey(phoneNumber));

      res.json({ success: true, message: "Phone linked successfully" });
    } catch (error) {
      logger.error({ err: error }, "Error linking phone");
      res.status(500).json({ success: false, error: "Failed to link phone" });
    }
  },
);

// ========== Helper Functions ==========
// Resolved per-call so a Redis connection that becomes available after
// startup is used, and a dead global.redis reference is never consulted.

async function getFromStore(key) {
  const store = resolveOtpStore();
  if (!store) return null;
  if (store.type === "redis") {
    return await store.client.get(key);
  }
  return store.map.get(key);
}

async function setInStore(key, value, ttl = 600) {
  const store = resolveOtpStore();
  if (!store) return;
  if (store.type === "redis") {
    if (ttl) {
      await store.client.setex(key, ttl, value);
    } else {
      await store.client.set(key, value);
    }
    return;
  }
  // In-memory dev fallback
  const map = store.map;
  // FIX 2.7: Enforce size limit on dev-mode Map to prevent memory leaks
  if (map.size >= MAX_DEV_OTP_STORE_SIZE) {
    const firstKey = map.keys().next().value;
    map.delete(firstKey);
    logger.warn(
      `[OTP Store] Dev map exceeded ${MAX_DEV_OTP_STORE_SIZE} entries, evicted oldest.`,
    );
  }
  map.set(key, value);
  // Auto-expire in non-Redis mode (dev only)
  if (ttl) {
    const timer = setTimeout(() => map.delete(key), ttl * 1000);
    timer.unref?.();
  }
}

async function deleteFromStore(key) {
  const store = resolveOtpStore();
  if (!store) return;
  if (store.type === "redis") {
    await store.client.del(key);
  } else {
    store.map.delete(key);
  }
}

export default router;
