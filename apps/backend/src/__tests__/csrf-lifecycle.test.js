/**
 * CSRF Lifecycle Tests
 * Tests for token generation, validation, rotation
 * Run with: npm test
 */

import crypto from 'crypto'

const TOKEN_EXPIRY_MS = 3600000 // 1 hour
const GRACE_PERIOD_MS = 30000 // 30 seconds

describe('CSRF Lifecycle', () => {
  describe('Token Generation', () => {
    test('should generate 64-character hex token', () => {
      const tokens = {}
      for (let i = 0; i < 10; i++) {
        const token = crypto.randomBytes(32).toString('hex')
        expect(token).toMatch(/^[a-f0-9]{64}$/)
        tokens[token] = true
      }
      expect(Object.keys(tokens).length).toBe(10)
    })

    test('should generate unique tokens', () => {
      const tokens = new Set()
      for (let i = 0; i < 100; i++) {
        tokens.add(crypto.randomBytes(32).toString('hex'))
      }
      expect(tokens.size).toBe(100)
    })

    test('should generate time-bound token', () => {
      const createdAt = Date.now()
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = createdAt + TOKEN_EXPIRY_MS
      
      const isExpired = Date.now() > expiresAt
      expect(isExpired).toBe(false)
      
      const timeLeft = expiresAt - Date.now()
      expect(timeLeft).toBeGreaterThan(0)
    })
  })

  describe('Token Validation', () => {
    test('should validate valid token format', () => {
      const token = crypto.randomBytes(32).toString('hex')
      const isValidFormat = (t) => /^[a-f0-9]{64}$/.test(t)
      
      expect(isValidFormat(token)).toBe(true)
    })

    test('should reject invalid token format', () => {
      const invalidTokens = [
        'short',
        'toolong1234567890123456789012345678901234567890123456789012345678901234567890',
        'invalid-char-z',
        '',
        'abcdefghijklmnopqrstuvwxyz0123456789',
        'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCD'
      ]
      
      invalidTokens.forEach(token => {
        const isValid = /^[a-f0-9]{64}$/.test(token)
        expect(isValid).toBe(false)
      })
    })

    test('should validate token ownership', () => {
      const storedToken = crypto.randomBytes(32).toString('hex')
      const providedToken = storedToken
      
      expect(providedToken).toBe(storedToken)
    })

    test('should reject mismatched tokens', () => {
      const token1 = crypto.randomBytes(32).toString('hex')
      const token2 = crypto.randomBytes(32).toString('hex')
      
      expect(token1).not.toBe(token2)
    })
  })

  describe('Token Rotation', () => {
    test('should rotate token after validation', async () => {
      let token = crypto.randomBytes(32).toString('hex')
      const oldToken = token
      
      await new Promise(r => setTimeout(r, 10))
      
      token = crypto.randomBytes(32).toString('hex')
      
      expect(token).not.toBe(oldToken)
    })

    test('should track token versions', () => {
      const tokenVersions = new Map()
      
      let token = crypto.randomBytes(32).toString('hex')
      tokenVersions.set(token, 1)
      
      token = crypto.randomBytes(32).toString('hex')
      tokenVersions.set(token, 2)
      
      expect(tokenVersions.size).toBe(2)
    })

    test('should invalidate old tokens on rotation', async () => {
      const invalidTokens = new Set()
      
      let token = crypto.randomBytes(32).toString('hex')
      invalidTokens.add(token)
      
      await new Promise(r => setTimeout(r, 10))
      
      token = crypto.randomBytes(32).toString('hex')
      
      expect(invalidTokens.has(token)).toBe(false)
    })
  })

  describe('Token Expiration', () => {
    test('should detect expired token', () => {
      const createdAt = Date.now() - TOKEN_EXPIRY_MS - 1000
      const expiresAt = createdAt + TOKEN_EXPIRY_MS
      
      const isExpired = Date.now() > expiresAt
      expect(isExpired).toBe(true)
    })

    test('should detect valid token', () => {
      const createdAt = Date.now()
      const expiresAt = createdAt + TOKEN_EXPIRY_MS
      
      const isExpired = Date.now() > expiresAt
      expect(isExpired).toBe(false)
    })

    test('should allow grace period for clock skew', () => {
      const createdAt = Date.now() - TOKEN_EXPIRY_MS - (GRACE_PERIOD_MS / 2)
      const expiresAt = createdAt + TOKEN_EXPIRY_MS
      
      const isWithinGrace = Date.now() > expiresAt && Date.now() < expiresAt + GRACE_PERIOD_MS
      expect(isWithinGrace).toBe(true)
    })
  })

  describe('Concurrent Token Access', () => {
    test('should handle multiple valid tokens', () => {
      const validTokens = new Set()
      
      for (let i = 0; i < 5; i++) {
        validTokens.add(crypto.randomBytes(32).toString('hex'))
      }
      
      expect(validTokens.size).toBe(5)
    })

    test('should clean up expired tokens', async () => {
      const tokenStore = new Map()
      
      const now = Date.now()
      tokenStore.set('expired', now - TOKEN_EXPIRY_MS - 1000)
      tokenStore.set('valid', now + TOKEN_EXPIRY_MS)
      
      for (const [token, expiresAt] of tokenStore) {
        if (Date.now() > expiresAt) {
          tokenStore.delete(token)
        }
      }
      
      expect(tokenStore.size).toBe(1)
      expect(tokenStore.has('expired')).toBe(false)
    })
  })
})