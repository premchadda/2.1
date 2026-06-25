/**
 * Basic validation tests for input validation middleware
 * Run with: npm test
 */

import { validators, createSchema } from '../middleware/validation/inputValidation.js'

describe('Input Validation', () => {
  describe('validators', () => {
    test('isNonEmptyString validates strings correctly', () => {
      expect(validators.isNonEmptyString('hello')).toBe(true)
      expect(validators.isNonEmptyString('')).toBe(false)
      expect(validators.isNonEmptyString(123)).toBe(false)
      expect(validators.isNonEmptyString(null)).toBe(false)
    })

    test('isValidEmail validates emails correctly', () => {
      expect(validators.isValidEmail('test@example.com')).toBe(true)
      expect(validators.isValidEmail('invalid-email')).toBe(false)
      expect(validators.isValidEmail('')).toBe(false)
    })

    test('isValidId validates IDs correctly', () => {
      expect(validators.isValidId('123')).toBe(true)
      expect(validators.isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(validators.isValidId('invalid')).toBe(false)
    })

    test('isPositiveInteger validates positive integers', () => {
      expect(validators.isPositiveInteger('123')).toBe(true)
      expect(validators.isPositiveInteger('0')).toBe(false)
      expect(validators.isPositiveInteger('-5')).toBe(false)
      expect(validators.isPositiveInteger('abc')).toBe(false)
    })

    test('sanitizeString removes XSS attempts', () => {
      const malicious = '<script>alert("xss")</script>Hello'
      const sanitized = validators.sanitizeString(malicious)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('Hello')
    })
  })

  describe('ValidationSchema', () => {
    test('validates required fields', () => {
      const schema = createSchema()
        .field('name', { required: true })
        .field('email', { type: 'email', required: true })

      const valid = schema.validate({ name: 'John', email: 'john@example.com' })
      expect(valid.isValid).toBe(true)
      expect(valid.errors).toHaveLength(0)

      const invalid = schema.validate({ name: 'John' })
      expect(invalid.isValid).toBe(false)
      expect(invalid.errors[0].field).toBe('email')
    })

    test('validates email type', () => {
      const schema = createSchema()
        .field('email', { type: 'email', required: true })

      const valid = schema.validate({ email: 'test@example.com' })
      expect(valid.isValid).toBe(true)

      const invalid = schema.validate({ email: 'not-an-email' })
      expect(invalid.isValid).toBe(false)
      expect(invalid.errors[0].code).toBe('INVALID_EMAIL')
    })

    test('validates string length', () => {
      const schema = createSchema()
        .field('username', { minLength: 3, maxLength: 10 })

      const valid = schema.validate({ username: 'john' })
      expect(valid.isValid).toBe(true)

      const tooShort = schema.validate({ username: 'jo' })
      expect(tooShort.isValid).toBe(false)

      const tooLong = schema.validate({ username: 'verylongusername' })
      expect(tooLong.isValid).toBe(false)
    })
  })
})

describe('API Health Check', () => {
  test('basic health check structure', () => {
    // This is a placeholder test to demonstrate testing structure
    const healthResponse = {
      status: 'ok',
      message: 'API is running',
      timestamp: new Date().toISOString()
    }

    expect(healthResponse).toHaveProperty('status')
    expect(healthResponse).toHaveProperty('timestamp')
    expect(healthResponse.status).toBe('ok')
  })
})