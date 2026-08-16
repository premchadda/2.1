import { getCache, setCache, deleteCacheByPrefix } from "../infrastructure/cache/cacheService.js";

/**
 * Invalidate all response cache entries for a given namespace
 */
export const invalidateResponseCache = async (namespace) => {
  try {
    await deleteCacheByPrefix(namespace);
  } catch (err) {
    // Non-fatal
  }
};

/**
 * Response-level cache for expensive, non-user-specific GET endpoints
 * (e.g. admin dashboard stats/analytics/recent-activity).
 *
 * The backing cacheService uses Redis when available and falls back to an
 * in-memory Map, so this is safe in single-instance dev (Redis not configured)
 * and coherent in production (Redis). The cache key includes the full URL
 * (path + query string), so e.g. ?range=7d and ?range=30d are cached separately.
 *
 * Cached bodies are only stored for successful (status < 400) responses, so
 * error responses never poison the cache. Cache misses execute the real
 * handler exactly once, then the response is captured and stored.
 */
// In-flight dedup: concurrent GET requests for the same key share a single
// expensive handler execution instead of all running it at once (which used to
// exhaust the connection pool and cause 504s on endpoints like /api/study).
const inFlight = new Map();

export const responseCache = (namespace, ttlSeconds = 30) => {
  return async (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    // SECURITY FIX (H3): For authenticated requests the cache key MUST be
    // scoped to the user, otherwise a cached response for user A can be served
    // to user B on shared per-user endpoints (e.g. /api/auth/me,
    // /api/users/analytics). When no authenticated user is present the key
    // stays global so public endpoints still share a single cache entry.
    const userScope = req.user?.id ? `u:${req.user.id}` : "anon";
    const key = `${namespace}:${userScope}:${req.originalUrl || req.url}`;

    try {
      const cached = await getCache(namespace, key);
      if (cached !== null) {
        return res.json(cached);
      }
    } catch {
      // Cache read failure must never block the real request.
    }

    // If a request for this key is already being computed, wait for it and
    // then serve from cache instead of re-running the handler.
    const barrier = inFlight.get(key);
    if (barrier) {
      try {
        await barrier.promise;
        const cached = await getCache(namespace, key).catch(() => null);
        if (cached !== null) {
          return res.json(cached);
        }
      } catch {
        // fall through to run the handler ourselves
      }
    }

    let release = null;
    const myBarrier = { promise: new Promise((resolve) => { release = resolve; }) };
    inFlight.set(key, myBarrier);

    const finish = () => {
      inFlight.delete(key);
      if (release) release();
    };

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Restore the original so it is only wrapped once.
      res.json = originalJson;
      if (res.statusCode < 400 && body && body.success !== false) {
        setCache(namespace, key, body, ttlSeconds).catch(() => {}).finally(finish);
      } else {
        finish();
      }
      return originalJson(body);
    };

    next();
  };
};

export default responseCache;
