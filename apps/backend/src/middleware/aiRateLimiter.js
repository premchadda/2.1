import { getRedisClient } from '../infrastructure/cache/redisClient.js'
import logger from '../infrastructure/logger/logger.js'

/**
 * Per-user AI rate limiter — uses Redis sliding-window counters.
 *
 * Limits:
 *   - Free users: AI_FREE_HOURLY_LIMIT (default 50) requests/hour
 *   - Pro users:  AI_PRO_HOURLY_LIMIT  (default 500) requests/hour
 *
 * Falls open (allows the request) if Redis is unavailable, on the assumption
 * that a degraded AI experience is better than a 500. Logs loudly when this
 * happens so ops can notice.
 *
 * Usage:
 *   router.post('/generate', protect, aiRateLimiter, handler)
 */
export const aiRateLimiter = async (req, res, next) => {
  // Skip in test environment for fast tests.
  if (process.env.NODE_ENV === 'test') return next()

  const redis = getRedisClient()
  if (!redis) {
    logger.warn('[AI RateLimiter] Redis unavailable — failing open (degraded mode)')
    return next()
  }

  const userId = req.user?.id
  if (!userId) return next() // unauthenticated requests handled by `protect`

  const isPro = req.user.isProUser === true
  const limit = isPro
    ? parseInt(process.env.AI_PRO_HOURLY_LIMIT || '500', 10)
    : parseInt(process.env.AI_FREE_HOURLY_LIMIT || '50', 10)

  const windowKey = Math.floor(Date.now() / 3_600_000) // hour bucket
  const key = `ai:rate:${userId}:${windowKey}`

  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, 3600) // TTL = 1 hour
    }

    if (count > limit) {
      const retryAfter = 3600 - (Math.floor(Date.now() / 1000) % 3600)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({
        success: false,
        message: `AI request limit reached (${limit}/hour for ${isPro ? 'Pro' : 'Free'} users). Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        code: 'AI_RATE_LIMIT_EXCEEDED',
        limit,
        remaining: 0,
        retryAfter,
      })
    }

    // Attach remaining quota to response locals so handlers can include it
    res.locals.aiRateLimit = {
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: (windowKey + 1) * 3600 * 1000,
    }

    next()
  } catch (err) {
    logger.error('[AI RateLimiter] Redis error — failing open:', err.message)
    next()
  }
}

export default aiRateLimiter
