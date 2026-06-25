import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { dbHelpers } from '../infrastructure/database/postgres-helpers.js'
import { getRedisClient } from '../infrastructure/cache/redisClient.js'

// Rate limiter for authentication endpoints
// In production: 20 attempts per 15 minutes (account lockout also applies)
// In development: more permissive to avoid blocking tests
const isProduction = process.env.NODE_ENV === 'production'
const AUTH_RATE_LIMIT_WINDOW_MS = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10)
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || (isProduction ? '20' : '10000'), 10)

export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})


export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
}

export const isHigherRole = (userRole, requiredRole) => {
  const roleHierarchy = {
    [ROLES.USER]: 1,
    [ROLES.ADMIN]: 2,
    [ROLES.SUPER_ADMIN]: 3,
  }
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0)
}

// Protect routes - verify JWT token
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export const protect = async (req, res, next) => {
  let token
  try {
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      })
    }

    // SEC-01: JWT_SECRET is validated at startup (app-port5001.js:99-109).
    // No per-request check needed — the app won't start without it.

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // SESSION-SEC: Verify session is still active if token contains sessionId
    // (sessionId is embedded in JWT at login via auth.controller.js)
    if (decoded.sessionId) {
      // P0 SEC-02: Cache session state in Redis to avoid N+1 DB hits per request.
      const redis = getRedisClient()
      let cached = null
      if (redis) {
        cached = await redis.get(`session:${decoded.sessionId}`)
      }
      if (cached !== null) {
        const session = JSON.parse(cached)
        if (!session.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Your session has been revoked. Please log in again.',
          })
        }
      } else {
        // Cache miss — fall back to DB and hydrate Redis cache.
        try {
          const sessionCheck = await dbHelpers.pool.query(
            'SELECT is_active FROM user_sessions WHERE session_id = $1 OR id::text = $1',
            [String(decoded.sessionId)]
          )
          if (sessionCheck.rows.length === 0 || !sessionCheck.rows[0].is_active) {
            return res.status(401).json({
              success: false,
              message: 'Your session has been revoked. Please log in again.',
            })
          }
          // Cache session for 5 minutes to amortize future lookups.
          if (redis) {
            await redis.set(`session:${decoded.sessionId}`, JSON.stringify({ isActive: true }), 'EX', 300)
          }
        } catch (sessionErr) {
          // Graceful degradation — session table may not exist yet.
          console.warn('[Auth] Session validation query failed (non-fatal):', sessionErr.message)
        }
      }
    }

    const user = await dbHelpers.findById('users', decoded.id)

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found',
      })
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      })
    }

    // LOW-01 FIX: Check both field name variants (emailVerified / isEmailVerified)
    // Google OAuth users have isEmailVerified: true; the field name depends on the DB adapter
    const isVerified = user.isEmailVerified ?? user.emailVerified ?? false
    if (isVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email to continue.',
      })
    }

    const { password, ...userWithoutPassword } = user
    const isAdmin = user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN
    const isSuperAdmin = user.role === ROLES.SUPER_ADMIN

    req.user = {
      ...userWithoutPassword,
      isAdmin,
      isSuperAdmin,
      role: user.role,
      sessionId: decoded.sessionId || null,  // Forward session ID so logout/revoke can target it
    }
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed',
    })
  }
}

export const auth = protect

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
export const optionalAuth = async (req, res, next) => {
  let token
  try {
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    } else if (req.cookies?.token) {
      token = req.cookies.token
    }

    if (token && process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      // SESSION-SEC: Verify session is still active for optional auth too
      let sessionValid = true
      if (decoded.sessionId) {
        const redis = getRedisClient()
        let cached = null
        if (redis) {
          cached = await redis.get(`session:${decoded.sessionId}`)
        }
        if (cached !== null) {
          const session = JSON.parse(cached)
          if (!session.isActive) sessionValid = false
        } else {
          try {
            const sessionCheck = await dbHelpers.pool.query(
              'SELECT is_active FROM user_sessions WHERE session_id = $1 OR id::text = $1',
              [String(decoded.sessionId)]
            )
            if (sessionCheck.rows.length === 0 || !sessionCheck.rows[0].is_active) {
              sessionValid = false
            }
          } catch (_) {
            // Graceful degradation — session table may not exist
          }
        }
      }

      if (!sessionValid) {
        return next() // Treat as unauthenticated — don't attach user
      }

      const user = await dbHelpers.findById('users', decoded.id)
      const isVerified = user ? (user.isEmailVerified ?? user.emailVerified ?? false) : false
      if (user && user.isActive !== false && isVerified === true) {
        const { password, ...userWithoutPassword } = user
        req.user = {
          ...userWithoutPassword,
          isAdmin: user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN,
          isSuperAdmin: user.role === ROLES.SUPER_ADMIN,
          role: user.role,
          sessionId: decoded.sessionId || null,
        }
      }
    }

    next()
  } catch (error) {
    // SEC-03: Differentiate error types so frontend can distinguish
    // "logged out" from "session expired" or "token tampered".
    if (error instanceof jwt.TokenExpiredError) {
      req.authError = 'token_expired'
    } else if (error instanceof jwt.JsonWebTokenError) {
      req.authError = 'invalid_token'
    }
    next()
  }
}

export const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: 'Not authorized as admin',
    })
  }
}

export const superAdmin = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: 'Not authorized as super admin',
    })
  }
}

export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      })
    }

    if (isHigherRole(req.user.role, requiredRole)) {
      next()
    } else {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${requiredRole}`,
      })
    }
  }
}

export const proPass = (req, res, next) => {
  if (req.user && req.user.isProUser) {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: 'Pro Pass required for this resource',
    })
  }
}
