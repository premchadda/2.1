import express from 'express'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

// Default referral reward tiers (used when DB config is not available)
const DEFAULT_REFERRAL_REWARDS = [
  { referrals: 1, discount: '10%', bonus: '₹100' },
  { referrals: 3, discount: '15%', bonus: '₹250' },
  { referrals: 5, discount: '20%', bonus: '₹500' },
  { referrals: 10, discount: '25%', bonus: '₹1000' },
  { referrals: 25, discount: '30%', bonus: '₹2500' },
  { referrals: 50, discount: '40%', bonus: '₹5000' },
]

// @route   GET /api/referrals/config
// @desc    Get referral program configuration (reward tiers)
// @access  Public
router.get('/config', async (req, res) => {
  try {
    let rewards = DEFAULT_REFERRAL_REWARDS
    let config = null

    try {
      const result = await pool.query(
        "SELECT value FROM app_settings WHERE key = 'referral_rewards'"
      )
      if (result.rows.length > 0) {
        config = typeof result.rows[0].value === 'string'
          ? JSON.parse(result.rows[0].value)
          : result.rows[0].value
        if (config?.rewards && Array.isArray(config.rewards)) {
          rewards = config.rewards
        }
      }
    } catch {
      // app_settings table may not exist yet — use defaults
    }

    res.json({
      success: true,
      data: { rewards, ...(config || {}) },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   GET /api/referrals
// @desc    Get user's referral stats
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id
    
    // Get user's referral code
    const referrals = await dbHelpers.find('referrals', { referrerId: userId })
    
    // Calculate stats
    const stats = {
      totalReferrals: referrals.length,
      successfulReferrals: referrals.filter(r => r.status === 'completed').length,
      pendingReferrals: referrals.filter(r => r.status === 'pending').length,
      totalEarnings: referrals
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.reward || 0), 0),
      pendingRewards: referrals.filter(r => r.status === 'pending').length
    }
    
    // Get user's referral code
    const user = await dbHelpers.findById('users', userId)
    const referralCode = user?.referralCode || `TRSTPREP${userId}`.toUpperCase()
    
    res.json({
      success: true,
      data: {
        referralCode,
        stats,
        referrals: referrals.slice(0, 20)
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

// @route   POST /api/referrals
// @desc    Register a new referral
// @access  Public (called during signup)
router.post('/', async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body
    
    if (!referralCode || !newUserId) {
      return res.status(400).json({
        success: false,
        message: 'Referral code and new user ID required'
      })
    }
    
    // OPTIMIZED: Query specific referrer instead of fetching all users (DoS prevention)
    let referrer = await dbHelpers.findOne('users', { referralCode })
    
    if (!referrer) {
      // Try resolving TRSTPREP{id} format
      const idMatch = referralCode.match(/^TRSTPREP(\d+)$/i)
      if (idMatch) {
        referrer = await dbHelpers.findById('users', idMatch[1])
      }
    }
    
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      })
    }
    
    // Create referral record
    const referral = await dbHelpers.insertOne('referrals', {
      referrerId: referrer.id || referrer._id,
      referredUserId: newUserId,
      status: 'pending',
      reward: 0,
      createdAt: new Date().toISOString()
    })
    
    res.status(201).json({
      success: true,
      data: referral
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

// @route   PUT /api/referrals/:id/complete
// @desc    Mark referral as completed (after payment)
// @access  Private (admin only)
router.put('/:id/complete', protect, admin, async (req, res) => {
  try {
    const { reward = 500 } = req.body
    
    const referral = await dbHelpers.updateById('referrals', req.params.id, {
      status: 'completed',
      reward,
      completedAt: new Date().toISOString()
    })
    
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found'
      })
    }
    
    res.json({
      success: true,
      data: referral
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

export default router
