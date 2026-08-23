import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { auth } from "../../middleware/auth.middleware.js";
import crypto from "crypto";
import SmsService from "../../services/SmsService.js";
import jwt from "jsonwebtoken";
import EmailService from "../../services/EmailService.js";
import { lockoutMiddleware } from "../../middleware/lockout.middleware.js";
import { authRateLimiter } from "../../middleware/auth.middleware.js";
import {
  captureSession,
  invalidateSession,
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
router.post("/send-otp", authRateLimiter, async (req, res) => {
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
    logger.error(
      { err: error, phoneNumber: req.body?.phoneNumber },
      "Error sending OTP",
    );
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
});

/**
 * POST /api/auth/phone/verify-otp
 * Verify OTP and create/login user
 */
router.post("/verify-otp", lockoutMiddleware, async (req, res) => {
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
      return res
        .status(400)
        .json({ success: false, error: "OTP expired or not requested" });
    }

    const otpData = JSON.parse(otpDataStr);

    // Check if OTP is expired
    if (otpData.expiresAt < Date.now()) {
      await deleteFromStore(otpKey);
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
        return res
          .status(400)
          .json({ success: false, error: "Too many failed attempts" });
      }
      // Update attempts counter
      await setInStore(otpKey, JSON.stringify(otpData), 600);
      return res.status(400).json({ success: false, error: "Invalid OTP" });
    }

    // OTP is valid, find or create user — fetch role/limit for session enforcement
    let userResult = await dbHelpers.query(
      "SELECT id, email, name, phone_verified, role, is_pro_user, session_limit FROM users WHERE phone = $1",
      [phoneNumber],
    );

    let userId,
      isNewUser = false;
    if (userResult.rows.length === 0) {
      // Create new user
      const createResult = await dbHelpers.query(
        `INSERT INTO users (phone, email, name, auth_type, phone_verified, last_login, created_at)
         VALUES ($1, $2, $3, 'phone', true, NOW(), NOW())
         RETURNING id, email, name`,
        [
          phoneNumber,
          email || `${phoneNumber}@trstprep.local`,
          name || `User${phoneNumber.slice(-4)}`,
        ],
      );
      userId = createResult.rows[0].id;
      isNewUser = true;
    } else {
      userId = userResult.rows[0].id;
      // Update last login
      await dbHelpers.query(
        "UPDATE users SET last_login = NOW(), phone_verified = true WHERE id = $1",
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
        if (role === "admin" || role === "super_admin") {
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

    // Generate JWT token — embed sessionId so protect middleware can validate it.
    // Use a dedicated phone-auth secret (JWT_2FA_SECRET) to keep session,
    // password reset, and phone-auth token namespaces isolated. Falls back to
    // JWT_SECRET for backward compat during the migration window.
    const phoneSecret = process.env.JWT_2FA_SECRET || process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: userId, phone: phoneNumber, type: "phone", sessionId },
      phoneSecret,
      { expiresIn: "30d" },
    );

    // Clear OTP from store
    await deleteFromStore(otpKey);

    // Send welcome email for new users
    if (isNewUser && email) {
      try {
        EmailService.sendWelcomeEmail(email, name || "User");
      } catch (err) {
        console.error("Error sending welcome email:", err);
      }
    }

    res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: userId,
        phone: phoneNumber,
        email: userResult.rows[0]?.email || email,
        name,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, error: "Failed to verify OTP" });
  }
});

/**
 * POST /api/auth/phone/link-phone
 * Link phone to existing account (authenticated)
 */
router.post("/link-phone", auth, async (req, res) => {
  try {
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
      return res
        .status(400)
        .json({ success: false, error: "OTP invalid or expired" });
    }

    const otpData = JSON.parse(otpDataStr);
    if (otpData.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, error: "OTP expired" });
    }
    // Timing-safe OTP comparison
    const linkOtpBuf = Buffer.from(otpData.otp, "utf8");
    const linkInputBuf = Buffer.from(String(otp), "utf8");
    if (
      linkOtpBuf.length !== linkInputBuf.length ||
      !crypto.timingSafeEqual(linkOtpBuf, linkInputBuf)
    ) {
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

    // Update user with phone
    await dbHelpers.query(
      "UPDATE users SET phone = $1, phone_verified = true, updated_at = NOW() WHERE id = $2",
      [phoneNumber, userId],
    );

    // Clear OTP
    await deleteFromStore(otpKey);

    res.json({ success: true, message: "Phone linked successfully" });
  } catch (error) {
    console.error("Error linking phone:", error);
    res.status(500).json({ success: false, error: "Failed to link phone" });
  }
});

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
