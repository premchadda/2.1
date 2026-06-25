import rateLimit from 'express-rate-limit'

const RATE_LIMITS = Object.freeze({
  strict: { windowMs: 60 * 1000, max: 5, label: 'strict' },
  moderate: { windowMs: 60 * 1000, max: 30, label: 'moderate' },
  relaxed: { windowMs: 60 * 1000, max: 60, label: 'relaxed' },
  generous: { windowMs: 15 * 60 * 1000, max: 1000, label: 'generous' },
})

export const createRateLimiter = (tier = 'generous') => {
  const config = RATE_LIMITS[tier] || RATE_LIMITS.generous
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      success: false,
      message: `Too many requests (${config.label} limit), please try again later.`,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'development',
  })
}

export const RATE_LIMIT_TIERS = Object.keys(RATE_LIMITS).reduce((acc, key) => {
  acc[key] = createRateLimiter(key)
  return acc
}, {})
