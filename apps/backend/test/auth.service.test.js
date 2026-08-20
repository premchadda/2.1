import { jest, describe, it, expect, beforeEach } from '@jest/globals'

describe('Auth Service', () => {
  describe('validatePasswordStrength', () => {
    it('should reject passwords shorter than 8 characters', async () => {
      const { validatePasswordStrength } = await import('../src/modules/auth/auth.service.js')
      const result = validatePasswordStrength('Ab1!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should reject passwords without uppercase', async () => {
      const { validatePasswordStrength } = await import('../src/modules/auth/auth.service.js')
      const result = validatePasswordStrength('lowercase1!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject passwords without lowercase', async () => {
      const { validatePasswordStrength } = await import('../src/modules/auth/auth.service.js')
      const result = validatePasswordStrength('UPPERCASE1!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should reject passwords without numbers', async () => {
      const { validatePasswordStrength } = await import('../src/modules/auth/auth.service.js')
      const result = validatePasswordStrength('NoNumbers!!')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should reject passwords without special characters', async () => {
      const { validatePasswordStrength } = await import('../src/modules/auth/auth.service.js')
      const result = validatePasswordStrength('NoSpecial1')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })

    it('should accept strong passwords', async () => {
      const { validatePasswordStrength } = await import('../src/modules/auth/auth.service.js')
      const result = validatePasswordStrength('StrongP@ss1')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.strength).toBe(5)
    })

    it('should calculate strength correctly', async () => {
      const { validatePasswordStrength } = await import('../src/modules/auth/auth.service.js')
      
      // 4 criteria met (missing uppercase)
      const result1 = validatePasswordStrength('lowercase1!')
      expect(result1.strength).toBe(4)
      
      // 2 criteria met (lowercase + length >= 8)
      const result2 = validatePasswordStrength('weakpass')
      expect(result2.strength).toBe(2)
    })
  })

  describe('generateToken', () => {
    it('should generate a valid JWT token', async () => {
      const { generateToken } = await import('../src/modules/auth/auth.service.js')
      const originalSecret = process.env.JWT_SECRET
      process.env.JWT_SECRET = 'test-secret-key-for-testing-32-chars!!'
      
      const token = generateToken(1, 'user')
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
      
      process.env.JWT_SECRET = originalSecret
    })

    it('should throw error if JWT_SECRET is not set', async () => {
      const { generateToken } = await import('../src/modules/auth/auth.service.js')
      const originalSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET
      
      expect(() => generateToken(1, 'user')).toThrow('JWT secret not configured')
      
      process.env.JWT_SECRET = originalSecret
    })

    it('should use custom secret when provided in options', async () => {
      const { generateToken } = await import('../src/modules/auth/auth.service.js')
      const originalSecret = process.env.JWT_SECRET
      process.env.JWT_SECRET = 'test-secret-key-for-testing-32-chars!!'
      
      const customSecret = 'custom-refresh-secret-key-for-testing!!'
      const token = generateToken(1, 'user', { secret: customSecret })
      expect(typeof token).toBe('string')
      
      process.env.JWT_SECRET = originalSecret
    })
  })

  describe('CookieOptions', () => {
    it('should have httpOnly set to true', async () => {
      const { CookieOptions } = await import('../src/modules/auth/auth.service.js')
      expect(CookieOptions.httpOnly).toBe(true)
    })

    it('should have path set to /', async () => {
      const { CookieOptions } = await import('../src/modules/auth/auth.service.js')
      expect(CookieOptions.path).toBe('/')
    })
  })

  describe('getCookieOptions and setAuthCookies', () => {
    it('should omit maxAge for session cookies when rememberMe is false', async () => {
      const { getCookieOptions } = await import('../src/modules/auth/auth.service.js')
      const { tokenOptions, refreshOptions } = getCookieOptions(false)
      expect(tokenOptions.httpOnly).toBe(true)
      expect(tokenOptions.path).toBe('/')
      expect(tokenOptions.maxAge).toBeUndefined()
      expect(refreshOptions.maxAge).toBeUndefined()
    })

    it('should include maxAge for persistent cookies when rememberMe is true', async () => {
      const { getCookieOptions } = await import('../src/modules/auth/auth.service.js')
      const { tokenOptions, refreshOptions } = getCookieOptions(true)
      expect(tokenOptions.httpOnly).toBe(true)
      expect(tokenOptions.maxAge).toBe(7 * 24 * 60 * 60 * 1000)
      expect(refreshOptions.maxAge).toBe(30 * 24 * 60 * 60 * 1000)
    })

    it('should set session cookies when rememberMe is false in setAuthCookies', async () => {
      const { setAuthCookies } = await import('../src/modules/auth/auth.service.js')
      const res = { cookie: jest.fn() }
      setAuthCookies(res, { token: 'jwt-access', refreshToken: 'jwt-refresh', rememberMe: false })

      expect(res.cookie).toHaveBeenCalledTimes(2)
      expect(res.cookie).toHaveBeenCalledWith('token', 'jwt-access', expect.objectContaining({
        httpOnly: true,
        path: '/'
      }))
      const tokenCall = res.cookie.mock.calls.find(call => call[0] === 'token')
      expect(tokenCall[2].maxAge).toBeUndefined()

      const refreshCall = res.cookie.mock.calls.find(call => call[0] === 'refreshToken')
      expect(refreshCall[2].maxAge).toBeUndefined()
    })

    it('should set persistent cookies when rememberMe is true in setAuthCookies', async () => {
      const { setAuthCookies } = await import('../src/modules/auth/auth.service.js')
      const res = { cookie: jest.fn() }
      setAuthCookies(res, { token: 'jwt-access', refreshToken: 'jwt-refresh', rememberMe: true })

      expect(res.cookie).toHaveBeenCalledTimes(2)
      const tokenCall = res.cookie.mock.calls.find(call => call[0] === 'token')
      expect(tokenCall[2].maxAge).toBe(7 * 24 * 60 * 60 * 1000)

      const refreshCall = res.cookie.mock.calls.find(call => call[0] === 'refreshToken')
      expect(refreshCall[2].maxAge).toBe(30 * 24 * 60 * 60 * 1000)
    })
  })
})
