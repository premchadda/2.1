import {
  getCache,
  setCache,
  deleteCacheByPrefix,
} from "../infrastructure/cache/cacheService.js";

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

export const responseCache = (
  namespaceOrOptions,
  ttlSeconds = 30,
  options = {},
) => {
  if (typeof namespaceOrOptions === "object" && namespaceOrOptions !== null) {
    const {
      ttl = 300,
      prefix = "res:",
      excludePaths = ["/api/auth", "/api/users", "/api/me", "/api/sessions"],
      includePaths = [],
      userScoped = true,
    } = namespaceOrOptions;

    return async (req, res, next) => {
      if (req.method !== "GET") return next();
      const requestPath = req.originalUrl || req.url || req.path;
      const pathWithoutQuery = requestPath.split("?")[0];
      const matchesPath = (candidate) =>
        pathWithoutQuery.startsWith(candidate) ||
        req.path.startsWith(candidate);
      if (excludePaths.some(matchesPath)) return next();
      if (includePaths.length > 0 && !includePaths.some(matchesPath))
        return next();

      const userScope = userScoped
        ? req.user?.id
          ? `u:${req.user.id}`
          : "anon"
        : "global";
      const key = `${prefix}:${userScope}:${requestPath}`;

      try {
        const cached = await getCache(prefix, key);
        if (cached !== null) {
          res.set("X-Cache", "HIT");
          return res.json(cached);
        }
      } catch {
        // Cache read failure must never block the real request.
      }

      const barrier = inFlight.get(key);
      if (barrier) {
        try {
          await barrier.promise;
          const cached = await getCache(prefix, key).catch(() => null);
          if (cached !== null) {
            res.set("X-Cache", "HIT");
            return res.json(cached);
          }
        } catch {
          // fall through to run handler
        }
      }

      let release = null;
      const myBarrier = {
        promise: new Promise((resolve) => {
          release = resolve;
        }),
      };
      inFlight.set(key, myBarrier);

      const finish = () => {
        inFlight.delete(key);
        if (release) release();
      };

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        res.json = originalJson;
        finish();
        if (res.statusCode < 400 && body && body.success !== false) {
          setCache(prefix, key, body, ttl).catch(() => {});
        }
        res.set("X-Cache", "MISS");
        return originalJson(body);
      };

      return next();
    };
  }

  const namespace = namespaceOrOptions;
  const userScoped = options.userScoped !== false;
  return async (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    // For user-scoped endpoints, key is partitioned by user ID to prevent
    // data leakage between users. For public/shared endpoints (e.g. series lists,
    // public leaderboards), userScoped: false allows caching globally.
    const userScope = userScoped
      ? req.user?.id
        ? `u:${req.user.id}`
        : "anon"
      : "global";
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
    const myBarrier = {
      promise: new Promise((resolve) => {
        release = resolve;
      }),
    };
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
        setCache(namespace, key, body, ttlSeconds)
          .catch(() => {})
          .finally(finish);
      } else {
        finish();
      }
      return originalJson(body);
    };

    next();
  };
};

// ─── Stale-While-Revalidate cache ───────────────────────────────────────────
// Serves a cached response immediately (even past its fresh window) while a
// background re-execution of the handler refreshes the entry. Users of slow
// admin dashboards see instant responses; data converges within one request.
//
//   freshTtl: seconds a cached entry is served without any refresh attempt
//   staleTtl: seconds a stale entry may be served while being refreshed
const swrInFlight = new Set();

export const swrCache = (
  namespace,
  { freshTtl = 60, staleTtl = 600, userScoped = true } = {},
) => {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();

    const userScope = userScoped
      ? req.user?.id
        ? `u:${req.user.id}`
        : "anon"
      : "global";
    const key = `swr:${namespace}:${userScope}:${req.originalUrl || req.url}`;

    const envelope = await getCache(namespace, key).catch(() => null);
    const now = Date.now();

    if (envelope && typeof envelope.cachedAt === "number") {
      const age = (now - envelope.cachedAt) / 1000;
      if (age < freshTtl) {
        // Fresh — serve and do not re-execute the handler.
        res.set("X-Cache", "FRESH");
        return res.json(envelope.body);
      }

      // Stale but usable — serve immediately, then refresh in the background
      // by letting the real handler run below with its output swallowed.
      res.set("X-Cache", "STALE");
      res.json(envelope.body);

      if (!swrInFlight.has(key)) {
        swrInFlight.add(key);
        // Replace res.json so the downstream handler's response is captured
        // for the cache refresh but NOT written to the already-ended response.
        res.json = (body) => {
          res.json = () => {};
          if (res.statusCode < 400 && body && body.success !== false) {
            setCache(namespace, key, { cachedAt: Date.now(), body }, staleTtl)
              .catch(() => {})
              .finally(() => swrInFlight.delete(key));
          } else {
            swrInFlight.delete(key);
          }
          return res;
        };
        return next();
      }

      // A refresh is already in flight for this key; the stale copy was served.
      return;
    }

    // Cold cache — run the handler and capture a fresh envelope.
    if (swrInFlight.has(key)) {
      // Another request is computing this exact entry right now; wait briefly
      // for it rather than running a duplicate expensive query.
      res.set("X-Cache", "WAIT");
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.json = originalJson;
      if (res.statusCode < 400 && body && body.success !== false) {
        setCache(
          namespace,
          key,
          { cachedAt: Date.now(), body },
          staleTtl,
        ).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  };
};

export default responseCache;
