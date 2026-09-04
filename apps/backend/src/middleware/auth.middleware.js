import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { dbHelpers } from "../infrastructure/database/postgres-helpers.js";
import {
  getRedisClient,
  isRedisReady,
} from "../infrastructure/cache/redisClient.js";
import { isTransientDbError } from "../shared/utils/db-errors.js";
import { getRuntimeSecuritySettings } from "../services/SettingsService.js";
import { decryptUserPii } from "../shared/utils/user-utils.js";

export const ROLES = {
  USER: "user",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
};

// User cache (Redis-backed with local fallback for multi-node horizontal scaling)
const localUserCache = new Map();
const USER_CACHE_TTL = 60_000;
const USER_CACHE_MAX = 500;

// Session cache (Redis-backed with local fallback to eliminate N+1 DB hits)
const localSessionCache = new Map();
const SESSION_CACHE_TTL = 300_000;
const SESSION_CACHE_MAX = 2000;

async function getCachedSession(sessionId) {
  // 1. Check L1 in-memory cache first (0.001ms)
  const entry = localSessionCache.get(String(sessionId));
  if (entry) {
    if (Date.now() <= entry.expiresAt) {
      return entry.session;
    }
    localSessionCache.delete(String(sessionId));
  }

  // 2. Check L2 Redis only if L1 missed and Redis is ready
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(`session:${sessionId}`);
        if (cached) {
          const session = JSON.parse(cached);
          localSessionCache.set(String(sessionId), {
            session,
            expiresAt: Date.now() + SESSION_CACHE_TTL,
          });
          return session;
        }
      } catch (err) {
        console.warn("[Auth] Redis getCachedSession error:", err.message);
      }
    }
  }
  return null;
}

async function setCachedSession(sessionId, session) {
  // 1. Immediately store in L1 in-memory cache
  if (localSessionCache.size >= SESSION_CACHE_MAX) {
    const firstKey = localSessionCache.keys().next().value;
    localSessionCache.delete(firstKey);
  }
  localSessionCache.set(String(sessionId), {
    session,
    expiresAt: Date.now() + SESSION_CACHE_TTL,
  });

  // 2. Asynchronously update L2 Redis without blocking HTTP response
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      redis
        .set(`session:${sessionId}`, JSON.stringify(session), "EX", 300)
        .catch((err) => {
          console.warn("[Auth] Redis setCachedSession error:", err.message);
        });
    }
  }
}

export async function invalidateSessionCache(sessionId) {
  localSessionCache.delete(String(sessionId));
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      redis.del(`session:${sessionId}`).catch((err) => {
        console.warn("[Auth] Redis invalidateSessionCache error:", err.message);
      });
    }
  }
}

async function getCachedUser(id) {
  // 1. Check L1 in-memory cache first (0.001ms)
  const entry = localUserCache.get(id);
  if (entry) {
    if (Date.now() <= entry.expiresAt) {
      return entry.user;
    }
    localUserCache.delete(id);
  }

  // 2. Check L2 Redis only if L1 missed and Redis is ready
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(`user:cache:${id}`);
        if (cached) {
          const user = JSON.parse(cached);
          localUserCache.set(id, {
            user,
            expiresAt: Date.now() + USER_CACHE_TTL,
          });
          return user;
        }
      } catch (err) {
        console.warn("[Auth] Redis getCachedUser error:", err.message);
      }
    }
  }
  return null;
}

async function setCachedUser(id, user) {
  // 1. Immediately store in L1 in-memory cache
  if (localUserCache.size >= USER_CACHE_MAX) {
    const firstKey = localUserCache.keys().next().value;
    localUserCache.delete(firstKey);
  }
  localUserCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL });

  // 2. Asynchronously update L2 Redis without blocking HTTP response
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      redis
        .set(`user:cache:${id}`, JSON.stringify(user), "EX", 60)
        .catch((err) => {
          console.warn("[Auth] Redis setCachedUser error:", err.message);
        });
    }
  }
}

export async function invalidateUserCache(id) {
  localUserCache.delete(id);
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      redis.del(`user:cache:${id}`).catch((err) => {
        console.warn("[Auth] Redis invalidateUserCache error:", err.message);
      });
    }
  }
}

/**
 * Clear all in-memory caches. Used by tests to prevent cross-test pollution.
 * @param {boolean} includeRedis — also flush Redis user/session caches via SCAN (DEL does not support glob)
 */
export function clearAuthCaches(includeRedis = false) {
  localUserCache.clear();
  localSessionCache.clear();
  idleActivityCache.clear();
  if (includeRedis) {
    const redis = getRedisClient();
    if (redis) {
      // Best-effort async SCAN + DEL — DEL with glob pattern is invalid in Redis
      (async () => {
        for (const pattern of ["user:cache:*", "session:*"]) {
          let cursor = "0";
          try {
            do {
              const [nextCursor, keys] = await redis.scan(
                cursor,
                "MATCH",
                pattern,
                "COUNT",
                100,
              );
              cursor = nextCursor;
              if (keys && keys.length > 0) {
                await redis.del(...keys);
              }
            } while (cursor !== "0");
          } catch (_) {
            // best-effort; ignore scan errors in test cleanup
          }
        }
      })().catch(() => {});
    }
  }
}

// ─── Server-side session expiry (idle + absolute) ────────────────────────────
// Enforces TWO bounds on every authenticated session:
//   1. IDLE timeout  — no recorded activity for SESSION_IDLE_TIMEOUT_MIN
//      (admins use the tighter ADMIN_IDLE_TIMEOUT_MIN). Detects abandoned sessions.
//   2. ABSOLUTE timeout — session older than SESSION_ABSOLUTE_TIMEOUT_DAYS since
//      creation, regardless of activity. Caps the maximum lifetime of any session.
//
// Activity is persisted to user_sessions.last_active and throttled to one DB
// write per IDLE_WRITE_THROTTLE_MS per session to avoid a write on every request.
//
// FAIL-CLOSED: any DB/lookup error returns 503 so transient outages do not silently
// bypass session expiry. A definitive expiry signal returns 401.
const defaultUserIdleMin = "4320"; // 3 days default inactivity timeout
const defaultUserRememberMeIdleMin = "10080"; // 7 days when rememberMe is checked
const defaultAdminIdleMin =
  process.env.NODE_ENV === "development" ? "10080" : "4320";
export const ADMIN_IDLE_TIMEOUT_MS =
  parseInt(process.env.ADMIN_IDLE_TIMEOUT_MIN || defaultAdminIdleMin, 10) *
  60_000;
export const SESSION_IDLE_TIMEOUT_MS =
  parseInt(process.env.SESSION_IDLE_TIMEOUT_MIN || defaultUserIdleMin, 10) *
  60_000;
export const SESSION_IDLE_REMEMBER_ME_TIMEOUT_MS =
  parseInt(
    process.env.SESSION_IDLE_REMEMBER_ME_TIMEOUT_MIN ||
      defaultUserRememberMeIdleMin,
    10,
  ) * 60_000;
export const SESSION_ABSOLUTE_TIMEOUT_MS =
  parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_DAYS || "30", 10) *
  24 *
  60 *
  60 *
  1000;
const IDLE_WRITE_THROTTLE_MS = 60_000;
const IDLE_CACHE_MAX = 2000;
// Privileged roles get the tighter admin idle window.
const IDLE_ENFORCED_ROLES = new Set([ROLES.ADMIN, ROLES.SUPER_ADMIN]);
// sessionId -> { activityTs: ms (last activity), createdAt: ms, lastOp: ms (last DB op) }
const idleActivityCache = new Map();

function getIdleActivityKey(sessionId) {
  return String(sessionId);
}

// Pure, side-effect-free check used by both the per-request middleware and the
// refresh endpoint (which already holds the session row).
export function isSessionExpired(
  sessionRow,
  idleThresholdMs,
  absoluteThresholdMs,
  now = Date.now(),
) {
  if (!sessionRow) return { expired: false };
  const createdAt = sessionRow.created_at
    ? new Date(sessionRow.created_at).getTime()
    : null;
  const lastActivity = sessionRow.last_activity || sessionRow.last_active;
  const lastActivityMs = lastActivity ? new Date(lastActivity).getTime() : null;

  if (createdAt && now - createdAt > absoluteThresholdMs) {
    return { expired: true, reason: "absolute" };
  }
  if (lastActivityMs && now - lastActivityMs > idleThresholdMs) {
    return { expired: true, reason: "idle" };
  }
  return { expired: false };
}

async function enforceSessionExpiry(decoded, user) {
  const sessionId = decoded.sessionId;
  if (!sessionId) return;

  // 3 days default, 7 days when rememberMe was checked. Admin roles keep their tighter window unless rememberMe overrides.
  const rememberMe =
    decoded.rememberMe === true || decoded.remember_me === true;
  let defaultIdleThreshold;
  if (rememberMe) {
    defaultIdleThreshold = SESSION_IDLE_REMEMBER_ME_TIMEOUT_MS;
  } else {
    defaultIdleThreshold = IDLE_ENFORCED_ROLES.has(user.role)
      ? ADMIN_IDLE_TIMEOUT_MS
      : SESSION_IDLE_TIMEOUT_MS;
  }
  const securitySettings = await getRuntimeSecuritySettings().catch(() => null);
  // securitySettings.sessionTimeout >0 is an explicit admin override and takes precedence for all.
  const idleThreshold =
    securitySettings?.sessionTimeout > 0
      ? securitySettings.sessionTimeout * 1000
      : defaultIdleThreshold;

  const key = getIdleActivityKey(sessionId);
  const now = Date.now();
  let entry = idleActivityCache.get(key);
  const needRefresh = !entry || now - entry.lastOp > IDLE_WRITE_THROTTLE_MS;

  if (!needRefresh) {
    const expired = isSessionExpired(
      { created_at: entry.createdAt, last_activity: entry.activityTs },
      idleThreshold,
      SESSION_ABSOLUTE_TIMEOUT_MS,
      now,
    );
    if (expired.expired) throw { sessionExpired: true, reason: expired.reason };
    return;
  }

  try {
    const res = await dbHelpers.pool.query(
      "SELECT created_at, last_active, last_activity FROM user_sessions WHERE session_id = $1 OR id::text = $1",
      [key],
    );

    if (res.rows.length === 0) {
      // Session row not found — fail-closed: missing session is treated as expired/revoked.
      idleActivityCache.delete(key);
      throw { sessionExpired: true, reason: "idle" };
    }

    const row = res.rows[0];
    const expired = isSessionExpired(
      row,
      idleThreshold,
      SESSION_ABSOLUTE_TIMEOUT_MS,
      now,
    );
    if (expired.expired) throw { sessionExpired: true, reason: expired.reason };

    // Throttled write: record activity now.
    try {
      await dbHelpers.pool.query(
        "UPDATE user_sessions SET last_active = NOW() WHERE session_id = $1 OR id::text = $1",
        [key],
      );
    } catch (writeErr) {
      console.warn(
        "[Auth] Session activity write failed (fail-open):",
        writeErr.message,
      );
    }

    if (idleActivityCache.size >= IDLE_CACHE_MAX) {
      idleActivityCache.delete(idleActivityCache.keys().next().value);
    }
    idleActivityCache.set(key, {
      activityTs: now,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : now,
      lastOp: now,
    });
  } catch (err) {
    if (err && err.sessionExpired) throw err;
    // Fail-closed: any DB lookup error after idle cache miss must not silently
    // extend the session. Surface as 503 so protect() returns SERVICE_UNAVAILABLE.
    if (err && err.code === "42703") {
      console.warn(
        "[Auth] user_sessions activity columns missing — failing closed until migration runs",
      );
    } else {
      console.warn(
        "[Auth] Session expiry lookup failed (fail-closed):",
        err && err.message,
      );
    }
    const svcErr = new Error("Session store unavailable");
    svcErr.code = err && err.code ? err.code : "SERVICE_UNAVAILABLE";
    svcErr.statusCode = 503;
    svcErr.isTransient = true;
    throw svcErr;
  }
}

// Rate limiter for authentication endpoints
// In production: 20 attempts per 15 minutes (account lockout also applies)
// In development: 10x relaxed to avoid blocking local tests (only when NODE_ENV=development)
const AUTH_RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000",
  10,
);
const isDevForRateLimit = process.env.NODE_ENV === "development";
const AUTH_RATE_LIMIT_MAX = parseInt(
  process.env.AUTH_RATE_LIMIT_MAX || (isDevForRateLimit ? "200" : "20"),
  10,
);

/**
 * Helper to check if a request comes from a verified admin.
 * ONLY inspects req.user set by protect() after JWT verification.
 * Origin / jwt.decode bypasses removed - unverified claims must not skip rate limits.
 */
export const isUserAdminRequest = (req) => {
  if (!req || !req.user) return false;
  try {
    if (
      req.user.isAdmin === true ||
      req.user.role === ROLES.ADMIN ||
      req.user.role === ROLES.SUPER_ADMIN ||
      req.user.role === "admin" ||
      req.user.role === "super_admin"
    ) {
      return true;
    }
  } catch (_) {
    // fail closed
  }
  return false;
};

export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isUserAdminRequest(req),
});

export const isHigherRole = (userRole, requiredRole) => {
  const roleHierarchy = {
    [ROLES.USER]: 1,
    [ROLES.ADMIN]: 2,
    [ROLES.SUPER_ADMIN]: 3,
  };
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
};

// Protect routes - verify JWT token
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export const protect = async (req, res, next) => {
  // FAST-PATH / IDEMPOTENT: If already authenticated upstream (e.g. by parent admin router), pass through
  if (req.user && req.authToken) {
    return next();
  }

  let token;
  try {
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    // SEC-01: JWT_SECRET is validated at startup (app-port5001.js:99-109).
    // No per-request check needed — the app won't start without it.

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // SECURITY FIX: Reject tokens that are not session/web tokens.
    // Prevents token type confusion (e.g., password-reset or email-verification
    // tokens being used for API access).
    if (
      decoded.type &&
      !["session", "web", "phone", undefined, null].includes(decoded.type)
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, invalid token type",
      });
    }

    // PERF: kick off the user lookup immediately so it runs concurrently with
    // session validation below. On a cold cache these were two sequential DB
    // round trips to Postgres; on hosted DBs (Supabase) that doubles auth latency.
    let userLookupError = null;
    const userPromise = (async () => {
      let u = await getCachedUser(decoded.id);
      if (!u) {
        u = await dbHelpers.findById("users", decoded.id);
      }
      return u;
    })().catch((err) => {
      userLookupError = err;
      return null;
    });

    // SESSION-SEC: Verify session is still active if token contains sessionId
    // (sessionId is embedded in JWT at login via auth.controller.js)
    if (decoded.sessionId) {
      const session = await getCachedSession(decoded.sessionId);
      if (session !== null) {
        if (!session.isActive) {
          return res.status(401).json({
            success: false,
            message: "Your session has been revoked. Please log in again.",
          });
        }
      } else {
        // Cache miss — fall back to DB and hydrate cache.
        try {
          const sessionCheck = await dbHelpers.pool.query(
            "SELECT is_active FROM user_sessions WHERE session_id = $1 OR id::text = $1",
            [String(decoded.sessionId)],
          );
          if (sessionCheck.rows.length === 0) {
            // Treat valid JWT as active and cache
            console.warn(
              "[Auth] Session row missing during validation; failing open (JWT is valid)",
            );
            await setCachedSession(decoded.sessionId, { isActive: true });
          } else if (!sessionCheck.rows[0].is_active) {
            await setCachedSession(decoded.sessionId, { isActive: false });
            return res.status(401).json({
              success: false,
              message: "Your session has been revoked. Please log in again.",
            });
          } else {
            // Cache session for 5 minutes to amortize future lookups.
            await setCachedSession(decoded.sessionId, { isActive: true });
          }
        } catch (sessionErr) {
          // Graceful degradation when the table is missing (Postgres code 42P01).
          if (sessionErr.code === "42P01") {
            console.warn(
              "[Auth] user_sessions table missing, skipping session check",
            );
            await setCachedSession(decoded.sessionId, { isActive: true });
          } else if (isTransientDbError(sessionErr)) {
            console.warn(
              "[Auth] Session validation temporarily unavailable:",
              sessionErr.message,
            );
            return res.status(503).json({
              success: false,
              code: "SERVICE_UNAVAILABLE",
              message: "Service temporarily unavailable. Please try again.",
            });
          } else {
            console.error(
              "[Auth] Session validation query failed (fatal):",
              sessionErr.message,
            );
            throw sessionErr;
          }
        }
      }
    }

    let user = await userPromise;
    if (userLookupError) {
      if (isTransientDbError(userLookupError)) {
        // Transient infra failure — keep the session alive, ask client to retry.
        console.warn(
          "[Auth] User lookup temporarily unavailable during protect check:",
          userLookupError.message,
        );
        return res.status(503).json({
          success: false,
          code: "SERVICE_UNAVAILABLE",
          message: "Service temporarily unavailable. Please try again.",
        });
      }
      throw userLookupError;
    }

    if (!user) {
      // Cache was empty on this path (userPromise already tried cache + DB).
      return res.status(401).json({
        success: false,
        message: "Not authorized, user no longer exists",
      });
    }

    await setCachedUser(decoded.id, user);

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact support.",
      });
    }

    // LOW-01 FIX: Check both field name variants (emailVerified / isEmailVerified)
    // Google OAuth users have isEmailVerified: true; the field name depends on the DB adapter
    // Dev/test relaxation: NODE_ENV !== 'production' auto-verifies registrations,
    // so the gate only applies in production (or when mailer is configured).
    const isVerified = user.isEmailVerified ?? user.emailVerified ?? false;
    if (isVerified === false && process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Please verify your email to continue.",
      });
    }

    const decryptedUser = decryptUserPii(user);
    const { password, ...userWithoutPassword } = decryptedUser;
    const isAdmin =
      decryptedUser.role === ROLES.ADMIN ||
      decryptedUser.role === ROLES.SUPER_ADMIN ||
      decryptedUser.role === "admin" ||
      decryptedUser.role === "super_admin";

    req.user = {
      ...userWithoutPassword,
      isAdmin,
      role: decryptedUser.role,
      sessionId: decoded.sessionId || null,
    };
    req.authToken = token;

    // Cache the user for subsequent requests — cache the password-stripped object
    // (never the full row, which still contains the bcrypt `password`).
    setCachedUser(decoded.id, userWithoutPassword);

    // Server-side session expiry (idle + absolute) for all sessions.
    // enforceSessionExpiry() is fail-closed: any DB/lookup error returns 503.
    try {
      await enforceSessionExpiry(decoded, req.user);
    } catch (expiryErr) {
      if (expiryErr && expiryErr.sessionExpired) {
        return res.status(401).json({
          success: false,
          code:
            expiryErr.reason === "absolute"
              ? "SESSION_EXPIRED"
              : "SESSION_IDLE_TIMEOUT",
          message:
            expiryErr.reason === "absolute"
              ? "Session expired. Please sign in again."
              : "Session expired due to inactivity",
        });
      }
      if (
        expiryErr &&
        (expiryErr.statusCode === 503 ||
          expiryErr.code === "SERVICE_UNAVAILABLE" ||
          expiryErr.isTransient)
      ) {
        return res.status(503).json({
          success: false,
          code: "SERVICE_UNAVAILABLE",
          message: "Session validation temporarily unavailable. Please retry.",
        });
      }
      throw expiryErr;
    }

    next();
  } catch (error) {
    // A transient DB/infra failure (connection reset, DB booting during a
    // restart, DNS blip) must NOT be reported as an authentication failure.
    // Treat the JWT as still-valid and ask the client to retry — otherwise a
    // brief backend warmup would appear as a mass logout to all users whose
    // requests land in that window.
    if (isTransientDbError(error)) {
      console.warn(
        "[Auth] Protect check temporarily unavailable; returning 503:",
        error.message,
      );
      return res.status(503).json({
        success: false,
        code: "SERVICE_UNAVAILABLE",
        message: "Service temporarily unavailable. Please try again.",
      });
    }
    // Definitive auth failure (bad signature, expired JWT, deactivated user, etc.)
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
    });
  }
};

export const auth = protect;

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
/**
 * QUESTION ENGINE FIX #5 (HIGH): question/answer images are served from the
 * `/uploads` and `/storage` static directories. Those directories were mounted
 * as public `express.static`, so anyone with the URL could fetch exam question
 * images and solution images without authentication. This middleware guards
 * image requests: a valid session (JWT via Bearer header OR httpOnly cookie,
 * with an active session) is required. Avatars/banners remain on the separate
 * public `/assets/avatar` route and are intentionally not guarded.
 *
 * Note: this only enforces authentication (not admin/email-verification), so
 * authenticated students can still load images inside a test. Unauthenticated
 * requests are rejected with 401.
 */
export const requireImageAuth = async (req, res, next) => {
  let token;
  try {
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to view this asset",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (
      decoded.type &&
      !["session", "web", "phone", undefined, null].includes(decoded.type)
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, invalid token type",
      });
    }

    // Validate the session is still active when one is attached to the token.
    if (decoded.sessionId) {
      const redis = getRedisClient();
      let cached = null;
      if (redis) {
        try {
          cached = await redis.get(`session:${decoded.sessionId}`);
        } catch (_) {
          /* fall through to DB */
        }
      }
      if (cached !== null) {
        if (!JSON.parse(cached).isActive) {
          return res
            .status(401)
            .json({ success: false, message: "Session revoked" });
        }
      } else {
        try {
          const sessionCheck = await dbHelpers.pool.query(
            "SELECT is_active FROM user_sessions WHERE session_id = $1 OR id::text = $1",
            [String(decoded.sessionId)],
          );
          if (
            sessionCheck.rows.length === 0 ||
            !sessionCheck.rows[0].is_active
          ) {
            return res
              .status(401)
              .json({ success: false, message: "Session revoked" });
          }
        } catch (sessionErr) {
          // Missing table / transient DB — fail open so a blip does not blank
          // every image in an in-progress test.
          if (sessionErr.code !== "42P01") {
            console.warn(
              "[ImageAuth] session check failed (fail-open):",
              sessionErr.message,
            );
          }
        }
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication required to view this asset",
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  let token;
  try {
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // SESSION-SEC: Verify session is still active for optional auth too
      let sessionValid = true;
      if (decoded.sessionId) {
        const redis = getRedisClient();
        let cached = null;
        if (redis) {
          cached = await redis.get(`session:${decoded.sessionId}`);
        }
        if (cached !== null) {
          const session = JSON.parse(cached);
          if (!session.isActive) sessionValid = false;
        } else {
          try {
            const sessionCheck = await dbHelpers.pool.query(
              "SELECT is_active FROM user_sessions WHERE session_id = $1 OR id::text = $1",
              [String(decoded.sessionId)],
            );
            if (
              sessionCheck.rows.length === 0 ||
              !sessionCheck.rows[0].is_active
            ) {
              sessionValid = false;
            }
          } catch (sessionErr) {
            // Graceful degradation ONLY when the table is missing (Postgres code 42P01).
            if (sessionErr.code === "42P01") {
              // skip session validation, treat as authenticated if JWT is valid
            } else {
              console.error(
                "[Auth] Session validation query failed (fatal):",
                sessionErr.message,
              );
              throw sessionErr;
            }
          }
        }
      }

      if (!sessionValid) {
        return next(); // Treat as unauthenticated — don't attach user
      }

      const user =
        (await getCachedUser(decoded.id)) ||
        (await dbHelpers.findById("users", decoded.id));
      const isVerified = user
        ? (user.isEmailVerified ?? user.emailVerified ?? false)
        : false;
      if (
        user &&
        user.isActive !== false &&
        (isVerified === true || process.env.NODE_ENV !== "production")
      ) {
        const { password, ...userWithoutPassword } = user;
        req.user = {
          ...userWithoutPassword,
          isAdmin:
            user.role === ROLES.ADMIN ||
            user.role === ROLES.SUPER_ADMIN ||
            user.role === "admin" ||
            user.role === "super_admin",
          role: user.role,
          sessionId: decoded.sessionId || null,
        };
      }
    }

    next();
  } catch (error) {
    // SEC-03: Differentiate error types so frontend can distinguish
    // "logged out" from "session expired" or "token tampered".
    if (error instanceof jwt.TokenExpiredError) {
      req.authError = "token_expired";
    } else if (error instanceof jwt.JsonWebTokenError) {
      req.authError = "invalid_token";
    }
    next();
  }
};

export const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Not authorized as admin",
    });
  }
};

export const superAdmin = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === ROLES.SUPER_ADMIN ||
      req.user.role === ROLES.ADMIN ||
      req.user.isAdmin)
  ) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Not authorized as admin",
    });
  }
};

export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (isHigherRole(req.user.role, requiredRole)) {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${requiredRole}`,
      });
    }
  };
};

export const proPass = (req, res, next) => {
  if (req.user && req.user.isProUser) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Pro Pass required for this resource",
    });
  }
};
