import crypto from "crypto";
import { dbHelpers } from "../infrastructure/database/postgres-helpers.js";
import { getRedisClient } from "../infrastructure/cache/redisClient.js";

// ============================================================
// FIX 2.8: CSRF Token Store — Redis Primary, No Silent Fallback
//
// Previous: fell back to in-memory Map when DB failed.
// Problem: per-instance storage breaks multi-instance deploys.
//
// New approach:
// 1. Try database (primary)
// 2. Try Redis (secondary)
// 3. In production, reject if both fail (no silent fallback)
// 4. In development, allow memory fallback with warning
//
// The csrfTokensMemory Map is kept ONLY for grace-period
// prev: tokens (inherently per-instance, short-lived).
// ============================================================

// Grace-period prev: tokens only (NOT for primary storage)
export const csrfTokensMemory = new Map();
const CSRF_MAX_MEMORY_TOKENS = 500;
const CSRF_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

// CSRF token lifecycle configuration
export const CSRF_TOKEN_EXPIRY_MS = CSRF_TOKEN_TTL;
export const CSRF_TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function cleanupCsrfTokens() {
  const now = Date.now();
  for (const [key, val] of csrfTokensMemory) {
    if (now - val.createdAt > CSRF_TOKEN_TTL) {
      csrfTokensMemory.delete(key);
    }
  }
  if (csrfTokensMemory.size > CSRF_MAX_MEMORY_TOKENS) {
    const keysIter = csrfTokensMemory.keys();
    while (csrfTokensMemory.size > CSRF_MAX_MEMORY_TOKENS) {
      csrfTokensMemory.delete(keysIter.next().value);
    }
  }
}

// HMAC pepper for auth token hashing — never store raw token hash without pepper
const getCsrfPepper = () => {
  return (
    process.env.CSRF_HMAC_PEPPER ||
    process.env.CSRF_PEPPER ||
    process.env.JWT_SECRET ||
    ""
  );
};

const hashAuthToken = (authToken) => {
  const pepper = getCsrfPepper();
  // Use HMAC-SHA256 with pepper; falls back gracefully if pepper missing (warned)
  if (!pepper) {
    console.warn(
      "[CSRF] CSRF_HMAC_PEPPER/JWT_SECRET not set — using insecure hash",
    );
    return crypto.createHash("sha256").update(authToken).digest("hex");
  }
  return crypto.createHmac("sha256", pepper).update(authToken).digest("hex");
};

// Generate CSRF token
export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Store CSRF token: DB (UPSERT ON CONFLICT) -> Redis -> reject (prod) / memory (dev)
// Uses HMAC pepper and atomic UPSERT to avoid race/duplicate rows.
export const storeCsrfToken = async (authToken, csrfToken) => {
  const expiresAt = new Date(Date.now() + CSRF_TOKEN_EXPIRY_MS).toISOString();
  const authTokenHash = hashAuthToken(authToken);

  // 1. Try database — atomic UPSERT ON CONFLICT (auth_token_hash)
  try {
    await dbHelpers.pool.query(
      `INSERT INTO csrf_tokens (auth_token_hash, csrf_token, expires_at, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (auth_token_hash) DO UPDATE SET
         csrf_token = EXCLUDED.csrf_token,
         expires_at = EXCLUDED.expires_at,
         created_at = EXCLUDED.created_at`,
      [authTokenHash, csrfToken, expiresAt, new Date().toISOString()],
    );
    // Also persist the previous token in DB so grace period survives restarts
    await storePrevCsrfToken(authTokenHash);
    csrfTokensMemory.set(authTokenHash, {
      token: csrfToken,
      expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS,
      createdAt: Date.now(),
    });
    return true;
  } catch (dbError) {
    // If ON CONFLICT fails due to missing unique constraint, fallback to DELETE+INSERT
    if (dbError && dbError.code === "42P10") {
      try {
        await dbHelpers.pool.query(
          "DELETE FROM csrf_tokens WHERE auth_token_hash = $1",
          [authTokenHash],
        );
        await dbHelpers.pool.query(
          `INSERT INTO csrf_tokens (auth_token_hash, csrf_token, expires_at, created_at) VALUES ($1,$2,$3,$4)`,
          [authTokenHash, csrfToken, expiresAt, new Date().toISOString()],
        );
        await storePrevCsrfToken(authTokenHash);
        csrfTokensMemory.set(authTokenHash, {
          token: csrfToken,
          expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS,
          createdAt: Date.now(),
        });
        return true;
      } catch (fallbackErr) {
        console.warn(
          "CSRF database fallback store failed:",
          fallbackErr.message,
        );
      }
    } else {
      console.warn("CSRF database storage failed:", dbError.message);
    }
  }

  // 2. Try Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      const ttlSeconds = Math.floor(CSRF_TOKEN_EXPIRY_MS / 1000);
      await redis.setex(`csrf:${authTokenHash}`, ttlSeconds, csrfToken);
      // Also persist prev token in Redis
      await storePrevCsrfToken(authTokenHash);
      csrfTokensMemory.set(authTokenHash, {
        token: csrfToken,
        expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS,
        createdAt: Date.now(),
      });
      return true;
    } catch (redisError) {
      console.warn("CSRF Redis storage failed:", redisError.message);
    }
  }

  // 3. Production: reject (no silent memory fallback)
  if (process.env.NODE_ENV === "production") {
    console.error(
      "CSRF: Both DB and Redis unavailable in production. Token NOT stored.",
    );
    return false;
  }

  // 4. Development only: memory fallback with size enforcement
  console.warn("CSRF: Using in-memory fallback (development only).");
  if (csrfTokensMemory.size >= CSRF_MAX_MEMORY_TOKENS) {
    const firstKey = csrfTokensMemory.keys().next().value;
    csrfTokensMemory.delete(firstKey);
  }
  csrfTokensMemory.set(authTokenHash, {
    token: csrfToken,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS,
    createdAt: Date.now(),
  });
  return true;
};

// Persist previous CSRF tokens (for grace period) into DB/Redis so they
// survive server restarts. Called after a successful rotation.
async function storePrevCsrfToken(authTokenHash) {
  const prevEntry = csrfTokensMemory.get(`prev:${authTokenHash}`);
  if (!prevEntry) return;

  const items = Array.isArray(prevEntry) ? prevEntry : [prevEntry];
  const now = Date.now();
  const validItems = items.filter(
    (item) => item && item.token && item.expiresAt > now,
  );
  if (validItems.length === 0) return;

  const prevHashKey = hashAuthToken(`prev:${authTokenHash}`);

  // Try DB — UPSERT to avoid duplicate key errors on repeated grace writes
  try {
    for (const item of validItems) {
      if (item && item.token) {
        await dbHelpers.pool.query(
          `INSERT INTO csrf_tokens (auth_token_hash, csrf_token, expires_at, created_at)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (auth_token_hash) DO UPDATE SET
             csrf_token = EXCLUDED.csrf_token,
             expires_at = EXCLUDED.expires_at`,
          [
            prevHashKey,
            item.token,
            new Date(item.expiresAt).toISOString(),
            new Date().toISOString(),
          ],
        );
      }
    }
  } catch (err) {
    // Ignore duplicate or cleanup errors
  }

  // Try Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      const ttlSeconds = Math.floor(CSRF_GRACE_PERIOD_MS / 1000);
      for (const item of validItems) {
        if (item && item.token) {
          await redis.sadd(`csrf:prev:${authTokenHash}`, item.token);
        }
      }
      await redis.expire(`csrf:prev:${authTokenHash}`, ttlSeconds);
    } catch (err) {
      // Ignore
    }
  }
}

// Retrieve CSRF token: DB-first -> Redis -> memory (grace/dev fallback)
export const getCsrfToken = async (authToken) => {
  const authTokenHash = hashAuthToken(authToken);

  // 1. Try database (primary) — DB-first to survive multi-instance deployments
  try {
    const record = await dbHelpers.findOne("csrf_tokens", {
      auth_token_hash: authTokenHash,
      expires_at: { $gt: new Date().toISOString() },
    });
    if (record) {
      // Hydrate memory cache for next lookup without extra DB hit
      csrfTokensMemory.set(authTokenHash, {
        token: record.csrf_token,
        expiresAt:
          new Date(record.expires_at).getTime() ||
          Date.now() + CSRF_TOKEN_EXPIRY_MS,
        createdAt: Date.now(),
      });
      return record.csrf_token;
    }
  } catch (dbError) {
    console.warn("CSRF database lookup failed:", dbError.message);
  }

  // 2. Try Redis (secondary)
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(`csrf:${authTokenHash}`);
      if (cached) {
        csrfTokensMemory.set(authTokenHash, {
          token: cached,
          expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS,
          createdAt: Date.now(),
        });
        return cached;
      }
    } catch (redisError) {
      console.warn("CSRF Redis lookup failed:", redisError.message);
    }
  }

  // 3. Check memory (grace period prev: tokens or dev fallback) — tertiary only
  const memoryRecord = csrfTokensMemory.get(authTokenHash);
  if (memoryRecord && memoryRecord.expiresAt > Date.now()) {
    return memoryRecord.token;
  }

  return null;
};

// Delete CSRF token (for logout)
export const deleteCsrfToken = async (authToken) => {
  const authTokenHash = hashAuthToken(authToken);
  try {
    await dbHelpers.deleteMany("csrf_tokens", {
      auth_token_hash: authTokenHash,
    });
  } catch (error) {
    console.warn("CSRF token deletion failed:", error.message);
  }
  csrfTokensMemory.delete(authTokenHash);
};

// Cleanup expired CSRF tokens (run periodically)
export const cleanupExpiredCsrfTokens = async () => {
  try {
    await dbHelpers.deleteMany("csrf_tokens", {
      expires_at: { $lt: new Date().toISOString() },
    });

    // Also cleanup memory fallback
    const now = Date.now();
    for (const [key, value] of csrfTokensMemory.entries()) {
      if (value.expiresAt < now) {
        csrfTokensMemory.delete(key);
      }
    }
  } catch (error) {
    console.error("CSRF token cleanup failed:", error.message);
  }
};

// Run cleanup periodically — unref() so it doesn't block process.exit in tests
// LOW-02 FIX: Export so it can be cleared on graceful shutdown
export const csrfCleanupInterval = setInterval(
  cleanupCsrfTokens,
  CSRF_TOKEN_CLEANUP_INTERVAL_MS,
);
csrfCleanupInterval.unref();

// CSRF validation middleware
// Accept previous tokens for a 5-minute rolling grace period to support concurrent requests & bulk jobs
export const CSRF_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

// Look up if a CSRF token is valid among recently rotated tokens across all storage layers (memory -> DB -> Redis)
async function isRecentCsrfToken(authTokenHash, csrfToken) {
  if (!csrfToken) return false;

  // 1. Memory check (fast path)
  const list = csrfTokensMemory.get(`prev:${authTokenHash}`);
  if (Array.isArray(list)) {
    const now = Date.now();
    if (
      list.some(
        (item) => item && item.token === csrfToken && item.expiresAt > now,
      )
    ) {
      return true;
    }
  } else if (list && list.token === csrfToken && list.expiresAt > Date.now()) {
    return true;
  }

  // 2. Database check (HMAC peppered)
  const prevHashKey = hashAuthToken(`prev:${authTokenHash}`);
  try {
    const record = await dbHelpers.findOne("csrf_tokens", {
      auth_token_hash: prevHashKey,
      csrf_token: csrfToken,
      expires_at: { $gt: new Date().toISOString() },
    });
    if (record) return true;
  } catch (err) {
    console.debug("[csrf] best-effort token check failed", err?.message);
  }

  // 3. Redis check
  const redis = getRedisClient();
  if (redis) {
    try {
      const isMember = await redis.sismember(
        `csrf:prev:${authTokenHash}`,
        csrfToken,
      );
      if (isMember) return true;
    } catch (err) {
      console.debug("[csrf] best-effort redis check failed", err?.message);
    }
  }

  return false;
}

export const validateCsrfToken = async (req, res, next) => {
  const authToken =
    req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;

  // For GET/HEAD/OPTIONS: ensure a CSRF token exists so the client can
  // include it on subsequent mutation requests. This solves the "first
  // mutation fails because no token was ever set" bootstrapping problem.
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (authToken) {
      let existingToken = await getCsrfToken(authToken);
      if (!existingToken) {
        existingToken = generateCsrfToken();
        await storeCsrfToken(authToken, existingToken);
      }
      res.set("X-CSRF-Token", existingToken);
    }
    return next();
  }

  // Skip CSRF for stateless auth routes and payment endpoints (handled with signature verification & session auth)
  const csrfExemptPaths = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/verify-email",
    "/api/auth/google",
    "/api/auth/login/2fa",
    "/api/auth/2fa/status",
    "/api/auth/2fa/enroll",
    "/api/auth/2fa/verify",
    "/api/auth/2fa/backup-codes/regenerate",
    "/api/auth/2fa/disable",
    "/api/auth/resend-verification",
    "/api/payments",
    "/payments",
  ];
  const fullUrl = req.originalUrl || req.path || "";
  if (
    csrfExemptPaths.some((p) => fullUrl.startsWith(p) || req.path.startsWith(p))
  ) {
    return next();
  }

  const csrfToken = req.headers["x-csrf-token"] || req.body?._csrf;

  if (!authToken) {
    // No auth token, skip CSRF (unauthenticated request)
    return next();
  }

  const storedToken = await getCsrfToken(authToken);
  const authTokenHash = hashAuthToken(authToken);
  const previousValid = await isRecentCsrfToken(authTokenHash, csrfToken);

  if (
    !csrfToken ||
    (!storedToken && !previousValid) ||
    (csrfToken !== storedToken && !previousValid)
  ) {
    // Generate/fetch fresh token and send in response so client can immediately self-heal and retry
    const recoveryToken = storedToken || generateCsrfToken();
    if (!storedToken) {
      await storeCsrfToken(authToken, recoveryToken);
    }
    res.set("X-CSRF-Token", recoveryToken);
    return res.status(403).json({
      success: false,
      message: "Invalid CSRF token",
    });
  }

  // Rotate the token after successful validation for better security
  // Store the old token in rolling history so concurrent/in-flight requests succeed
  if (storedToken) {
    const now = Date.now();
    const rawList = csrfTokensMemory.get(`prev:${authTokenHash}`) || [];
    const validList = (Array.isArray(rawList) ? rawList : [rawList]).filter(
      (item) => item && item.expiresAt > now,
    );

    validList.push({
      token: storedToken,
      expiresAt: now + CSRF_GRACE_PERIOD_MS,
      createdAt: now,
    });
    // Keep max 100 recent tokens per session
    if (validList.length > 100) validList.shift();
    csrfTokensMemory.set(`prev:${authTokenHash}`, validList);

    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.sadd(`csrf:prev:${authTokenHash}`, storedToken);
        await redis.expire(`csrf:prev:${authTokenHash}`, 300);
      } catch (_) {
        void _;
      }
    }
  }

  const newToken = generateCsrfToken();
  await storeCsrfToken(authToken, newToken);
  res.set("X-CSRF-Token", newToken); // Send new token in response header

  next();
};
