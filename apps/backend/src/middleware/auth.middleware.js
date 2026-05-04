import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { dbHelpers } from '../infrastructure/database/postgres-helpers.js'

// Rate limiter for authentication endpoints
// In production: 20 attempts per 15 minutes (account lockout also applies)
// In development: more permissive to avoid blocking tests
const isProduction = process.env.NODE_ENV === 'production'
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 20 : 10000, // 20 attempts in production, higher for dev
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
export const protect = async (req, res, next) => {
  try {
    let token

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

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: JWT_SECRET not set',
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // SESSION-SEC: Verify session is still active if token contains sessionId
    // (sessionId is embedded in JWT at login via auth.controller.js)
    if (decoded.sessionId) {
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
      } catch (sessionErr) {
        // Don't block auth if session table doesn't exist yet (graceful degradation)
        console.warn('[Auth] Session validation query failed (non-fatal):', sessionErr.message)
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
    const isVerified = user.isEmailVerified ?? user.emailVerified ?? true
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

export const optionalAuth = async (req, res, next) => {
  try {
    let token

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

      if (!sessionValid) {
        return next() // Treat as unauthenticated — don't attach user
      }

      const user = await dbHelpers.findById('users', decoded.id)
      if (user && user.isActive !== false && user.emailVerified !== false) {
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
