import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'

const router = express.Router()

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
      message: error.message
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
      message: error.message
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
      message: error.message
    })
  }
})

export default router
