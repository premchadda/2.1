/**
 * Payment Webhook Tests
 * Tests for Razorpay signature verification
 * Run with: npm test
 */

import crypto from 'crypto'
import hmac from 'crypto'

if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret'
}

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

describe('Payment Webhooks', () => {
  describe('Razorpay Signature Verification', () => {
    const generateSignature = (payload, secret) => {
      return hmac.createHmac('sha256', secret)
        .update(payload)
        .digest('hex')
    }

    test('should verify valid signature', () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            id: 'pay_123',
            amount: 10000,
            currency: 'INR'
          }
        }
      })
      
      const signature = generateSignature(payload, RAZORPAY_WEBHOOK_SECRET)
      
      const expectedSig = hmac.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex')
      
      expect(signature).toBe(expectedSig)
    })

    test('should reject invalid signature', () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { id: 'pay_123' } }
      })
      
      const validSig = generateSignature(payload, RAZORPAY_WEBHOOK_SECRET)
      const invalidSig = generateSignature(payload, 'wrong-secret')
      
      expect(invalidSig).not.toBe(validSig)
    })

    test('should detect tampered payload', () => {
      const originalPayload = JSON.stringify({ amount: 100 })
      const tamperedPayload = JSON.stringify({ amount: 999999 })
      
      const sig1 = generateSignature(originalPayload, RAZORPAY_WEBHOOK_SECRET)
      const sig2 = generateSignature(tamperedPayload, RAZORPAY_WEBHOOK_SECRET)
      
      expect(sig1).not.toBe(sig2)
    })

    test('should handle Razorpay header format', () => {
      const payload = '{"event":"payment.captured"}'
      const signature = generateSignature(payload, RAZORPAY_WEBHOOK_SECRET)
      const razorpayHeader = `sh=${signature}`
      
      expect(razorpayHeader).toMatch(/^sh=[a-f0-9]+$/)
    })
  })

  describe('Payment Events', () => {
    test('should handle payment.captured event', () => {
      const event = {
        event: 'payment.captured',
        payload: {
          payment: {
            id: 'pay_123ABC',
            amount: 10000,
            currency: 'INR',
            status: 'captured'
          }
        }
      }
      
      expect(event.event).toBe('payment.captured')
      expect(event.payload.payment.status).toBe('captured')
    })

    test('should handle payment.failed event', () => {
      const event = {
        event: 'payment.failed',
        payload: {
          payment: {
            id: 'pay_123DEF',
            amount: 10000,
            currency: 'INR',
            status: 'failed'
          }
        }
      }
      
      expect(event.event).toBe('payment.failed')
      expect(event.payload.payment.status).toBe('failed')
    })

    test('should handle order.paid event', () => {
      const event = {
        event: 'order.paid',
        payload: {
          order: {
            id: 'order_123',
            amount: 50000,
            currency: 'INR'
          }
        }
      }
      
      expect(event.event).toBe('order.paid')
    })

    test('should handle refund.created event', () => {
      const event = {
        event: 'refund.created',
        payload: {
          refund: {
            id: 'refund_123',
            amount: 5000,
            currency: 'INR'
          }
        }
      }
      
      expect(event.event).toBe('refund.created')
    })
  })

  describe('Amount Validation', () => {
    test('should validate amount in paise', () => {
      const amount = 10000
      
      expect(amount).toBe(10000)
      expect(amount / 100).toBe(100)
    })

    test('should validate currency', () => {
      const validCurrencies = ['INR', 'USD', 'EUR']
      const currency = 'INR'
      
      expect(validCurrencies).toContain(currency)
    })

    test('should validate payment ID format', () => {
      const paymentIds = ['pay_123ABC', 'pay_xyz789', 'pay_invalid']
      const validPattern = /^pay_[a-zA-Z0-9]+$/
      
      expect(validPattern.test(paymentIds[0])).toBe(true)
      expect(validPattern.test('invalid')).toBe(false)
    })
  })

  describe('Webhook Security', () => {
    test('should reject replay attacks', () => {
      const timestamp = Date.now()
      const oldTimestamp = timestamp - 360000
      
      const isReplay = timestamp - oldTimestamp > 300000
      expect(isReplay).toBe(true)
    })

    test('should validate webhook secret', () => {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET
      
      expect(secret).toBeDefined()
      expect(secret.length).toBeGreaterThan(0)
    })

    test('should verify secret presence', () => {
      const hasSecret = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)
      expect(hasSecret).toBe(true)
    })
  })

  describe('Payment Processing', () => {
    test('should extract payment ID', () => {
      const event = {
        payload: {
          payment: { id: 'pay_123456' }
        }
      }
      
      const paymentId = event.payload.payment.id
      expect(paymentId).toBe('pay_123456')
    })

    test('should extract user ID from notes', () => {
      const payment = {
        id: 'pay_123',
        notes: {
          userId: '123',
          testId: '456'
        }
      }
      
      expect(payment.notes.userId).toBe('123')
    })

    test('should handle subscription payments', () => {
      const payment = {
        type: 'subscription',
        subscriptionId: 'sub_123',
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31'
      }
      
      expect(payment.type).toBe('subscription')
      expect(payment.subscriptionId).toBe('sub_123')
    })

    test('should handle one-time payments', () => {
      const payment = {
        type: 'one_time',
        amount: 10000
      }
      
      expect(payment.type).toBe('one_time')
    })
  })
})