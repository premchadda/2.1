import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { generateToken, clearAuthCookies, validatePasswordStrength, setAuthCookies } from './auth.service.js'
import { protect } from '../../middleware/auth.middleware.js'
import { recordLoginAttempt } from '../../middleware/lockout.middleware.js'
import emailService from '../../services/EmailService.js'
import { getIO } from '../../infrastructure/websocket/websocketManager.js'
import { captureSession, invalidateSession } from '../../services/SessionCaptureService.js'
import { OAuth2Client } from 'google-auth-library'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy-client-id')

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || req.ip || 'unknown'
}

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
      const users = await global.dbHelpers.find('users', { email })
      if (users.length === 0) {
        // Record failed attempt for non-existent user
        await recordLoginAttempt(email, ipAddress, false, userAgent)
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        })
      }

      const user = users[0]

      // Check if user is active
      if (user.isActive === false || user.isDeactivated === true) {
        await recordLoginAttempt(email, ipAddress, false, userAgent)
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        })
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        // Record failed attempt
        await recordLoginAttempt(email, ipAddress, false, userAgent)
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        })
      }

      // Record successful login
      await recordLoginAttempt(email, ipAddress, true, userAgent)

      const userId = user._id || user.id

      // SESSION-SEC: Determine session limit based on role/pro status
      let sessionLimit = 1 // Default for free users
      if (user.session_limit !== null && user.session_limit !== undefined) {
        sessionLimit = user.session_limit // Admin-configured override
      } else if (user.role === 'admin' || user.role === 'super_admin') {
        sessionLimit = 5 // Admins can have 5 sessions
      } else if (user.isProUser) {
        sessionLimit = 3 // Pro users get 3 sessions
      }

      // SESSION-SEC: Enforce session limit — evict oldest sessions before creating new one
      try {
        const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
        const activeSessions = await pool.query(
          `SELECT session_id FROM user_sessions 
           WHERE user_id = $1 AND is_active = true 
           ORDER BY created_at DESC`,
          [String(userId)]
        )
        // If adding a new session would exceed the limit, revoke the oldest ones
        if (activeSessions.rows.length >= sessionLimit) {
          const keepCount = sessionLimit - 1 // Keep N-1 to make room for the new one
          const sessionsToRevoke = activeSessions.rows.slice(Math.max(0, keepCount))
          for (const row of sessionsToRevoke) {
            await invalidateSession(row.session_id, 'system:limit-enforcement')
          }
          console.log(`[Auth] Evicted ${sessionsToRevoke.length} session(s) for user ${userId} (limit: ${sessionLimit})`)
        }
      } catch (limitErr) {
        // Don't block login if session limit enforcement fails
        console.warn('[Auth] Session limit enforcement failed (non-fatal):', limitErr.message)
      }

      // Capture user session details (IP, device, geolocation, WebSocket events)
      const sessionId = await captureSession(req, userId, 'web')

      // Generate tokens — embed sessionId so middleware can validate session is active
      const token = generateToken(userId, user.role, {
        claims: sessionId ? { sessionId } : {}
      })
      const refreshToken = generateToken(
        userId,
        user.role,
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
          claims: {
            refreshTokenVersion: user.refresh_token_version || 0,
            ...(sessionId ? { sessionId } : {})
          },
        }
      )

      setAuthCookies(res, { token, refreshToken })

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          token,
          sessionId
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
      const existingUsers = await global.dbHelpers.find('users', { email })
      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email',
        })
      }

      // Hash password
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)

      // Create user
      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        mobile: mobile || '',
        role: 'user',
        isProUser: false,
        isEmailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const newUser = await global.dbHelpers.insertOne('users', userData)

       // Generate tokens
       const userId = newUser._id || newUser.id
       const token = generateToken(userId, newUser.role)
       const refreshToken = generateToken(
         userId,
         newUser.role,
         {
           secret: process.env.JWT_REFRESH_SECRET,
           expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
           claims: { refreshTokenVersion: 0 }, // New users start at 0
         }
       )

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

       // Remove password from response
       const { password: _, ...userWithoutPassword } = newUser

       res.status(201).json({
         success: true,
         message: 'Registration successful',
         data: {
           user: userWithoutPassword,
           token,
         },
       })
    } catch (error) {
      next(error)
    }
  },

  // POST /api/auth/google
  googleLogin: async (req, res, next) => {
    try {
      const { credential } = req.body
      if (!credential) {
        return res.status(400).json({ success: false, message: 'Google credential is required' })
      }

      // Verify Google Token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()
      const { email, name, picture, email_verified } = payload

      if (!email_verified) {
        return res.status(400).json({ success: false, message: 'Google email is not verified' })
      }

      const ipAddress = getClientIp(req)
      const userAgent = req.headers['user-agent']

      let user
      const users = await global.dbHelpers.find('users', { email: email.toLowerCase() })

      if (users.length > 0) {
        user = users[0]
        if (user.isActive === false || user.isDeactivated === true) {
          return res.status(403).json({ success: false, message: 'Your account has been deactivated.' })
        }
      } else {
        // Create new user since they don't exist
        const salt = await bcrypt.genSalt(10)
        const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(-10) + 'A1!', salt)
        
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
        user = await global.dbHelpers.insertOne('users', userData)
      }

      await recordLoginAttempt(email, ipAddress, true, userAgent)
      const userId = user._id || user.id

      const sessionId = await captureSession(req, userId, 'web')

      const token = generateToken(userId, user.role, { claims: sessionId ? { sessionId } : {} })
      const refreshToken = generateToken(userId, user.role, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
        claims: { refreshTokenVersion: user.refresh_token_version || 0, ...(sessionId ? { sessionId } : {}) }
      })

      setAuthCookies(res, { token, refreshToken })
      const { password: _, ...userWithoutPassword } = user

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          token,
          sessionId
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
         await global.dbHelpers.query(
           'UPDATE users SET refresh_token_version = refresh_token_version + 1 WHERE id = $1',
           [req.user.id]
         )
       }
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
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      )

      // Find user
      const users = await global.dbHelpers.find('users', { _id: decoded.id })
      if (users.length === 0) {
        clearAuthCookies(res)
        return res.status(401).json({
          success: false,
          message: 'User not found',
        })
      }

       const user = users[0]

       // Check refresh token version to ensure token hasn't been revoked
       const tokenVersion = decoded.refreshTokenVersion || 0
       const currentUserVersion = user.refresh_token_version || 0
       if (tokenVersion !== currentUserVersion) {
         // Token version mismatch - likely revoked (e.g., logout from another device, password change)
         clearAuthCookies(res)
         return res.status(401).json({
           success: false,
           message: 'Refresh token invalidated. Please log in again.',
         })
       }

       // Generate new tokens
       const token = generateToken(decoded.id, decoded.role)
       const newRefreshToken = generateToken(
         decoded.id,
         decoded.role,
         {
           secret: process.env.JWT_REFRESH_SECRET,
           expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
           claims: { refreshTokenVersion: currentUserVersion },
         }
       )

       setAuthCookies(res, { token, refreshToken: newRefreshToken })

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: { token },
      })
    } catch (error) {
      clearAuthCookies(res)
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
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

      const users = await global.dbHelpers.find('users', { email })
      if (users.length === 0) {
        // Don't reveal if user exists or not for security
        return res.status(200).json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
        })
      }

      const user = users[0]

      // Generate reset token
      const resetToken = jwt.sign(
        { id: user._id || user.id, type: 'password-reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      )

      // Save reset token to user
      await global.dbHelpers.updateById('users', user._id || user.id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      })

      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      const emailResult = await emailService.sendPasswordResetEmail(email, resetLink);

      if (emailResult && emailResult.success === false) {
        console.warn('Failed to send password reset email:', emailResult.error || emailResult.message);
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
        decoded = jwt.verify(token, process.env.JWT_SECRET)
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

      // Find user and verify token hasn't been used already
      const users = await global.dbHelpers.find('users', {
        _id: decoded.id,
        resetPasswordToken: token,
      })

      if (users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or already used reset token',
        })
      }

      const user = users[0]

      // Hash new password
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(newPassword, salt)

      // Update user - Clear token immediately to prevent reuse
      await global.dbHelpers.updateById('users', user._id || user.id, {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        updatedAt: new Date().toISOString(),
      })

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

      const users = await global.dbHelpers.find('users', { _id: req.user.id })
      const user = users[0]

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        })
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        })
      }

      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(newPassword, salt)

      await global.dbHelpers.updateById('users', user._id || user.id, {
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
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
      const users = await global.dbHelpers.find('users', { _id: decoded.id })
      if (users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User not found',
        })
      }

      const user = users[0]

      if (user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: 'Email is already verified',
        })
      }

      // Update user
      await global.dbHelpers.updateById('users', user._id || user.id, {
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
}
