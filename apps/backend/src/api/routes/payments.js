import express from 'express'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import { protect } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { applyPercentageDiscount } from '../../shared/utils/money.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js'

const router = express.Router()

// Helper to get payment settings
const getPaymentSettings = async () => {
  const settings = await dbHelpers.find('appSettings')
  const appSettings = settings[0] || {}
  
  // payment column uses snake_case keys from the DB JSONB
  const payment = appSettings.payment || {}
  
  // Support both snake_case (DB) and camelCase (env) variants
  const razorpayKeyId = payment.razorpay_key_id || payment.razorpayKeyId || process.env.RAZORPAY_KEY_ID
  const razorpayKeySecret = payment.razorpay_key_secret || payment.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET

  return {
    razorpayKeyId: razorpayKeyId || null,
    razorpayKeySecret: razorpayKeySecret || null,
    currency: payment.currency || 'INR'
  }
}

// Helper to validate coupon
const validateCouponHelper = async (couponCode, amount, userId, planId) => {
  if (!couponCode) return { valid: false, message: 'Coupon code required' }
  
  // Find coupon
  const coupons = await dbHelpers.find('coupons', { code: couponCode, isActive: true })
  const coupon = coupons[0]
  if (!coupon) return { valid: false, message: 'Invalid coupon code' }

  // Check valid dates
  const now = new Date()
  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return { valid: false, message: 'Coupon is not active yet' }
  }
  if (coupon.validUntil && new Date(coupon.validUntil) < now) {
    return { valid: false, message: 'Coupon has expired' }
  }

  // Check usage limit
  const limit = Number(coupon.usageLimit || 0)
  const count = Number(coupon.usedCount || coupon.usageCount || 0)
  if (limit > 0 && count >= limit) {
    return { valid: false, message: 'Coupon usage limit reached' }
  }

  // Check min order value/purchase
  const minVal = Number(coupon.minPurchase || coupon.minOrderValue || 0)
  if (amount < minVal) {
    return { valid: false, message: `Minimum purchase amount of ${minVal} required` }
  }

  // Check applicable plans
  if (coupon.applicablePlans && Array.isArray(coupon.applicablePlans) && coupon.applicablePlans.length > 0) {
    if (!coupon.applicablePlans.includes(planId)) {
      return { valid: false, message: 'Coupon is not applicable to this plan' }
    }
  }

  // Check one per user
  if (coupon.onePerUser !== false) {
    const usedBy = Array.isArray(coupon.usedByUsers) ? coupon.usedByUsers : []
    if (usedBy.includes(userId)) {
      return { valid: false, message: 'You have already used this coupon' }
    }
  }

  // Calculate discount — integer paise math to avoid float rounding (M8)
  let discount = 0
  const val = Number(coupon.discountValue || 0)
  let finalAmount = amount
  if (coupon.discountType === 'percentage') {
    const result = applyPercentageDiscount(amount, val, Number(coupon.maxDiscount || 0))
    discount = result.discountRupees
    finalAmount = result.finalRupees
  } else {
    // fixed
    discount = val
    finalAmount = Math.max(0, amount - val)
  }

  return {
    valid: true,
    coupon,
    discount,
    finalAmount
  }
}

// @route   POST /api/payments/validate-coupon
// @desc    Validate a coupon code
// @access  Private
router.post('/validate-coupon', protect, asyncHandler(async (req, res) => {
  const { couponCode, amount, planId } = req.body
  if (!couponCode || !amount || !planId) {
    return res.status(400).json({
      success: false,
      message: 'Coupon code, amount, and plan ID are required'
    })
  }

  const validation = await validateCouponHelper(couponCode, Number(amount), req.user.id, planId)
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: validation.message
    })
  }

  res.json({
    success: true,
    discount: validation.discount,
    finalAmount: validation.finalAmount,
    data: {
      code: couponCode,
      discount: validation.discount,
      finalAmount: validation.finalAmount
    }
  })
}))

// @route   POST /api/payments/apply-coupon (alias for /validate-coupon)
router.post('/apply-coupon', protect, asyncHandler(async (req, res) => {
  const { couponCode, amount, planId } = req.body
  if (!couponCode || !amount || !planId) {
    return res.status(400).json({
      success: false,
      message: 'Coupon code, amount, and plan ID are required'
    })
  }

  const validation = await validateCouponHelper(couponCode, Number(amount), req.user.id, planId)
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: validation.message
    })
  }

  res.json({
    success: true,
    discount: validation.discount,
    finalAmount: validation.finalAmount,
    data: {
      code: couponCode,
      discount: validation.discount,
      finalAmount: validation.finalAmount
    }
  })
}))

// @route   POST /api/payments/create-order
// @desc    Create a Razorpay order
// @access  Private
router.post('/create-order', protect, async (req, res) => {
  try {
    const { planId, amount, couponCode } = req.body
    
    if (!planId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID and amount are required'
      })
    }

    // Validate amount is a positive number within reasonable range
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      })
    }

    // Server-side price validation: look up the plan and verify amount matches
    let originalAmount = parsedAmount
    try {
      const plans = await dbHelpers.find('subscription_plans')
      const plan = plans.find(p => p.id === planId || p.slug === planId || p.plan_id === planId)
      if (plan) {
        const expectedAmount = Number(plan.price || plan.amount || 0)
        if (expectedAmount > 0) {
          originalAmount = expectedAmount
        }
      }
    } catch (e) {
      // If plans table doesn't exist, continue with client amount (fallback)
    }

    let finalAmount = originalAmount
    let discount = 0

    if (couponCode) {
      const validation = await validateCouponHelper(couponCode, originalAmount, req.user.id, planId)
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message
        })
      }
      finalAmount = validation.finalAmount
      discount = validation.discount
    }

    const { razorpayKeyId, razorpayKeySecret, currency } = await getPaymentSettings()

    if (!razorpayKeyId || !razorpayKeySecret) {
      if (process.env.NODE_ENV !== 'production') {
        const mockOrderId = `order_mock_${Date.now()}_${req.user.id}`
        return res.json({
          success: true,
          data: {
            orderId: mockOrderId,
            amount: Math.round(finalAmount * 100),
            currency: currency || 'INR',
            keyId: 'rzp_test_mock_sandbox',
            isMock: true
          }
        })
      }
      return res.status(503).json({
        success: false,
        message: 'Payment gateway not configured. Please contact administrator.'
      })
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    })

    const options = {
      amount: Math.round(finalAmount * 100), // amount in the smallest currency unit
      currency: currency,
      receipt: `receipt_order_${Date.now()}_${req.user.id}`,
      notes: {
        planId,
        userId: req.user.id,
        couponCode: couponCode || '',
        discount: String(discount),
        originalAmount: String(originalAmount)
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
      message: 'Payment processing failed. Please try again.'
    })
  }
})

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment signature
// @access  Private
router.post('/verify', protect, asyncHandler(async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      couponCode
    } = req.body

    const { razorpayKeySecret } = await getPaymentSettings()

    const isMockOrder = razorpay_order_id?.startsWith('order_mock_')
    let isSignatureValid = false

    if (isMockOrder && process.env.NODE_ENV !== 'production') {
      isSignatureValid = true
    } else if (razorpayKeySecret) {
      const body = razorpay_order_id + "|" + razorpay_payment_id
      const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body.toString())
        .digest('hex')

      const expectedBuf = Buffer.from(expectedSignature, 'utf8')
      const actualBuf = Buffer.from(razorpay_signature || '', 'utf8')
      isSignatureValid = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)
    }

    if (isSignatureValid) {
      // Payment verified

      // Idempotency guard: if we have already recorded a transaction for this
      // Razorpay order, the user has already been upgraded. Replay of the same
      // verified signature (intentional or accidental) must NOT grant Pro a
      // second time or re-increment coupon usage. Mirrors the guard on the
      // webhook handler below.
      const alreadyProcessed = await dbHelpers.findOne('transactions', { orderId: razorpay_order_id })
      if (alreadyProcessed) {
        return res.json({
          success: true,
          message: 'Payment already verified',
          data: { proExpiry: alreadyProcessed.planId === 'pro-yearly' ? undefined : undefined }
        })
      }

      // SECURITY: Derive planId from the Razorpay order's notes — NOT from the
      // client-supplied req.body.planId. The order was created by our backend in
      // /create-order with `notes.planId` set to the server-validated value, so
      // it is authoritative.
      const { razorpayKeyId, razorpayKeySecret } = await getPaymentSettings()
      let authoritativePlanId = planId

      if (!isMockOrder && razorpayKeyId && razorpayKeySecret) {
        const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
        try {
          const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id)
          authoritativePlanId = razorpayOrder.notes?.planId || planId
          // Also validate the amount paid matches the plan price
          const expectedPlan = (await dbHelpers.find('subscription_plans')).find(
            p => p.id === authoritativePlanId || p.slug === authoritativePlanId || p.plan_id === authoritativePlanId
          )
          if (expectedPlan) {
            const expectedAmountPaise = Math.round(Number(expectedPlan.price || expectedPlan.amount || 0) * 100)
            if (razorpayOrder.amount_paid > 0 && razorpayOrder.amount_paid !== expectedAmountPaise) {
              console.error(`[Payments] Amount mismatch: order ${razorpay_order_id} paid ${razorpayOrder.amount_paid} paise, expected ${expectedAmountPaise} paise for plan ${authoritativePlanId}`)
              return res.status(400).json({
                success: false,
                message: 'Payment amount does not match the selected plan. Please contact support.',
              })
            }
          }
        } catch (orderFetchErr) {
          console.error('[Payments] Failed to fetch order for plan verification:', orderFetchErr.message)
          // Fail-closed: don't grant Pro if we can't verify the plan from the order.
          return res.status(400).json({
            success: false,
            message: 'Unable to verify payment details. Please contact support.',
          })
        }
      }

      // Update user status
      const user = await dbHelpers.findById('users', req.user.id)
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' })
      }

      // Calculate expiry based on the AUTHORITATIVE planId (from Razorpay order)
      let expiryDays = 30
      if (authoritativePlanId === 'pro-yearly') expiryDays = 365
      
      const proExpiry = new Date()
      proExpiry.setDate(proExpiry.getDate() + expiryDays)

      await dbHelpers.updateById('users', req.user.id, {
        isProUser: true,
        proExpiry: proExpiry.toISOString()
      })

      // Record coupon usage if applied
      if (couponCode) {
        try {
          const coupons = await dbHelpers.find('coupons', { code: couponCode, isActive: true })
          const coupon = coupons[0]
          if (coupon) {
            const usedBy = Array.isArray(coupon.usedByUsers) ? coupon.usedByUsers : []
            if (!usedBy.includes(req.user.id)) {
              usedBy.push(req.user.id)
              await dbHelpers.updateById('coupons', coupon.id || coupon._id, {
                usedCount: (Number(coupon.usedCount || 0) + 1),
                usedByUsers: usedBy
              })
            }
          }
        } catch (couponErr) {
          console.error('Error updating coupon usage in verify:', couponErr.message)
        }
      }

      // Record transaction
      try {
        await dbHelpers.insertOne('transactions', {
          userId: req.user.id,
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: req.body.amount || (expiryDays === 365 ? 999 : 99),
          currency: 'INR',
          status: 'completed',
          planId: authoritativePlanId,
          createdAt: new Date().toISOString()
        })
      } catch (txnErr) {
        console.error('Error recording transaction in verify:', txnErr.message)
      }
      
      res.json({
        success: true,
        message: 'Payment verified successfully and Pro status updated'
      })

      // Send payment confirmation email
      try {
        const { default: emailService } = await import('../../services/EmailService.js')
        await emailService.sendEmail(user.email, 'Payment Confirmed', `
          <h2>Payment Confirmed</h2>
          <p>Your Pro Pass has been activated.</p>
          <p>Expiry: ${proExpiry.toLocaleDateString()}</p>
          <p>Thank you for your purchase!</p>
        `)
      } catch (e) {
        console.error('Payment confirmation email error:', e.message)
      }
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
      message: 'Payment verification failed. Please try again.'
    })
  }
}))

// @route   POST /api/payments/webhook
// @desc    Handle Razorpay webhook for payment confirmation
// @access  Public (but verify signature)
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body.toString()
    try {
      req.body = JSON.parse(req.rawBody)
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid JSON' })
    }
    next()
  },
  async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) {
      console.error('Razorpay webhook secret not configured')
      return res.status(500).json({ success: false, message: 'Webhook not configured' })
    }

    const rawBody = req.rawBody

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    const razorpaySignature = req.headers['x-razorpay-signature']
    const expectedBuf = Buffer.from(expectedSignature, 'utf8')
    const actualBuf = Buffer.from(razorpaySignature || '', 'utf8')
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return res.status(400).json({ success: false, message: 'Invalid signature' })
    }

    const event = req.body.event
    const paymentEntity = req.body.payload.payment.entity

    if (event === 'payment.captured') {
      // Payment was successfully captured
      const orderId = paymentEntity.order_id
      const userId = paymentEntity.notes?.userId
      const planId = paymentEntity.notes?.planId
      const couponCode = paymentEntity.notes?.couponCode

      if (userId) {
        const gatewayPaymentId = paymentEntity.id

        // Idempotency guard: skip if this gateway payment was already processed
        // (Razorpay retries webhooks on delivery failure).
        const alreadyProcessed = await dbHelpers.findOne('transactions', { paymentId: gatewayPaymentId })
        if (alreadyProcessed) {
          return res.json({ success: true, message: 'Webhook already processed' })
        }

        await dbHelpers.withTransaction(async (client) => {
          // Update user status
          const user = await dbHelpers.findById('users', userId)
          if (!user) return

          let expiryDays = 30
          if (planId === 'pro-yearly') expiryDays = 365

          const proExpiry = new Date()
          proExpiry.setDate(proExpiry.getDate() + expiryDays)

          await dbHelpers.updateById('users', userId, {
            isProUser: true,
            proExpiry: proExpiry.toISOString()
          }, client)

          // Record coupon usage if applied
          if (couponCode) {
            try {
              const coupons = await dbHelpers.find('coupons', { code: couponCode, isActive: true })
              const coupon = coupons[0]
              if (coupon) {
                const usedBy = Array.isArray(coupon.usedByUsers) ? coupon.usedByUsers : []
                if (!usedBy.includes(userId)) {
                  usedBy.push(userId)
                  await dbHelpers.updateById('coupons', coupon.id || coupon._id, {
                    usedCount: (Number(coupon.usedCount || 0) + 1),
                    usedByUsers: usedBy
                  }, client)
                }
              }
            } catch (couponErr) {
              console.error('Error updating coupon usage in webhook:', couponErr.message)
            }
          }

          // Record transaction
          await dbHelpers.insertOne('transactions', {
            userId,
            orderId,
            paymentId: gatewayPaymentId,
            amount: paymentEntity.amount / 100,
            currency: paymentEntity.currency,
            status: 'completed',
            planId,
            createdAt: new Date().toISOString()
          }, client)
        })
      }
    } else if (event === 'refund.created' || event === 'refund.processed') {
      const refundEntity = req.body.payload?.refund?.entity || {}
      const gatewayPaymentId = refundEntity.payment_id || paymentEntity?.id
      const refundId = refundEntity.id

      if (gatewayPaymentId) {
        const existingTx = await dbHelpers.findOne('transactions', { paymentId: gatewayPaymentId })
        if (existingTx && existingTx.status === 'refunded') {
          return res.json({ success: true, message: 'Refund webhook already processed' })
        }

        await dbHelpers.withTransaction(async (client) => {
          if (existingTx) {
            await dbHelpers.updateById('transactions', existingTx.id || existingTx._id, {
              status: 'refunded',
              refundId: refundId || null,
              updatedAt: new Date().toISOString()
            }, client)

            if (existingTx.userId) {
              await dbHelpers.updateById('users', existingTx.userId, {
                isProUser: false,
                proExpiry: null
              }, client)
            }
          }
        })
      }
    }

    res.json({ success: true, message: 'Webhook processed' })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ success: false, message: 'Webhook processing failed' })
  }
})

export default router
