import {
  getRedisClient,
  isRedisReady,
} from "../infrastructure/cache/redisClient.js";

const CACHE_READ_TIMEOUT_MS = Math.min(
  Math.max(
    Number.parseInt(process.env.RESPONSE_CACHE_TIMEOUT_MS, 10) || 750,
    100,
  ),
  5000,
);

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

const responseCache = (options = {}) => {
  const {
    ttl = 300,
    prefix = "res:",
    excludePaths = ["/api/auth", "/api/users", "/api/me", "/api/sessions"],
    includePaths = [],
  } = options;

  return async (req, res, next) => {
    if (req.method !== "GET") return next();
    // When this middleware is mounted at /api, Express removes that prefix
    // from req.path. Match both forms so /api/auth and /api/me are genuinely
    // excluded instead of accidentally entering the shared cache.
    const requestPath = req.originalUrl || req.url || req.path;
    const pathWithoutQuery = requestPath.split("?")[0];
    const matchesPath = (candidate) =>
      pathWithoutQuery.startsWith(candidate) || req.path.startsWith(candidate);
    if (excludePaths.some(matchesPath)) return next();
    if (includePaths.length > 0 && !includePaths.some(matchesPath))
      return next();

    // Redis is an optimisation only. Never queue a request behind a client
    // that is connecting/reconnecting; the route can execute normally.
    const redis = getRedisClient();
    if (!redis || !isRedisReady()) return next();

    // SECURITY FIX (H3): scope cache entries to the authenticated user so a
    // response cached for one user is never served to another. Public/anon
    // requests share a single global entry.
    const userScope = req.user?.id ? `u:${req.user.id}:` : "";
    const cacheKey = `${prefix}${userScope}${requestPath}`;
    try {
      const cached = await withTimeout(
        redis.get(cacheKey),
        CACHE_READ_TIMEOUT_MS,
      );
      if (cached) {
        res.set("X-Cache", "HIT");
        return res.json(JSON.parse(cached));
      }
    } catch {
      // Cache failures must be invisible to the API. Continue to the handler.
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body) {
        // Do not make the response wait for cache persistence.
        redis.setex(cacheKey, ttl, JSON.stringify(body)).catch(() => {});
      }
      res.set("X-Cache", "MISS");
      return originalJson(body);
    };

    next();
  };
};

export default responseCache;
