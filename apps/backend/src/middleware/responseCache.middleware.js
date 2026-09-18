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
// NOTE (unbounded-Map acceptance): entries are keyed by request URL and always
// removed via finish()/finishCold()/finishRefresh or the stale-timeout delete
// below, so the map holds at most one entry per concurrently-computing URL.
// No eviction is implemented by design — accepted: worst case is bounded by
// concurrent distinct URLs, not by traffic volume.
const inFlight = new Map();

// Bound barrier waits so a hung handler never parks waiters forever: race the
// barrier against a 12s timeout, and drop the stale barrier entry so later
// requests recompute instead of queueing behind a dead promise.
const awaitBarrier = async (barrier, ms = 12000) => {
  if (!barrier?.promise) return;
  let timer = null;
  try {
    await Promise.race([
      barrier.promise,
      new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

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
      // Key carries scope + path only — the namespace is applied once by
      // cacheService.toNamespacedKey, so the prefix must NOT be repeated here
      // (getCache(prefix, `${prefix}:…`) would double-count it).
      const key = `${userScope}:${requestPath}`;

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
          await awaitBarrier(barrier);
          const cached = await getCache(prefix, key).catch(() => null);
          if (cached !== null) {
            res.set("X-Cache", "HIT");
            return res.json(cached);
          }
        } catch {
          // fall through to run handler
        }
        // Stale barrier (timed out with no cache) — delete it so this request
        // becomes the new leader instead of queueing behind a dead promise.
        // Only delete when the entry is still this exact barrier (the leader
        // may have finished, or a newer barrier may already exist).
        if (inFlight.get(key) === barrier) {
          inFlight.delete(key);
        }
      }

      let release = null;
      const myBarrier = {
        promise: new Promise((resolve) => {
          release = resolve;
        }),
      };
      inFlight.set(key, myBarrier);

      // Guarded so the 'close' fallback below can never double-release the
      // barrier when res.json/res.send already ran. Streaming/sendFile
      // responses fire neither wrapper, so 'close' is their only release.
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        inFlight.delete(key);
        if (release) release();
      };
      res.on("close", finish);

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      res.json = (body) => {
        res.json = originalJson;
        res.send = originalSend;
        // Release the barrier only after the cache write settles (mirrors the
        // namespace branch below): releasing before setCache resolves lets a
        // waiter read before the write lands and duplicate the computation.
        if (res.statusCode < 400 && body && body.success !== false) {
          setCache(prefix, key, body, ttl)
            .catch(() => {})
            .finally(finish);
        } else {
          finish();
        }
        res.set("X-Cache", "MISS");
        return originalJson(body);
      };
      // Release the in-flight barrier on the res.send path too (non-JSON responses)
      res.send = (body) => {
        res.json = originalJson;
        res.send = originalSend;
        finish();
        return originalSend(body);
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
    // Key carries scope + path only — the namespace is applied once by
    // cacheService.toNamespacedKey (getCache(namespace, `${namespace}:…`)
    // would double-count it).
    const key = `${userScope}:${req.originalUrl || req.url}`;

    try {
      const cached = await getCache(namespace, key);
      if (cached !== null) {
        res.set("X-Cache", "HIT");
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
        await awaitBarrier(barrier);
        const cached = await getCache(namespace, key).catch(() => null);
        if (cached !== null) {
          res.set("X-Cache", "HIT");
          return res.json(cached);
        }
      } catch {
        // fall through to run the handler ourselves
      }
      // Stale barrier (timed out with no cache) — delete it so this request
      // becomes the new leader instead of queueing behind a dead promise.
      // Only delete when the entry is still this exact barrier.
      if (inFlight.get(key) === barrier) {
        inFlight.delete(key);
      }
    }

    let release = null;
    const myBarrier = {
      promise: new Promise((resolve) => {
        release = resolve;
      }),
    };
    inFlight.set(key, myBarrier);

    // Guarded so the 'close' fallback below can never double-release the
    // barrier when res.json/res.send already ran. Streaming/sendFile
    // responses fire neither wrapper, so 'close' is their only release.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      inFlight.delete(key);
      if (release) release();
    };
    res.on("close", finish);

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    res.json = (body) => {
      // Restore the original so it is only wrapped once.
      res.json = originalJson;
      res.send = originalSend;
      if (res.statusCode < 400 && body && body.success !== false) {
        setCache(namespace, key, body, ttlSeconds)
          .catch(() => {})
          .finally(finish);
      } else {
        finish();
      }
      res.set("X-Cache", "MISS");
      return originalJson(body);
    };
    // Release the in-flight barrier on the res.send path too (non-JSON responses)
    res.send = (body) => {
      res.json = originalJson;
      res.send = originalSend;
      finish();
      return originalSend(body);
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
    // `swr:` marker kept so SWR envelopes never collide with plain bodies
    // under the same namespace; the namespace itself is applied once by
    // cacheService.toNamespacedKey.
    const key = `swr:${userScope}:${req.originalUrl || req.url}`;

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
        // Replace res.json/res.send so the downstream handler's response is
        // captured for the cache refresh but NOT written to the already-ended
        // response.
        const finishRefresh = () => {
          swrInFlight.delete(key);
        };
        res.json = (body) => {
          res.json = () => {};
          res.send = () => res;
          if (res.statusCode < 400 && body && body.success !== false) {
            setCache(namespace, key, { cachedAt: Date.now(), body }, staleTtl)
              .catch(() => {})
              .finally(finishRefresh);
          } else {
            finishRefresh();
          }
          return res;
        };
        res.send = (body) => {
          res.json = () => {};
          res.send = () => res;
          finishRefresh();
          return res;
        };
        // Fallback release for the stale-refresh run: if downstream throws
        // synchronously or never calls res.json/res.send (e.g. a sendFile /
        // streaming path), the swrInFlight key must not leak. Set.delete is
        // idempotent so this can never double-release a normal refresh.
        // NOTE: try/finally around next() would release the key immediately
        // (before the async downstream completes) and defeat in-flight
        // tracking — so only sync throws are caught here; async completion
        // releases via the wrappers above, hangs via 'close' below.
        res.on("close", finishRefresh);
        try {
          return next();
        } catch (err) {
          finishRefresh();
          throw err;
        }
      }

      // A refresh is already in flight for this key; the stale copy was served.
      return;
    }

    // Cold cache — run the handler and capture a fresh envelope.
    if (swrInFlight.has(key)) {
      // Another request is computing this exact entry right now; wait briefly
      // (bounded) for it rather than running a duplicate expensive query.
      res.set("X-Cache", "WAIT");
      let timer = null;
      try {
        await Promise.race([
          (async () => {
            while (swrInFlight.has(key)) {
              await new Promise((r) => setTimeout(r, 50));
            }
          })(),
          new Promise((resolve) => {
            timer = setTimeout(resolve, 2000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const raced = await getCache(namespace, key).catch(() => null);
      if (raced && typeof raced.cachedAt === "number") {
        res.set("X-Cache", "HIT");
        return res.json(raced.body);
      }
    }

    swrInFlight.add(key);
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const finishCold = () => {
      swrInFlight.delete(key);
    };
    res.json = (body) => {
      res.json = originalJson;
      res.send = originalSend;
      if (res.statusCode < 400 && body && body.success !== false) {
        setCache(namespace, key, { cachedAt: Date.now(), body }, staleTtl)
          .catch(() => {})
          .finally(finishCold);
      } else {
        finishCold();
      }
      return originalJson(body);
    };
    res.send = (body) => {
      res.json = originalJson;
      res.send = originalSend;
      finishCold();
      return originalSend(body);
    };
    next();
  };
};

export default responseCache;
