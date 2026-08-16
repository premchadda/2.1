// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest'
import { settingsSchema, stripSecrets, SECRET_FIELDS } from './settingsSchema.js'

const baseValid = {
  siteName: 'Trstprep',
  siteUrl: 'https://trstprep.com',
  contactEmail: 'support@trstprep.com',
  email:   { smtpPort: 587, encryption: 'tls' },
  payment: { currency: 'INR', taxEnabled: false, taxRate: 18 },
  security: {
    passwordMinLength: 8,
    passwordComplexity: true,
    twoFactorAuth: false,
    maxLoginAttempts: 5,
    sessionTimeout: 3600,
  },
  notifications: {
    emailOnRegistration: true,
    emailOnPayment: true,
    smsOnOrder: false,
    pushNotifications: true,
  },
}

describe('settingsSchema', () => {
  test('accepts a minimally valid settings object', () => {
    const result = settingsSchema.safeParse(baseValid)
    if (!result.success) {
      // Helpful failure message
      throw new Error('Schema rejected valid input: ' + JSON.stringify(result.error.issues, null, 2))
    }
    expect(result.success).toBe(true)
  })

  test('rejects taxRate > 100', () => {
    const result = settingsSchema.safeParse({ ...baseValid, payment: { ...baseValid.payment, taxRate: 999 } })
    expect(result.success).toBe(false)
    const issue = result.error.issues.find(i => i.path.includes('taxRate'))
    expect(issue).toBeDefined()
  })

  test('rejects a 4-letter currency code', () => {
    const result = settingsSchema.safeParse({ ...baseValid, payment: { ...baseValid.payment, currency: 'DOLLAR' } })
    expect(result.success).toBe(false)
  })

  test('rejects an empty siteName', () => {
    const result = settingsSchema.safeParse({ ...baseValid, siteName: '' })
    expect(result.success).toBe(false)
  })

  test('rejects an invalid siteUrl', () => {
    const result = settingsSchema.safeParse({ ...baseValid, siteUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  test('accepts a missing siteUrl (optional)', () => {
    const { siteUrl, ...rest } = baseValid
    const result = settingsSchema.safeParse(rest)
    expect(result.success).toBe(true)
  })

  test('accepts an empty SMTP password (write-only)', () => {
    const result = settingsSchema.safeParse({
      ...baseValid,
      email: { ...baseValid.email, smtpPassword: '' },
    })
    expect(result.success).toBe(true)
  })
})

describe('stripSecrets', () => {
  test('clears every SECRET_FIELDS value', () => {
    const input = {
      email:   { smtpPassword: 'super-secret' },
      payment: { stripeSecretKey: 'sk_live_abc', razorpayKeySecret: 'rks', paypalClientSecret: 'ppc' },
    }
    const out = stripSecrets(input)
    expect(out.email.smtpPassword).toBe('')
    expect(out.payment.stripeSecretKey).toBe('')
    expect(out.payment.razorpayKeySecret).toBe('')
    expect(out.payment.paypalClientSecret).toBe('')
  })

  test('does not mutate the original', () => {
    const input = { email: { smtpPassword: 'secret' } }
    const out = stripSecrets(input)
    expect(input.email.smtpPassword).toBe('secret')
    expect(out.email.smtpPassword).toBe('')
  })

  test('handles null/undefined input', () => {
    expect(stripSecrets(null)).toBeNull()
    expect(stripSecrets(undefined)).toBeUndefined()
  })
})

describe('SECRET_FIELDS', () => {
  test('includes every secret field documented in the audit', () => {
    expect(SECRET_FIELDS).toEqual(expect.arrayContaining([
      'email.smtpPassword',
      'payment.stripeSecretKey',
      'payment.razorpayKeySecret',
      'payment.paypalClientSecret',
    ]))
  })
})

