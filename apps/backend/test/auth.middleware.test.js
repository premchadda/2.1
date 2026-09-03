import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock the imported dbHelpers to use our globally mocked helper.
jest.unstable_mockModule('../src/infrastructure/database/postgres-helpers.js', () => ({
  pool: {
    query: (...args) => {
      if (global.dbHelpers && global.dbHelpers.pool && typeof global.dbHelpers.pool.query === 'function') {
        return global.dbHelpers.pool.query(...args)
      }
      return { rows: [] }
    },
    connect: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() })
  },
  dbHelpers: {
    findById: (...args) => {
      if (global.dbHelpers && typeof global.dbHelpers.findById === 'function') {
        return global.dbHelpers.findById(...args)
      }
      return null
    },
    pool: {
      query: (...args) => {
        if (global.dbHelpers && global.dbHelpers.pool && typeof global.dbHelpers.pool.query === 'function') {
          return global.dbHelpers.pool.query(...args)
        }
        return { rows: [] }
      }
    }
  }
}))

// Mock the imported redis client to prevent runtime errors.
jest.unstable_mockModule('../src/infrastructure/cache/redisClient.js', () => ({
  getRedisClient: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }),
  isRedisReady: () => false,
  isRedisHealthy: () => false,
  recordRedisFailure: () => {},
  recordRedisSuccess: () => {},
}))

describe('Auth Middleware', () => {
  let mockReq
  let mockRes
  let mockNext

  beforeEach(() => {
    mockReq = {
      headers: {},
      cookies: {},
      user: null,
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    mockNext = jest.fn()
  })

  describe('protect middleware', () => {
    it('should return 401 if no token is provided', async () => {
      const { protect } = await import('../src/middleware/auth.middleware.js')
      await protect(mockReq, mockRes, mockNext)
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Not authorized'),
        })
      )
    })

    it('should return 401 if JWT_SECRET is not set', async () => {
      const originalSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET
      
      mockReq.headers.authorization = 'Bearer test-token'
      
      const { protect } = await import('../src/middleware/auth.middleware.js')
      await protect(mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      
      process.env.JWT_SECRET = originalSecret
    })

    it('should call next() for valid Bearer token', async () => {
      const jwt = await import('jsonwebtoken')
      const token = jwt.default.sign(
        { id: 1, role: 'user' },
        process.env.JWT_SECRET || 'test-secret-key-for-testing-32-chars!!',
        { expiresIn: '1h' }
      )
      
      mockReq.headers.authorization = `Bearer ${token}`
      
      // Mock dbHelpers to return a user
      global.dbHelpers = {
        findById: jest.fn().mockResolvedValue({
          id: 1,
          role: 'user',
          isActive: true,
          isEmailVerified: true,
        }),
        pool: {
          query: jest.fn().mockResolvedValue({ rows: [{ is_active: true }] }),
        },
      }
      
      const { protect } = await import('../src/middleware/auth.middleware.js')
      await protect(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
      expect(mockReq.user).toBeDefined()
      expect(mockReq.user.id).toBe(1)
    })
  })

  describe('admin middleware', () => {
    it('should return 403 if user is not admin', async () => {
      mockReq.user = { isAdmin: false, role: 'user' }
      
      const { admin } = await import('../src/middleware/auth.middleware.js')
      admin(mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(403)
    })

    it('should call next() if user is admin', async () => {
      mockReq.user = { isAdmin: true, role: 'admin' }
      
      const { admin } = await import('../src/middleware/auth.middleware.js')
      admin(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('optionalAuth middleware', () => {
    it('should call next() without attaching user if no token', async () => {
      const { optionalAuth } = await import('../src/middleware/auth.middleware.js')
      await optionalAuth(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
      expect(mockReq.user).toBeFalsy()
    })
  })

  describe('ROLES and isHigherRole', () => {
    it('should correctly identify role hierarchy', async () => {
      const { isHigherRole, ROLES } = await import('../src/middleware/auth.middleware.js')
      
      expect(isHigherRole(ROLES.ADMIN, ROLES.USER)).toBe(true)
      expect(isHigherRole(ROLES.SUPER_ADMIN, ROLES.ADMIN)).toBe(true)
      expect(isHigherRole(ROLES.USER, ROLES.ADMIN)).toBe(false)
      expect(isHigherRole(ROLES.USER, ROLES.SUPER_ADMIN)).toBe(false)
    })
  })

  describe('isUserAdminRequest', () => {
    it('should return true for attached admin user', async () => {
      const { isUserAdminRequest } = await import('../src/middleware/auth.middleware.js')
      expect(isUserAdminRequest({ user: { isAdmin: true } })).toBe(true)
      expect(isUserAdminRequest({ user: { role: 'admin' } })).toBe(true)
      expect(isUserAdminRequest({ user: { role: 'super_admin' } })).toBe(true)
    })

    it('should return false for unauthenticated admin origin without verified user', async () => {
      const { isUserAdminRequest } = await import('../src/middleware/auth.middleware.js')
      expect(isUserAdminRequest({ headers: { origin: 'http://localhost:3002' } })).toBe(false)
    })

    it('should return false for regular user or empty request', async () => {
      const { isUserAdminRequest } = await import('../src/middleware/auth.middleware.js')
      expect(isUserAdminRequest(null)).toBe(false)
      expect(isUserAdminRequest({})).toBe(false)
      expect(isUserAdminRequest({ user: { role: 'user', isAdmin: false } })).toBe(false)
    })
  })
})
