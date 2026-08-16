import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { generateToken, clearAuthCookies, validatePasswordStrength, setAuthCookies } from './auth.service.js'
import {
  protect,
  ROLES,
  SESSION_IDLE_TIMEOUT_MS,
  ADMIN_IDLE_TIMEOUT_MS,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  isSessionExpired,
} from '../../middleware/auth.middleware.js'
import { logAuditEvent, AUDIT_ACTIONS } from '../../middleware/audit.middleware.js'
import { recordLoginAttempt } from '../../middleware/lockout.middleware.js'
import { messageBroker } from '../../infrastructure/events/messageBroker.js'
import { getIO } from '../../infrastructure/websocket/websocketManager.js'
import {
  captureSession,
  invalidateSession,
  setSessionRefreshHash,
  getSessionForRefresh,
  verifyRefreshTokenForSession,
  rotateSessionRefreshHash,
} from '../../services/SessionCaptureService.js'
import { twoFactorService } from './twoFactor.service.js'
import { sanitizeUser } from '../../shared/utils/user-utils.js'
import { OAuth2Client } from 'google-auth-library'
import { generateCsrfToken, storeCsrfToken } from '../../middleware/csrf.middleware.js'
import { isTransientDbError } from '../../shared/utils/db-errors.js'
import { sendVerificationEmail } from '../../infrastructure/email/emailService.js'

const getRefreshSecret = () => {
  if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET
  throw new Error('JWT_REFRESH_SECRET must be set. Predictable fallback (JWT_SECRET + "-refresh") removed for security.')
}

const getGoogleClientId = () => {
  return process.env.GOOGLE_CLIENT_ID || null
}

const googleClientId = getGoogleClientId()
const googleClient = googleClientId
  ? new OAuth2Client(googleClientId)
  : null

if (!googleClientId) {
  console.warn('Google OAuth disabled: GOOGLE_CLIENT_ID not set')
}

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || req.ip || 'unknown'
}

// Append-only security audit for authentication events. Best-effort: never
// disrupts the request flow (logAuditEvent swallows its own errors).
const auditAuth = (req, { action, status = 'success', detail = {}, userId = null, sessionId = null }) =>
  logAuditEvent({
    action,
    resource: 'auth',
    entityType: 'session',
    entityId: sessionId || null,
    adminId: userId,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    status,
    requestMethod: req.method,
    requestPath: req.originalUrl,
    details: detail,
  })

export const authController = {
  // POST /api/auth/login
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body
      const ipAddress = getClientIp(req)
      const userAgent = req.headers['user-agent']

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide email and password',
        })
      }

      // Find user by email
      const user = await dbHelpers.findOne('users', { email })
      if (!user) {
        // Record failed attempt for non-existent user
        await recordLoginAttempt(email, ipAddress, false, userAgent)
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        })
      }

      // Check if user is active
      if (user.isActive === false || user.isDeactivated === true) {
        await recordLoginAttempt(email, ipAddress, false, userAgent)
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        })
      }

      // The `users` table intentionally strips `password` from generic reads
      // (SENSITIVE_USER_COLUMNS), so fetch the hash explicitly for verification.
      const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
      const pwResult = await pool.query('SELECT password FROM users WHERE email = $1', [email])
      const passwordHash = pwResult.rows[0]?.password
      if (!passwordHash) {
        // Account has no password set (e.g. OAuth-only). Treat as invalid creds.
        await recordLoginAttempt(email, ipAddress, false, userAgent)
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        })
      }
      const isPasswordValid = await bcrypt.compare(password, passwordHash)
      if (!isPasswordValid) {
        // Record failed attempt
        await recordLoginAttempt(email, ipAddress, false, userAgent)
        auditAuth(req, { action: AUDIT_ACTIONS.LOGIN_FAILED, status: 'failure', detail: { email }, userId: user._id || user.id })
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        })
      }

      // Record successful login. Set a flag so lockoutMiddleware's finish
      // handler skips its duplicate success insert (was double-logging).
      await recordLoginAttempt(email, ipAddress, true, userAgent)
      res.locals.loginAttemptRecorded = true

      // ── 2FA GATE ──────────────────────────────────────────────────────
      // If the user has 2FA enabled, do NOT issue session/tokens yet.
      // Return a short-lived temp token so the client can send the TOTP
      // code via POST /api/auth/login/2fa.
      const userId2fa = user._id || user.id
      try {
        const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
        const twoFaRow = await pool.query(
          'SELECT enabled FROM two_factor_secrets WHERE user_id = $1',
          [String(userId2fa)]
        )
        if (twoFaRow.rows.length > 0 && twoFaRow.rows[0].enabled === true) {
          // Issue a short-lived temp token (5 min) that is NOT a valid session token.
          // Use a dedicated secret (JWT_2FA_SECRET) to isolate 2FA temp tokens from
          // session tokens. Falls back to JWT_SECRET for backward compat.
          const tempToken = jwt.sign(
            { userId: userId2fa, role: user.role, type: '2fa-pending' },
            process.env.JWT_2FA_SECRET || process.env.JWT_SECRET,
            { expiresIn: '5m' }
          )
          return res.status(200).json({
            success: true,
            requires2FA: true,
            message: 'Two-factor authentication required',
            data: { tempToken },
          })
        }
      } catch (twoFaErr) {
        // Fail-closed: if we cannot verify whether 2FA is enabled for this user,
        // we must NOT issue session tokens. An attacker who can cause a DB error
        // on this specific query could otherwise bypass 2FA entirely.
        console.error('[Auth] 2FA check failed (fail-closed):', twoFaErr.message)
        return res.status(401).json({
          success: false,
          message: 'Two-factor verification is currently unavailable. Please try again later.',
          code: 'TWOFA_CHECK_UNAVAILABLE',
        })
      }
      // ── END 2FA GATE ──────────────────────────────────────────────────

      const userId = user._id || user.id

      // SESSION-SEC: Determine session limit based on role/pro status
      let sessionLimit = 1 // Default for free users
      if (user.session_limit !== null && user.session_limit !== undefined) {
        sessionLimit = user.session_limit // Admin-configured override
      } else if (user.role === 'admin') {
        sessionLimit = 5 // Admins can have 5 sessions
      } else if (user.isProUser) {
        sessionLimit = 3 // Pro users get 3 sessions
      }

      // SESSION-SEC: Capture/reuse session FIRST so we know which session_id
      // this login will use. This prevents a race where a rapid duplicate login
      // (React StrictMode, network retry) evicts the session the first login
      // just created, leaving the browser holding a dead session JWT.
      const sessionId = await captureSession(req, userId, 'web')

      // SESSION-SEC: Detect existing active sessions on other devices and
      // enforce the session limit, but never evict the session we just reused.
      let previousSession = false
      let otherSessions = []
      try {
        const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          
          // Lock user sessions to prevent TOCTOU race
          await client.query(
            `SELECT 1 FROM user_sessions WHERE user_id = $1 FOR UPDATE`, 
            [String(userId)]
          )

          const activeResult = await client.query(
            `SELECT session_id, device_type, browser, os, country, city, last_active
             FROM user_sessions
             WHERE user_id = $1 AND is_active = true
             ORDER BY last_active DESC`,
            [String(userId)]
          )
          const activeRows = activeResult.rows
          previousSession = activeRows.length > 1 // >1 because the current session is included
          otherSessions = activeRows
            .filter((s) => s.session_id !== sessionId)
            .slice(0, 5)
            .map((s) => ({
              deviceType: s.device_type,
              browser: s.browser,
              os: s.os,
              country: s.country,
              city: s.city,
              lastActive: s.last_active,
            }))

          if (activeRows.length > sessionLimit) {
            const sessionsToRevoke = activeRows
              .filter((s) => s.session_id !== sessionId)
              .slice(sessionLimit - 1)
            
            if (sessionsToRevoke.length > 0) {
              const revokeIds = sessionsToRevoke.map(s => s.session_id)
              await client.query(
                `UPDATE user_sessions SET is_active = false WHERE session_id = ANY($1)`,
                [revokeIds]
              )
              
              await client.query('COMMIT')
              
              for (const row of sessionsToRevoke) {
                await invalidateSession(row.session_id, 'system:limit-enforcement')
              }
              console.log(`[Auth] Evicted ${sessionsToRevoke.length} session(s) for user ${userId} (limit: ${sessionLimit})`)
            } else {
              await client.query('COMMIT')
            }
          } else {
            await client.query('COMMIT')
          }
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      } catch (limitErr) {
        // Don't block login if session limit enforcement fails
        console.warn('[Auth] Session limit enforcement failed (non-fatal):', limitErr.message)
      }

      // Generate tokens — embed sessionId so middleware can validate session is active
      const token = generateToken(userId, user.role, {
        claims: sessionId ? { sessionId } : {}
      })
      const refreshToken = generateToken(
        userId,
        user.role,
        {
          secret: getRefreshSecret(),
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
          claims: {
            refreshTokenVersion: user.refresh_token_version || 0,
            ...(sessionId ? { sessionId } : {})
          },
        }
      )

      // Bind this device's refresh token to its session (per-device revocation)
      if (sessionId) await setSessionRefreshHash(sessionId, refreshToken)

      setAuthCookies(res, { token, refreshToken })

      // Generate and store initial CSRF token for the session
      const csrfToken = generateCsrfToken()
      await storeCsrfToken(token, csrfToken)

      auditAuth(req, { action: AUDIT_ACTIONS.LOGIN, detail: { sessionId }, userId, sessionId })

      // Remove password from response
      const userWithoutPassword = sanitizeUser(user)

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          sessionId,
          csrfToken,
          previousSession,
          otherSessions,
        },
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/register
  register: async (req, res, next) => {
    try {
      const { name, email, password, mobile } = req.body

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide name, email, and password',
        })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        })
      }
      
      if (mobile) {
        const mobileRegex = /^[0-9]{10}$/
        if (!mobileRegex.test(mobile)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid mobile format (must be 10 digits)',
          })
        }
      }

      // Validate password strength (Issue #13)
      const passwordValidation = validatePasswordStrength(password)
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        })
      }

      // Check if user already exists
      const existingUser = await dbHelpers.findOne('users', { email })
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email',
        })
      }

      // Hash password
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)

      // Email verification is enforced by protect(). Auto-verify in
      // non-production (or when no SMTP mailer is configured) so local/test
      // users can use the app immediately; production keeps the gate.
      const mailerConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      const autoVerifyEmail = process.env.NODE_ENV !== 'production' || !mailerConfigured

      // Create user
      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        mobile: mobile || '',
        role: 'user',
        isProUser: false,
        isEmailVerified: autoVerifyEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const newUser = await dbHelpers.insertOne('users', userData)

       // Generate tokens
       const userId = newUser._id || newUser.id

       // Capture a device session so freshly-registered users appear in the
       // session list, are subject to session limits, and can be revoked
       // per-device. Returns null on failure — registration still succeeds.
       const sessionId = await captureSession(req, userId, 'web')

       const token = generateToken(userId, newUser.role, {
         claims: sessionId ? { sessionId } : {}
       })
       const refreshToken = generateToken(
         userId,
         newUser.role,
         {
           secret: getRefreshSecret(),
           expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
           claims: {
             refreshTokenVersion: 0, // New users start at 0
             ...(sessionId ? { sessionId } : {})
           },
         }
       )

       // Bind this device's refresh token to its session (per-device revocation)
       if (sessionId) await setSessionRefreshHash(sessionId, refreshToken)

       setAuthCookies(res, { token, refreshToken })

       // Emit WebSocket event for new user registration (admin notification)
       try {
         const io = getIO()
         if (io) {
           io.to('admin').emit('user:registered', {
             userId: newUser._id || newUser.id,
             email: newUser.email,
             name: newUser.name,
             role: newUser.role,
             timestamp: new Date().toISOString()
           })
         }
       } catch (wsErr) {
         // WebSocket emit failure should not break registration
         console.warn('Failed to emit user:registered event:', wsErr.message)
       }

       // Publish user registration event asynchronously to decouple welcoming notifications
       try {
         await messageBroker.publish('user.registered', {
           email: newUser.email,
           name: newUser.name
         })
       } catch (evtErr) {
         console.warn('Failed to publish user.registered event:', evtErr.message)
       }

        // Generate and store initial CSRF token for the session
        const csrfToken = generateCsrfToken()
        await storeCsrfToken(token, csrfToken)

        // Remove password from response
        const userWithoutPassword = sanitizeUser(newUser)

         res.status(201).json({
           success: true,
           message: 'Registration successful',
           data: {
             user: userWithoutPassword,
             sessionId: sessionId || null,
             csrfToken
           },
         })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/google
  googleLogin: async (req, res, next) => {
    try {
      if (!googleClient) {
        return res.status(503).json({ success: false, message: 'Google OAuth is not configured' })
      }

      const { credential } = req.body
      if (!credential) {
        return res.status(400).json({ success: false, message: 'Google credential is required' })
      }

      // Verify Google Token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      })
      const payload = ticket.getPayload()
      const { email, name, picture, email_verified } = payload

      if (!email_verified) {
        return res.status(400).json({ success: false, message: 'Google email is not verified' })
      }

      const ipAddress = getClientIp(req)
      const userAgent = req.headers['user-agent']

      let user
      let isNewUser = false
      user = await dbHelpers.findOne('users', { email: email.toLowerCase() })

      if (user) {
        if (user.isActive === false || user.isDeactivated === true) {
          return res.status(403).json({ success: false, message: 'Your account has been deactivated.' })
        }
      } else {
        // Create new user since they don't exist
        isNewUser = true
        const salt = await bcrypt.genSalt(12)
        // A02: use a cryptographically secure random value, not Math.random(),
        // for the auto-generated password of Google-OAuth-provisioned users.
        const randomPassword = await bcrypt.hash(crypto.randomBytes(18).toString('base64') + 'A1!', salt)
        
        const userData = {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: randomPassword,
          mobile: '',
          role: 'user',
          isProUser: false,
          isEmailVerified: true,
          avatar: picture,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        user = await dbHelpers.insertOne('users', userData)

        try {
          await messageBroker.publish('user.registered', { email: user.email, name: user.name })
        } catch (evtErr) {
          console.warn('Failed to publish user.registered event for Google user:', evtErr.message)
        }
      }

      await recordLoginAttempt(email, ipAddress, true, userAgent)
      res.locals.loginAttemptRecorded = true
      const userId = user._id || user.id

      const sessionId = await captureSession(req, userId, 'web')

      const token = generateToken(userId, user.role, { claims: sessionId ? { sessionId } : {} })
      const refreshToken = generateToken(userId, user.role, {
        secret: getRefreshSecret(),
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
        claims: { refreshTokenVersion: user.refresh_token_version || 0, ...(sessionId ? { sessionId } : {}) }
      })

      // Bind this device's refresh token to its session (per-device revocation)
      if (sessionId) await setSessionRefreshHash(sessionId, refreshToken)

      setAuthCookies(res, { token, refreshToken })

      // Generate and store initial CSRF token for the session
      const csrfToken = generateCsrfToken()
      await storeCsrfToken(token, csrfToken)

      auditAuth(req, { action: AUDIT_ACTIONS.LOGIN, detail: { sessionId, method: 'google' }, userId, sessionId })

      const userWithoutPassword = sanitizeUser(user)

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          sessionId,
          csrfToken
        },
      })
    } catch (error) {
      console.error('Google Auth Error:', error)
      return res.status(401).json({ success: false, message: 'Invalid Google credential' })
    }
  },

  // POST /api/auth/logout
   logout: async (req, res, next) => {
     try {
       // Invalidate current session in user_sessions table so it stops appearing as active
       const sessionId = req.user?.sessionId
       if (sessionId) {
         try {
           await invalidateSession(sessionId, { id: req.user.id, email: req.user.email, name: req.user.name })
         } catch (sessionErr) {
           // Non-fatal — still complete the logout
           console.warn('[Auth] Failed to invalidate session on logout (non-fatal):', sessionErr.message)
         }
       }
        // Invalidate refresh token version to revoke all refresh tokens from this session
        if (req.user?.id) {
          await dbHelpers.query(
            'UPDATE users SET refresh_token_version = refresh_token_version + 1 WHERE id = $1',
            [req.user.id]
          )
        }
        auditAuth(req, {
          action: AUDIT_ACTIONS.LOGOUT,
          detail: { sessionId, revokedAllDevices: true },
          userId: req.user?.id || null,
          sessionId,
        })
        clearAuthCookies(res)
       res.status(200).json({
         success: true,
         message: 'Logout successful',
       })
     } catch (error) {
       next(error)
     }
   },

  // POST /api/auth/refresh
  refreshToken: async (req, res, next) => {
    try {
      const { refreshToken } = req.cookies

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token not found',
        })
      }

      // Verify refresh token
      if (!process.env.JWT_REFRESH_SECRET) {
        console.error('CRITICAL: JWT_REFRESH_SECRET not set')
      }
      const decoded = jwt.verify(
        refreshToken,
        getRefreshSecret()
      )

      // Find user — use findById for consistency with the rest of the codebase.
      // A transient DB/infra failure here must NOT clear the (still-valid)
      // refresh cookie, otherwise a momentary DB blip logs the user out.
      let user
      try {
        user = await dbHelpers.findById('users', decoded.id)
      } catch (dbErr) {
        if (isTransientDbError(dbErr)) {
          console.warn('[Auth] Refresh temporarily unavailable:', dbErr.message)
          return res.status(503).json({
            success: false,
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service temporarily unavailable. Please try again.',
          })
        }
        throw dbErr
      }
      if (!user) {
        clearAuthCookies(res)
        return res.status(401).json({
          success: false,
          message: 'User not found',
        })
      }

      // Check refresh token version to ensure token hasn't been revoked
      const tokenVersion = decoded.refreshTokenVersion || 0
      const currentUserVersion = user.refresh_token_version || 0
      if (tokenVersion !== currentUserVersion) {
        clearAuthCookies(res)
        return res.status(401).json({
          success: false,
          message: 'Refresh token invalidated. Please log in again.',
        })
      }

      // Per-device validation: reject a refresh token that doesn't match the
      // one stored for its session (revoked device, or a stale/stolen token).
      // Backward compatible: legacy sessions with no stored hash are accepted
      // and upgraded on rotation below. A transient DB error here bubbles to
      // the catch (503) and does NOT clear cookies.
      if (decoded.sessionId) {
        const session = await getSessionForRefresh(decoded.sessionId)
        const check = verifyRefreshTokenForSession(session, refreshToken)
        if (!check.ok) {
          clearAuthCookies(res)
          console.warn(`[Auth] Refresh rejected for session ${decoded.sessionId}: ${check.reason}`)
          if (check.reason === 'replay-detected') {
            // SECURITY ALARM: a rotated refresh token is being replayed, a strong
            // indicator of token theft. Revoke the device session immediately,
            // alert the user in real time, and record the event for forensics.
            try {
              await invalidateSession(decoded.sessionId, 'system:replay')
              auditAuth(req, {
                action: 'refresh_replay',
                status: 'failure',
                detail: { sessionId: decoded.sessionId, reason: 'replay-detected' },
                userId: decoded.id,
                sessionId: decoded.sessionId,
              })
              try {
                const io = getIO()
                io.to(`user:${decoded.id}`).emit('session:security-alert', {
                  type: 'refresh_replay',
                  message: 'We blocked a suspicious sign-in attempt on one of your devices. Please review your active sessions.',
                  sessionId: decoded.sessionId,
                  at: new Date().toISOString(),
                })
                io.to('admin:sessions').emit('session:security-alert', {
                  type: 'refresh_replay',
                  userId: decoded.id,
                  sessionId: decoded.sessionId,
                  at: new Date().toISOString(),
                })
              } catch (wsErr) {
                console.warn('[Auth] Replay security-alert emit failed:', wsErr.message)
              }
            } catch (revokeErr) {
              console.warn('[Auth] Replay session revoke failed:', revokeErr.message)
            }
            return res.status(401).json({
              success: false,
              code: 'TOKEN_REPLAY',
              message: 'Suspicious activity detected. Your session was revoked. Please sign in again.',
            })
          }
          return res.status(401).json({
            success: false,
            message:
              check.reason === 'revoked'
                ? 'This device was signed out. Please log in again.'
                : 'Your session is no longer valid. Please log in again.',
          })
        }

        // SESSION-SEC: enforce idle + absolute session expiry on refresh too, so
        // an idle/old session cannot be silently kept alive by refreshing.
        const idleThreshold =
          decoded.role === ROLES.ADMIN || decoded.role === ROLES.SUPER_ADMIN
            ? ADMIN_IDLE_TIMEOUT_MS
            : SESSION_IDLE_TIMEOUT_MS
        const expiry = isSessionExpired(session, idleThreshold, SESSION_ABSOLUTE_TIMEOUT_MS)
        if (expiry.expired) {
          clearAuthCookies(res)
          try {
            await invalidateSession(decoded.sessionId, 'system:expired')
            auditAuth(req, {
              action: 'session_expired',
              status: 'failure',
              detail: { sessionId: decoded.sessionId, reason: expiry.reason },
              userId: decoded.id,
              sessionId: decoded.sessionId,
            })
          } catch (expErr) {
            console.warn('[Auth] Expired session revoke failed:', expErr.message)
          }
          return res.status(401).json({
            success: false,
            code: expiry.reason === 'absolute' ? 'SESSION_EXPIRED' : 'SESSION_IDLE_TIMEOUT',
            message:
              expiry.reason === 'absolute'
                ? 'Session expired. Please sign in again.'
                : 'Session expired due to inactivity. Please sign in again.',
          })
        }
      }

      // Generate new tokens — carry forward the sessionId so the renewed JWT
      // continues to validate against the user_sessions row across the full
      // refresh-token lifetime (otherwise long-lived sessions would suddenly
      // 401 when only the access token had a sessionId and the refresh issued
      // a new one without it).
      const token = generateToken(decoded.id, decoded.role, {
        claims: { sessionId: decoded.sessionId || null }
      })
      const newRefreshToken = generateToken(
        decoded.id,
        decoded.role,
        {
          secret: getRefreshSecret(),
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
          claims: {
            refreshTokenVersion: currentUserVersion,
            sessionId: decoded.sessionId || null
          },
        }
      )

      // Rotate the stored per-device hash BEFORE issuing new cookies so the DB
      // and the client's cookie never desync. Transient failures bubble to the
      // catch below (503) and the client keeps its still-valid current cookie.
      if (decoded.sessionId) {
        await rotateSessionRefreshHash(decoded.sessionId, newRefreshToken)
      }

      setAuthCookies(res, { token, refreshToken: newRefreshToken })

      // Generate and store new CSRF token
      const csrfToken = generateCsrfToken()
      await storeCsrfToken(token, csrfToken)

      auditAuth(req, {
        action: 'refresh',
        detail: { sessionId: decoded.sessionId },
        userId: decoded.id,
        sessionId: decoded.sessionId,
      })

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          csrfToken
        }
      })
    } catch (error) {
      // Only destroy the session on a genuine, definitive auth failure.
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        clearAuthCookies(res)
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        })
      }
      // Transient infra failure — preserve cookies, let the client retry.
      if (isTransientDbError(error)) {
        console.warn('[Auth] Refresh temporarily unavailable:', error.message)
        return res.status(503).json({
          success: false,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable. Please try again.',
        })
      }
      next(error)
    }
  },

  // POST /api/auth/forgot-password
  forgotPassword: async (req, res, next) => {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an email address',
        })
      }

      const user = await dbHelpers.findOne('users', { email })
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.status(200).json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
        })
      }

      // Generate reset token — use dedicated JWT_RESET_SECRET to isolate from
      // session tokens. Falls back to JWT_SECRET for backward compat.
      const resetToken = jwt.sign(
        { id: user._id || user.id, type: 'password-reset' },
        process.env.JWT_RESET_SECRET || process.env.JWT_SECRET,
        { expiresIn: '1h' }
      )

      // Token expiry is enforced by JWT (1h) — no DB storage needed

      const isHttps = process.env.ENFORCE_HTTPS === 'true'
      const resetLink = `${process.env.FRONTEND_URL || `${isHttps ? 'https' : 'http'}://localhost:5173`}/reset-password?token=${resetToken}`;
      
      try {
        await messageBroker.publish('user.password_reset_requested', { email, resetLink })
      } catch (evtErr) {
        console.warn('Failed to publish user.password_reset_requested event:', evtErr.message)
      }

      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/reset-password
  // FIXED (CRIT-03): Use only JWT-based expiry validation for consistency
  resetPassword: async (req, res, next) => {
    try {
      const { token, newPassword } = req.body

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Please provide token and new password',
        })
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword)
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        })
      }

      // CRIT-03 FIX: Verify reset token using JWT expiry only (single source of truth)
      // JWT expiry is set to 1h in forgotPassword - no redundant check needed
      let decoded
      try {
        decoded = jwt.verify(token, process.env.JWT_RESET_SECRET || process.env.JWT_SECRET)
      } catch (err) {
        // TokenExpiredError from JWT means token is definitively expired
        if (err.name === 'TokenExpiredError') {
          return res.status(400).json({
            success: false,
            message: 'Reset token has expired',
          })
        }
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token',
        })
      }

      // Validate token type to prevent token reuse for other purposes
      if (decoded.type !== 'password-reset') {
        return res.status(400).json({
          success: false,
          message: 'Invalid reset token',
        })
      }

      // Check if jti is used
      let redis = null
      if (decoded.jti) {
        const { getRedisClient } = await import('../../infrastructure/cache/redisClient.js')
        redis = getRedisClient()
        if (redis && redis.status === 'ready') {
          const used = await redis.get(`used_jti:${decoded.jti}`)
          if (used) {
            return res.status(400).json({
              success: false,
              message: 'Reset token has already been used',
            })
          }
        }
      }

      // Find user — JWT expiry is the single source of truth for token validity
      const user = await dbHelpers.findById('users', decoded.id)
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found',
        })
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(newPassword, salt)

      // Update user password
      await dbHelpers.updateById('users', user._id || user.id, {
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
      })

      try {
        await messageBroker.publish('user.password_changed', { email: user.email })
      } catch (evtErr) {
        console.warn('Failed to publish user.password_changed event:', evtErr.message)
      }

      if (redis && redis.status === 'ready' && decoded.jti) {
        // Token is valid for 1 hour, so we only need to keep the jti in redis for 1 hour
        await redis.set(`used_jti:${decoded.jti}`, '1', 'EX', 3600)
      }

      // Clear any existing auth cookies for security
      clearAuthCookies(res)

      res.status(200).json({
        success: true,
        message: 'Password reset successful',
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/change-password
  changePassword: async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
        })
      }

      const passwordValidation = validatePasswordStrength(newPassword)
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        })
      }

      const user = await dbHelpers.findById('users', req.user.id)

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        })
      }

      // `password` is stripped from generic reads; fetch it explicitly.
      const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
      const pwResult = await pool.query('SELECT password FROM users WHERE id = $1', [String(user._id || user.id)])
      const currentHash = pwResult.rows[0]?.password
      if (!currentHash) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        })
      }
      const isPasswordValid = await bcrypt.compare(currentPassword, currentHash)
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        })
      }

      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(newPassword, salt)

      await dbHelpers.updateById('users', user._id || user.id, {
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
      })

      try {
        await messageBroker.publish('user.password_changed', { email: user.email })
      } catch (evtErr) {
        console.warn('Failed to publish user.password_changed event:', evtErr.message)
      }

      auditAuth(req, {
        action: 'password_change',
        detail: { sessionId: req.user?.sessionId },
        userId: req.user.id,
        sessionId: req.user?.sessionId,
      })

      clearAuthCookies(res)

      res.status(200).json({
        success: true,
        message: 'Password updated successfully. Please sign in again.',
      })
    } catch (error) {
      next(error)
    }
  },

  // GET /api/auth/verify-email/:token
  verifyEmail: async (req, res, next) => {
    try {
      const { token } = req.params

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required',
        })
      }

      // Verify token
      let decoded
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token',
        })
      }

      if (decoded.type !== 'email-verification') {
        return res.status(400).json({
          success: false,
          message: 'Invalid token type',
        })
      }

      // Find user
      const user = await dbHelpers.findById('users', decoded.id)
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found',
        })
      }

      if (user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: 'Email is already verified',
        })
      }

      // Update user
      await dbHelpers.updateById('users', user._id || user.id, {
        isEmailVerified: true,
        emailVerificationToken: null,
        updatedAt: new Date().toISOString(),
      })

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/resend-verification
  resendVerification: async (req, res, next) => {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an email address',
        })
      }

      const user = await dbHelpers.findOne('users', { email: String(email).toLowerCase().trim() })
      if (!user) {
        // Don't reveal whether the account exists
        return res.status(200).json({
          success: true,
          message: 'If an account exists with this email, a verification email has been sent',
        })
      }

      if (user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: 'This email is already verified',
        })
      }

      // Generate a fresh email-verification token (isolated secret, like forgotPassword)
      const verificationToken = jwt.sign(
        { id: user._id || user.id, type: 'email-verification' },
        process.env.JWT_RESET_SECRET || process.env.JWT_SECRET,
        { expiresIn: '24h' }
      )

      const sendResult = await sendVerificationEmail(user.email, user.name, verificationToken)

      if (sendResult && sendResult.success === false) {
        return res.status(502).json({
          success: false,
          message: 'Failed to send verification email. Please try again later.',
        })
      }

      res.status(200).json({
        success: true,
        message: 'Verification email sent. Please check your inbox.',
      })
    } catch (error) {
      next(error)
    }
  },

  // GET /api/auth/2fa/status — current 2FA enrollment status for the user
  getTwoFactorStatus: async (req, res, next) => {
    try {
      const result = await dbHelpers.pool.query(
        'SELECT enabled, backup_codes FROM two_factor_secrets WHERE user_id = $1',
        [String(req.user.id)]
      )
      const row = result.rows[0]
      res.json({
        success: true,
        data: {
          enabled: row ? Boolean(row.enabled) : false,
          backupCodesCount: Array.isArray(row?.backup_codes) ? row.backup_codes.length : 0,
        },
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/2fa/enroll — generate a new TOTP secret (not yet enabled)
  enrollTwoFactor: async (req, res, next) => {
    try {
      const secret = twoFactorService.generateSecret()
      const otpauthUri = twoFactorService.buildOtpauthUri(secret, req.user.email)
      await dbHelpers.pool.query(
        `INSERT INTO two_factor_secrets (user_id, secret, backup_codes, enabled, enrolled_at)
         VALUES ($1, $2, '[]'::jsonb, false, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET secret = EXCLUDED.secret,
               backup_codes = '[]'::jsonb,
               enabled = false,
               enrolled_at = NOW()`,
        [String(req.user.id), secret]
      )
      res.status(200).json({
        success: true,
        data: { secret, otpauthUri },
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/2fa/verify — verify a TOTP code and enable 2FA
  verifyTwoFactor: async (req, res, next) => {
    try {
      const { token } = req.body
      if (!token) {
        return res.status(400).json({ success: false, message: 'Verification code is required' })
      }
      const result = await dbHelpers.pool.query(
        'SELECT secret FROM two_factor_secrets WHERE user_id = $1',
        [String(req.user.id)]
      )
      const row = result.rows[0]
      if (!row) {
        return res.status(404).json({ success: false, message: 'No 2FA enrollment in progress' })
      }
      const isValid = twoFactorService.verifyTOTP(token, row.secret)
      if (!isValid) {
        const ipAddress = getClientIp(req)
        if (req.user?.email) {
          await recordLoginAttempt(req.user.email, ipAddress, false, req.headers['user-agent'])
        }
        return res.status(401).json({ success: false, message: 'Invalid verification code' })
      }
      const backupCodes = twoFactorService.generateBackupCodes()
      const hashed = await twoFactorService.hashBackupCodes(backupCodes)
      await dbHelpers.pool.query(
        'UPDATE two_factor_secrets SET enabled = true, backup_codes = $1 WHERE user_id = $2',
        [JSON.stringify(hashed), String(req.user.id)]
      )
      auditAuth(req, {
        action: '2fa_enabled',
        detail: { sessionId: req.user?.sessionId },
        userId: req.user.id,
        sessionId: req.user?.sessionId,
      })
      res.status(200).json({
        success: true,
        message: 'Two-factor authentication enabled',
        data: { backupCodes },
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/2fa/backup-codes/regenerate — rotate backup codes
  regenerateTwoFactorBackupCodes: async (req, res, next) => {
    try {
      const result = await dbHelpers.pool.query(
        'SELECT enabled FROM two_factor_secrets WHERE user_id = $1',
        [String(req.user.id)]
      )
      const row = result.rows[0]
      if (!row || !row.enabled) {
        return res.status(400).json({ success: false, message: 'Two-factor authentication is not enabled' })
      }
      const backupCodes = twoFactorService.generateBackupCodes()
      const hashed = await twoFactorService.hashBackupCodes(backupCodes)
      await dbHelpers.pool.query(
        'UPDATE two_factor_secrets SET backup_codes = $1 WHERE user_id = $2',
        [JSON.stringify(hashed), String(req.user.id)]
      )
      res.status(200).json({
        success: true,
        message: 'Backup codes regenerated',
        data: { backupCodes },
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/2fa/disable — turn off 2FA for the user
  disableTwoFactor: async (req, res, next) => {
    try {
      await dbHelpers.pool.query(
        'DELETE FROM two_factor_secrets WHERE user_id = $1',
        [String(req.user.id)]
      )
      res.status(200).json({
        success: true,
        message: 'Two-factor authentication disabled',
      })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/login/2fa — complete login after TOTP verification
  login2FA: async (req, res, next) => {
    try {
      const { tempToken, token: totpCode, backupCode } = req.body
      const ipAddress = getClientIp(req)
      const userAgent = req.headers['user-agent']

      if (!tempToken) {
        return res.status(400).json({ success: false, message: 'Temporary token is required' })
      }
      if (!totpCode && !backupCode) {
        return res.status(400).json({ success: false, message: 'TOTP code or backup code is required' })
      }

      // Verify the temp token — use dedicated 2FA secret (falls back to JWT_SECRET)
      let decoded
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_2FA_SECRET || process.env.JWT_SECRET)
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: 'Temporary token expired or invalid' })
      }

      if (decoded.type !== '2fa-pending') {
        return res.status(401).json({ success: false, message: 'Invalid token type' })
      }

      const userId = decoded.userId

      // Fetch 2FA secret and backup codes
      const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
      const tfRow = await pool.query(
        'SELECT secret, backup_codes FROM two_factor_secrets WHERE user_id = $1 AND enabled = true',
        [String(userId)]
      )
      if (tfRow.rows.length === 0) {
        return res.status(400).json({ success: false, message: '2FA is not enabled for this user' })
      }

      const { secret, backup_codes: storedBackupCodes } = tfRow.rows[0]
      let verified = false

      if (totpCode) {
        verified = twoFactorService.verifyTOTP(totpCode, secret)
      } else if (backupCode) {
        const parsedCodes = Array.isArray(storedBackupCodes)
          ? storedBackupCodes
          : JSON.parse(storedBackupCodes || '[]')
        const matchIdx = await twoFactorService.verifyBackupCode(backupCode, parsedCodes)
        if (matchIdx >= 0) {
          verified = true
          // Consume the backup code (set to null)
          parsedCodes[matchIdx] = null
          await pool.query(
            'UPDATE two_factor_secrets SET backup_codes = $1 WHERE user_id = $2',
            [JSON.stringify(parsedCodes), String(userId)]
          )
        }
      }

      if (!verified) {
        await recordLoginAttempt(null, ipAddress, false, userAgent)
        return res.status(401).json({ success: false, message: 'Invalid verification code' })
      }

      // 2FA passed — complete the standard login flow
      const user = await dbHelpers.findOne('users', { id: userId })
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' })
      }

      // SESSION-SEC: Session limit enforcement (same as standard login)
      let sessionLimit = 1
      if (user.session_limit !== null && user.session_limit !== undefined) {
        sessionLimit = user.session_limit
      } else if (user.role === 'admin') {
        sessionLimit = 5
      } else if (user.isProUser) {
        sessionLimit = 3
      }

      try {
        const activeResult = await pool.query(
          `SELECT session_id FROM user_sessions
           WHERE user_id = $1 AND is_active = true
           ORDER BY last_active DESC`,
          [String(userId)]
        )
        if (activeResult.rows.length >= sessionLimit) {
          const keepCount = sessionLimit - 1
          const sessionsToRevoke = activeResult.rows.slice(Math.max(0, keepCount))
          for (const row of sessionsToRevoke) {
            await invalidateSession(row.session_id, 'system:limit-enforcement')
          }
        }
      } catch (limitErr) {
        console.warn('[Auth] Session limit enforcement failed (non-fatal):', limitErr.message)
      }

      const sessionId = await captureSession(req, userId, 'web')

      const accessToken = generateToken(userId, user.role, {
        claims: sessionId ? { sessionId } : {}
      })
      const refreshToken = generateToken(
        userId,
        user.role,
        {
          secret: getRefreshSecret(),
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
          claims: {
            refreshTokenVersion: user.refresh_token_version || 0,
            ...(sessionId ? { sessionId } : {})
          },
        }
      )

      if (sessionId) await setSessionRefreshHash(sessionId, refreshToken)

      setAuthCookies(res, { token: accessToken, refreshToken })

      const csrfToken = generateCsrfToken()
      await storeCsrfToken(accessToken, csrfToken)

      const userWithoutPassword = sanitizeUser(user)

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          sessionId,
          csrfToken,
        },
      })
    } catch (error) {
      next(error)
    }
  },
}
