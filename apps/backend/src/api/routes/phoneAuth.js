import express from 'express'
import { auth } from '../../middleware/auth.middleware.js'
import crypto from 'crypto'
import SmsService from '../../services/SmsService.js'
import jwt from 'jsonwebtoken'
import EmailService from '../../services/EmailService.js'

const router = express.Router()

// OTP storage (use Redis in production)
const otpStore = global.redis || new Map()

/**
 * POST /api/auth/phone/send-otp
 * Send OTP to phone number via SMS
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body

    // Validate phone number (10 digits for India)
    if (!phoneNumber || !phoneNumber.match(/^[0-9]{10}$/)) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format (10 digits required)' })
    }

    // Check rate limiting (max 3 OTPs per hour)
    const rateLimitKey = `otp:rate:${phoneNumber}`
    const otpCount = await getFromStore(rateLimitKey)
    if (otpCount && parseInt(otpCount) >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Too many OTP requests. Please try again after 1 hour.'
      })
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Store OTP with 10 minute expiry
    const otpKey = `otp:${phoneNumber}`
    const otpData = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      createdAt: Date.now()
    }

    await setInStore(otpKey, JSON.stringify(otpData), 600) // 10 minutes

    // Increment rate limit counter (1 hour expiry)
    if (otpCount) {
      await setInStore(rateLimitKey, String(parseInt(otpCount) + 1), 3600)
    } else {
      await setInStore(rateLimitKey, '1', 3600)
    }

    // Send OTP via SMS (Twilio/AWS SNS)
    const formattedPhone = '+91' + phoneNumber
    const result = await SmsService.sendOtp(formattedPhone, otp)

    if (!result.success && process.env.NODE_ENV !== 'development') {
      return res.status(500).json({
        success: false,
        error: 'Failed to send OTP. Please try again.'
      })
    }

    res.json({
      success: true,
      message: 'OTP sent to your registered mobile number',
      // For testing only
      ...(process.env.NODE_ENV === 'development' && { otp, messageId: result.messageId })
    })
  } catch (error) {
    console.error('Error sending OTP:', error)
    res.status(500).json({ success: false, error: 'Failed to send OTP' })
  }
})

/**
 * POST /api/auth/phone/verify-otp
 * Verify OTP and create/login user
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, name, email } = req.body

    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP required' })
    }

    // Get stored OTP data
    const otpKey = `otp:${phoneNumber}`
    const otpDataStr = await getFromStore(otpKey)
    
    if (!otpDataStr) {
      return res.status(400).json({ success: false, error: 'OTP expired or not requested' })
    }

    const otpData = JSON.parse(otpDataStr)

    // Check if OTP is expired
    if (otpData.expiresAt < Date.now()) {
      await deleteFromStore(otpKey)
      return res.status(400).json({ success: false, error: 'OTP expired' })
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      otpData.attempts++
      if (otpData.attempts >= 3) {
        await deleteFromStore(otpKey)
        return res.status(400).json({ success: false, error: 'Too many failed attempts' })
      }
      // Update attempts counter
      await setInStore(otpKey, JSON.stringify(otpData), 600)
      return res.status(400).json({ success: false, error: 'Invalid OTP' })
    }

    // OTP is valid, find or create user
    let userResult = await global.dbHelpers.query(
      'SELECT id, email, name, phone_verified FROM users WHERE phone = $1',
      [phoneNumber]
    )

    let userId, isNewUser = false
    if (userResult.rows.length === 0) {
      // Create new user
      const createResult = await global.dbHelpers.query(
        `INSERT INTO users (phone, email, name, auth_type, phone_verified, last_login, created_at)
         VALUES ($1, $2, $3, 'phone', true, NOW(), NOW())
         RETURNING id, email, name`,
        [phoneNumber, email || `${phoneNumber}@trstprep.local`, name || `User${phoneNumber.slice(-4)}`]
      )
      userId = createResult.rows[0].id
      isNewUser = true
    } else {
      userId = userResult.rows[0].id
      // Update last login
      await global.dbHelpers.query(
        'UPDATE users SET last_login = NOW(), phone_verified = true WHERE id = $1',
        [userId]
      )
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, phone: phoneNumber, type: 'phone' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    // Clear OTP from store
    await deleteFromStore(otpKey)

    // Send welcome email for new users
    if (isNewUser && email) {
      try {
        EmailService.sendWelcomeEmail(email, name || 'User')
      } catch (err) {
        console.error('Error sending welcome email:', err)
      }
    }

    res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: userId,
        phone: phoneNumber,
        email: userResult.rows[0]?.email || email,
        name
      }
    })
  } catch (error) {
    console.error('Error verifying OTP:', error)
    res.status(500).json({ success: false, error: 'Failed to verify OTP' })
  }
})

/**
 * POST /api/auth/phone/link-phone
 * Link phone to existing account (authenticated)
 */
router.post('/link-phone', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { phoneNumber, otp } = req.body

    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP required' })
    }

    // Verify OTP
    const otpKey = `otp:${phoneNumber}`
    const otpDataStr = await getFromStore(otpKey)
    
    if (!otpDataStr) {
      return res.status(400).json({ success: false, error: 'OTP invalid or expired' })
    }

    const otpData = JSON.parse(otpDataStr)
    if (otpData.otp !== otp || otpData.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP' })
    }

    // Check if phone already linked to another user
    const existingUser = await global.dbHelpers.query(
      'SELECT id FROM users WHERE phone = $1 AND id != $2',
      [phoneNumber, userId]
    )

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Phone already linked to another account' })
    }

    // Update user with phone
    await global.dbHelpers.query(
      'UPDATE users SET phone = $1, phone_verified = true, updated_at = NOW() WHERE id = $2',
      [phoneNumber, userId]
    )

    // Clear OTP
    await deleteFromStore(otpKey)

    res.json({ success: true, message: 'Phone linked successfully' })
  } catch (error) {
    console.error('Error linking phone:', error)
    res.status(500).json({ success: false, error: 'Failed to link phone' })
  }
})

// ========== Helper Functions ==========

async function getFromStore(key) {
  if (global.redis) {
    return await global.redis.get(key)
  } else {
    return otpStore.get(key)
  }
}

async function setInStore(key, value, ttl = 600) {
  if (global.redis) {
    if (ttl) {
      await global.redis.setex(key, ttl, value)
    } else {
      await global.redis.set(key, value)
    }
  } else {
    otpStore.set(key, value)
    // Auto-expire in non-Redis mode (not ideal, for dev only)
    if (ttl) {
      setTimeout(() => otpStore.delete(key), ttl * 1000)
    }
  }
}

async function deleteFromStore(key) {
  if (global.redis) {
    await global.redis.del(key)
  } else {
    otpStore.delete(key)
  }
}

export default router
