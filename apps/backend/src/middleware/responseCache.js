import { getRedisClient } from '../infrastructure/cache/redisClient.js';

const responseCache = (options = {}) => {
  const {
    ttl = 300,
    prefix = 'res:',
    excludePaths = ['/api/auth', '/api/users', '/api/me', '/api/sessions'],
    includePaths = []
  } = options;

  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (excludePaths.some(p => req.path.startsWith(p))) return next();
    if (includePaths.length > 0 && !includePaths.some(p => req.path.startsWith(p))) return next();

    const redis = getRedisClient();
    if (!redis) return next();

    // SECURITY FIX (H3): scope cache entries to the authenticated user so a
    // response cached for one user is never served to another. Public/anon
    // requests share a single global entry.
    const userScope = req.user?.id ? `u:${req.user.id}:` : '';
    const cacheKey = `${prefix}${userScope}${req.originalUrl}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      console.error('[ResponseCache] Redis get error:', err.message);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200 && body) {
        redis.setex(cacheKey, ttl, JSON.stringify(body)).catch(() => {});
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
};

export default responseCache;