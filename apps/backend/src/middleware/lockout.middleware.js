import { dbHelpers } from '../infrastructure/database/postgres-helpers.js'
import { logAuditEvent } from './audit.middleware.js'

export const LOCKOUT_CONFIG = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  WINDOW_MINUTES: 30,
  PROGRESSIVE_LOCKOUT: true,
  PROGRESSIVE_FACTORS: [
    { attempts: 3, lockoutMinutes: 5 },
    { attempts: 5, lockoutMinutes: 15 },
    { attempts: 10, lockoutMinutes: 60 },
    { attempts: 20, lockoutMinutes: 1440 },
  ],
}

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || req.ip || 'unknown'
}

export const checkAccountLockout = async (email, ipAddress) => {
  const lockoutWindow = new Date(
    Date.now() - LOCKOUT_CONFIG.WINDOW_MINUTES * 60 * 1000
  )

  const attempts = await dbHelpers.pool.query(
    `SELECT COUNT(*) as attempt_count
     FROM login_attempts
     WHERE (email = $1 OR ip_address = $2)
       AND attempted_at > $3
       AND successful = false`,
    [email.toLowerCase(), ipAddress, lockoutWindow]
  )

  const attemptCount = parseInt(attempts.rows[0]?.attempt_count || 0)

  if (attemptCount === 0) {
    return { locked: false, attemptCount, lockoutMinutes: 0 }
  }

  let lockoutMinutes = 0

  if (LOCKOUT_CONFIG.PROGRESSIVE_LOCKOUT) {
    for (const factor of LOCKOUT_CONFIG.PROGRESSIVE_FACTORS) {
      if (attemptCount >= factor.attempts) {
        lockoutMinutes = factor.lockoutMinutes
      }
    }
  } else if (attemptCount >= LOCKOUT_CONFIG.MAX_ATTEMPTS) {
    lockoutMinutes = LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES
  }

  if (lockoutMinutes === 0) {
    return { locked: false, attemptCount, lockoutMinutes: 0 }
  }

  const recentFailedAttempts = await dbHelpers.pool.query(
    `SELECT attempted_at
     FROM login_attempts
     WHERE (email = $1 OR ip_address = $2)
       AND successful = false
     ORDER BY attempted_at DESC
     LIMIT 1`,
    [email.toLowerCase(), ipAddress]
  )

  if (recentFailedAttempts.rows.length > 0) {
    const lastAttempt = new Date(recentFailedAttempts.rows[0].attempted_at)
    const lockoutEnd = new Date(
      lastAttempt.getTime() + lockoutMinutes * 60 * 1000
    )
    const now = new Date()

    if (now < lockoutEnd) {
      const remainingSeconds = Math.ceil((lockoutEnd - now) / 1000)
      const remainingMinutes = Math.ceil(remainingSeconds / 60)
      return {
        locked: true,
        attemptCount,
        lockoutMinutes: remainingMinutes,
        lockoutExpires: lockoutEnd.toISOString(),
      }
    }
  }

  return { locked: false, attemptCount, lockoutMinutes: 0 }
}

export const recordLoginAttempt = async (email, ipAddress, successful, userAgent) => {
  try {
    await dbHelpers.pool.query(
      `INSERT INTO login_attempts (email, ip_address, successful, attempted_at)
       VALUES ($1, $2, $3, NOW())`,
      [email.toLowerCase(), ipAddress, successful]
    )

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[Login Attempt] ${successful ? 'SUCCESS' : 'FAILED'} - Email: ${email}, IP: ${ipAddress}`
      )
    }
  } catch (error) {
    console.error('[Login Attempt] Failed to record attempt:', error.message)
  }
}

export const lockoutMiddleware = async (req, res, next) => {
  if (req.path !== '/login' && !req.path.includes('/auth/login')) {
    return next()
  }

  const { email } = req.body || {}

  if (!email) {
    return next()
  }

  const ipAddress = getClientIp(req)
  const lockoutStatus = await checkAccountLockout(email, ipAddress)

  if (lockoutStatus.locked) {
    console.warn(
      `[Lockout] Account locked for ${email} from IP ${ipAddress}. ` +
      `Attempts: ${lockoutStatus.attemptCount}, Remaining: ${lockoutStatus.lockoutMinutes} minutes`
    )

    // LOW-04 FIX: Use standardized logAuditEvent instead of raw insertOne
    await logAuditEvent({
      action: 'login_lockout',
      resource: 'auth',
      adminEmail: email.toLowerCase(),
      ipAddress,
      userAgent: req.headers['user-agent'],
      details: {
        attemptCount: lockoutStatus.attemptCount,
        lockoutMinutes: lockoutStatus.lockoutMinutes,
        lockoutExpires: lockoutStatus.lockoutExpires,
      },
      status: 'blocked',
      requestMethod: req.method,
      requestPath: req.originalUrl,
    })

    return res.status(429).json({
      success: false,
      message: `Account temporarily locked due to too many failed attempts. Please try again in ${lockoutStatus.lockoutMinutes} minutes.`,
      code: 'ACCOUNT_LOCKED',
      retryAfter: lockoutStatus.lockoutMinutes * 60,
    })
  }

  const originalJson = res.json.bind(res)
  res.json = function (data) {
    if (data && data.success === true) {
      recordLoginAttempt(email, ipAddress, true, req.headers['user-agent'])
    }
    return originalJson(data)
  }

  next()
}

export const clearLoginAttempts = async (email) => {
  try {
    await dbHelpers.pool.query(
      `DELETE FROM login_attempts WHERE email = $1 AND successful = true`,
      [email.toLowerCase()]
    )
  } catch (error) {
    console.error('[Login] Failed to clear attempts:', error.message)
  }
}

export default {
  LOCKOUT_CONFIG,
  checkAccountLockout,
  recordLoginAttempt,
  lockoutMiddleware,
  clearLoginAttempts,
}