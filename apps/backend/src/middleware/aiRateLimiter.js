import { getRedisClient } from '../infrastructure/cache/redisClient.js'
import logger from '../infrastructure/logger/logger.js'

/**
 * Per-user AI rate limiter — Redis fixed-window (hour-bucket) counters with an
 * in-memory per-process fallback.
 *
 * Limits:
 *   - Free users: AI_FREE_HOURLY_LIMIT (default 50) requests/hour
 *   - Pro users:  AI_PRO_HOURLY_LIMIT  (default 500) requests/hour
 *
 * Redis outage no longer means unlimited spend: a per-process fallback counter
 * enforces the same limits (per instance — slightly stricter in aggregate
 * across N replicas, which is the safe direction). Test env skips only unless
 * AI_RATE_LIMIT_ENFORCE=true (a staging/preview process accidentally running
 * with NODE_ENV=test must not disable all AI caps).
 *
 * Usage:
 *   router.post('/generate', protect, aiRateLimiter, handler)
 */

// Per-process fallback buckets: key -> { count, resetAt }. Bounded size.
const fallbackBuckets = new Map()
const FALLBACK_MAX_KEYS = 10000

const checkFallbackLimit = (userId, limit) => {
  const bucket = Math.floor(Date.now() / 3_600_000)
  const key = `${userId}:${bucket}`
  const now = Date.now()
  for (const [k, v] of fallbackBuckets) {
    if (v.resetAt <= now || fallbackBuckets.size > FALLBACK_MAX_KEYS) fallbackBuckets.delete(k)
    else break
  }
  let entry = fallbackBuckets.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: (bucket + 1) * 3_600_000 }
    fallbackBuckets.set(key, entry)
  }
  entry.count += 1
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}

const exceeded = (res, { limit, isPro, retryAfter, degraded = false }) => {
  res.set('Retry-After', String(retryAfter))
  return res.status(429).json({
    success: false,
    message: `AI request limit reached (${limit}/hour for ${isPro ? 'Pro' : 'Free'} users). Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
    code: 'AI_RATE_LIMIT_EXCEEDED',
    limit,
    remaining: 0,
    retryAfter,
    ...(degraded ? { degraded: true } : {}),
  })
}

export const aiRateLimiter = async (req, res, next) => {
  // Admin bypass per product requirement — verified admin sessions not AI-limited (single-admin model).
  if (req.user?.isAdmin === true || req.user?.role === 'admin') return next()
  // Skip in test environment for fast tests — unless explicitly enforced.
  if (process.env.NODE_ENV === 'test' && process.env.AI_RATE_LIMIT_ENFORCE !== 'true') return next()

  const userId = req.user?.id
  if (!userId) return next() // unauthenticated requests handled by `protect`

  const isPro = req.user.isProUser === true
  // parseInt(undefined/""/garbage) is NaN — fall back to defaults instead of
  // enforcing a NaN cap (every comparison against NaN misbehaves).
  const parseLimit = (raw, fallback) => {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  const limit = isPro
    ? parseLimit(process.env.AI_PRO_HOURLY_LIMIT, 500)
    : parseLimit(process.env.AI_FREE_HOURLY_LIMIT, 50)

  const windowKey = Math.floor(Date.now() / 3_600_000) // fixed hour bucket (not sliding)
  const key = `ai:rate:${userId}:${windowKey}`

  const useFallback = (reason) => {
    // Degraded but still capped: per-process fallback (safe direction).
    logger.warn(`[AI RateLimiter] ${reason} — per-process fallback caps active`)
    const fb = checkFallbackLimit(userId, limit)
    if (!fb.allowed) {
      const retryAfter = Math.max(1, Math.ceil((fb.resetAt - Date.now()) / 1000))
      return exceeded(res, { limit, isPro, retryAfter, degraded: true })
    }
    res.locals.aiRateLimit = { limit, remaining: fb.remaining, resetAt: fb.resetAt, degraded: true }
    return next()
  }

  const redis = getRedisClient()
  if (!redis) return useFallback('Redis unavailable')

  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, 3600) // TTL = 1 hour
    }

    if (count > limit) {
      const retryAfter = 3600 - (Math.floor(Date.now() / 1000) % 3600)
      return exceeded(res, { limit, isPro, retryAfter })
    }

    // Attach remaining quota to response locals so handlers can include it
    res.locals.aiRateLimit = {
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: (windowKey + 1) * 3600 * 1000,
    }

    next()
  } catch (err) {
    return useFallback(`Redis error: ${err.message}`)
  }
}

export default aiRateLimiter
