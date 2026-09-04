import {
  getRedisClient,
  isRedisReady,
  recordRedisFailure,
  recordRedisSuccess,
} from "./redisClient.js";
import fs from "fs";
import path from "path";

const localCache = new Map();
const LOCAL_CACHE_MAX = 1000;
const MEMORY_CACHE_TTL = 5 * 60 * 1000;
const CACHE_IO_TIMEOUT_MS = Math.min(
  Math.max(Number.parseInt(process.env.CACHE_IO_TIMEOUT_MS, 10) || 100, 10),
  1000,
);

const toNamespacedKey = (namespace, key) => `${namespace}:${key}`;

let hasLoggedMemoryFallbackWarning = false;

const logMemoryFallbackWarningIfNeeded = () => {
  if (
    !hasLoggedMemoryFallbackWarning &&
    process.env.NODE_ENV === "production"
  ) {
    hasLoggedMemoryFallbackWarning = true;
    console.warn(
      "[Cache] WARNING: Redis is unavailable. Falling back to local in-memory cache. This will cause cache incoherence in multi-instance deployments.",
    );
  }
};

// ============================================================
// File-backed cache persistence (dev/non-Redis only).
// ------------------------------------------------------------
// In dev Redis is usually not configured, so the in-memory Map cache is wiped
// on every `node --watch` restart. That forces every dashboard/landing request
// to re-run its (slow) cold DB query right after a restart — the dominant cause
// of the multi-second "304" spikes. Persisting the cache to a JSON file lets it
// survive restarts. Entries are still TTL-bounded, so staleness is limited.
// Disabled in production and when Redis is present (Redis is the source of truth
// there). Opt out with FILE_CACHE_ENABLED=false.
// NOTE: This is a function (not a const) because isRedisReady() is false at
// module load time — Redis hasn't been initialized yet. Checking at call time
// ensures file cache is disabled once Redis connects.
// ============================================================
const isFileCacheEnabled = () =>
  !isRedisReady() &&
  process.env.NODE_ENV !== "production" &&
  process.env.FILE_CACHE_ENABLED !== "false";

const FILE_CACHE_PATH =
  process.env.FILE_CACHE_PATH ||
  path.join(process.cwd(), ".cache", "response-cache.json");

let fileCacheLoaded = false;
let flushTimer = null;

const loadFileCache = () => {
  if (fileCacheLoaded) return;
  fileCacheLoaded = true;
  if (!isFileCacheEnabled()) return;
  try {
    if (fs.existsSync(FILE_CACHE_PATH)) {
      const raw = fs.readFileSync(FILE_CACHE_PATH, "utf8");
      const obj = JSON.parse(raw);
      const now = Date.now();
      let restored = 0;
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v.expiresAt === "number" && v.expiresAt > now) {
          localCache.set(k, v);
          restored += 1;
        }
      }
      if (restored > 0) {
        console.log(
          `[Cache] Restored ${restored} cached entries from ${FILE_CACHE_PATH}`,
        );
      }
    }
  } catch (err) {
    // Corrupt/unreadable cache file — start fresh, never fatal.
    console.warn(
      "[Cache] Could not load file cache, starting empty:",
      err.message,
    );
  }
};

const flushFileCache = () => {
  if (!isFileCacheEnabled()) return;
  try {
    const dir = path.dirname(FILE_CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = {};
    const now = Date.now();
    for (const [k, v] of localCache) {
      if (v && typeof v.expiresAt === "number" && v.expiresAt > now) obj[k] = v;
    }
    fs.writeFileSync(FILE_CACHE_PATH, JSON.stringify(obj));
  } catch (err) {
    console.warn("[Cache] Failed to flush file cache:", err.message);
  }
};

const scheduleFlush = () => {
  if (flushTimer || !isFileCacheEnabled()) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushFileCache();
  }, 2000);
  if (typeof flushTimer.unref === "function") flushTimer.unref();
};

// Best-effort flush so a clean shutdown (Ctrl-C, deploy) doesn't lose the cache.
const flushOnExit = () => flushFileCache();
process.once("SIGINT", flushOnExit);
process.once("SIGTERM", flushOnExit);

function setMemoryCache(key, value, ttlMs = MEMORY_CACHE_TTL) {
  if (localCache.size >= LOCAL_CACHE_MAX) {
    const firstKey = localCache.keys().next().value;
    localCache.delete(firstKey);
  }
  localCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (isFileCacheEnabled()) scheduleFlush();
}

function getMemoryCache(key) {
  const entry = localCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localCache.delete(key);
    return null;
  }
  return entry.value;
}

const LOCAL_CACHE_CLEANUP_MS = 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of localCache) {
    if (now > val.expiresAt) {
      localCache.delete(key);
    }
  }
}, LOCAL_CACHE_CLEANUP_MS);

cleanupTimer.unref();

const parseCachedValue = (value) => {
  if (value == null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serializeCachedValue = (value) => {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
};

const withCacheTimeout = (promise, fallback) =>
  Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(() => resolve(fallback), CACHE_IO_TIMEOUT_MS),
    ),
  ]);

export const getCache = async (namespace, key) => {
  const cacheKey = toNamespacedKey(namespace, key);

  if (isFileCacheEnabled()) loadFileCache();

  // 1. Check L1 in-memory cache first (0.001ms)
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // 2. Check L2 Redis only if L1 missed and Redis is ready
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      try {
        let timedOut = false;
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => {
            timedOut = true;
            resolve(null);
          }, CACHE_IO_TIMEOUT_MS),
        );
        const value = await Promise.race([redis.get(cacheKey), timeoutPromise]);
        if (timedOut) {
          recordRedisFailure();
          return null;
        }
        const parsed = parseCachedValue(value);
        if (parsed !== null) {
          recordRedisSuccess();
          setMemoryCache(cacheKey, parsed, 300 * 1000); // Warm L1 for 5 mins
          return parsed;
        }
      } catch {
        recordRedisFailure();
        return null;
      }
    }
  }

  return null;
};

export const setCache = async (namespace, key, value, ttlSeconds = 300) => {
  const cacheKey = toNamespacedKey(namespace, key);

  // 1. Always store in L1 in-memory cache immediately
  setMemoryCache(cacheKey, value, ttlSeconds * 1000);

  // 2. Asynchronously update L2 Redis without blocking the caller
  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      withCacheTimeout(
        redis.set(cacheKey, serializeCachedValue(value), "EX", ttlSeconds),
        false,
      ).catch(() => {});
    }
  }

  return true;
};

export const deleteCache = async (namespace, key) => {
  const cacheKey = toNamespacedKey(namespace, key);
  localCache.delete(cacheKey);

  if (typeof isRedisReady === "function" && isRedisReady()) {
    const redis = getRedisClient();
    if (redis) {
      redis.del(cacheKey).catch(() => {});
    }
  }
};

export const deleteCacheByPrefix = async (namespace, prefix = "") => {
  const namespacedPrefix = toNamespacedKey(namespace, prefix);

  if (isRedisReady()) {
    const redis = getRedisClient();
    let cursor = "0";
    const keys = [];
    do {
      const [newCursor, foundKeys] = await redis.scan(
        cursor,
        "MATCH",
        `${namespacedPrefix}*`,
        "COUNT",
        100,
      );
      cursor = newCursor;
      keys.push(...foundKeys);
    } while (cursor !== "0");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  }

  logMemoryFallbackWarningIfNeeded();
  let deleted = 0;
  for (const key of localCache.keys()) {
    if (key.startsWith(namespacedPrefix)) {
      localCache.delete(key);
      deleted += 1;
    }
  }
  return deleted;
};

export const cacheWithFallback = async (
  namespace,
  key,
  ttlSeconds,
  resolver,
) => {
  const cached = await getCache(namespace, key);
  if (cached !== null) {
    return {
      value: cached,
      hit: true,
    };
  }

  const value = await resolver();
  await setCache(namespace, key, value, ttlSeconds);
  return {
    value,
    hit: false,
  };
};

export const clearCache = deleteCacheByPrefix;
