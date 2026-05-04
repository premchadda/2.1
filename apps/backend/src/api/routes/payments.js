import express from 'express'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import { protect } from '../../middleware/auth.middleware.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// Helper to get payment settings
const getPaymentSettings = async () => {
  const settings = await dbHelpers.find('appSettings')
  const appSettings = settings[0] || {}
  
  // Try to get from payment column (JSONB) or root fields
  const payment = appSettings.payment || {}
  
  return {
    razorpayKeyId: payment.razorpayKeyId || process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: payment.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET,
    currency: payment.currency || 'INR'
  }
}

// @route   POST /api/payments/create-order
// @desc    Create a Razorpay order
// @access  Private
router.post('/create-order', protect, async (req, res) => {
  try {
    const { planId, amount } = req.body
    
    if (!planId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID and amount are required'
      })
    }

    const { razorpayKeyId, razorpayKeySecret, currency } = await getPaymentSettings()

    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not configured'
      })
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    })

    const options = {
      amount: Math.round(amount * 100), // amount in the smallest currency unit
      currency: currency,
      receipt: `receipt_order_${Date.now()}_${req.user.id}`,
      notes: {
        planId,
        userId: req.user.id
      }
    }

    const order = await razorpay.orders.create(options)

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId
      }
    })
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment signature
// @access  Private
router.post('/verify', protect, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId
    } = req.body

    const { razorpayKeySecret } = await getPaymentSettings()

    const body = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(body.toString())
      .digest('hex')

    if (expectedSignature === razorpay_signature) {
      // Payment verified
      
      // Update user status
      const user = await dbHelpers.findById('users', req.user.id)
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' })
      }

      // Calculate expiry based on plan
      let expiryDays = 30
      if (planId === 'pro-yearly') expiryDays = 365
      
      const proExpiry = new Date()
      proExpiry.setDate(proExpiry.getDate() + expiryDays)

      await dbHelpers.updateById('users', req.user.id, {
        isProUser: true,
        proExpiry: proExpiry.toISOString()
      })

      // Record transaction
      // Assuming we have a transactions table or similar, but for now just update user
      
      res.json({
        success: true,
        message: 'Payment verified successfully and Pro status updated'
      })
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid signature'
      })
    }
  } catch (error) {
    console.error('Verify payment error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   POST /api/payments/webhook
// @desc    Handle Razorpay webhook for payment confirmation
// @access  Public (but verify signature)
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) {
      console.error('Razorpay webhook secret not configured')
      return res.status(500).json({ success: false, message: 'Webhook not configured' })
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex')

    const razorpaySignature = req.headers['x-razorpay-signature']
    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' })
    }

    const event = req.body.event
    const paymentEntity = req.body.payload.payment.entity

    if (event === 'payment.captured') {
      // Payment was successfully captured
      const orderId = paymentEntity.order_id
      const userId = paymentEntity.notes?.userId
      const planId = paymentEntity.notes?.planId

      if (userId) {
        // Update user status
        const user = await dbHelpers.findById('users', userId)
        if (user) {
          let expiryDays = 30
          if (planId === 'pro-yearly') expiryDays = 365

          const proExpiry = new Date()
          proExpiry.setDate(proExpiry.getDate() + expiryDays)

          await dbHelpers.updateById('users', userId, {
            isProUser: true,
            proExpiry: proExpiry.toISOString()
          })

          // Record transaction
          await dbHelpers.insert('transactions', {
            userId,
            orderId,
            paymentId: paymentEntity.id,
            amount: paymentEntity.amount / 100,
            currency: paymentEntity.currency,
            status: 'completed',
            planId,
            createdAt: new Date().toISOString()
          })
        }
      }
    }

    res.json({ success: true, message: 'Webhook processed' })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ success: false, message: 'Webhook processing failed' })
  }
})

export default router
