import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import jwt from 'jsonwebtoken'

// TEST-01: Comprehensive auth middleware tests covering all edge cases.

// Mock dependencies
const mockFindById = jest.fn()
const mockPoolQuery = jest.fn()
const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()

jest.unstable_mockModule('../infrastructure/database/postgres-helpers.js', () => ({
  pool: {
    query: (...args) => mockPoolQuery(...args),
    connect: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() }),
  },
  dbHelpers: {
    findById: (...args) => mockFindById(...args),
    pool: { query: (...args) => mockPoolQuery(...args) },
  },
}))

jest.unstable_mockModule('../infrastructure/cache/redisClient.js', () => ({
  getRedisClient: () => ({
    get: (...args) => mockRedisGet(...args),
    set: (...args) => mockRedisSet(...args),
  }),
}))

// Import after mocks
const { protect, optionalAuth, admin, clearAuthCaches } = await import('../middleware/auth.middleware.js')

const JWT_SECRET = 'test-secret-key-for-testing-only-1234567890!@#'

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res },
  }
  return res
}

function makeReq(overrides = {}) {
  return {
    headers: {},
    cookies: {},
    ...overrides,
  }
}

function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, options)
}

describe('protect middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearAuthCaches() // Prevent cross-test cache pollution
    process.env.JWT_SECRET = JWT_SECRET
    mockRedisGet.mockResolvedValue(null)
    mockRedisSet.mockResolvedValue('OK')
    mockPoolQuery.mockResolvedValue({ rows: [{ is_active: true }] })
  })

  afterEach(() => {
    delete process.env.JWT_SECRET
  })

  it('returns 401 when no token is provided', async () => {
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('no token')
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an expired token', async () => {
    const token = signToken({ id: 1 }, { expiresIn: '-1s' })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toContain('token failed')
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for a tampered/invalid token', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer invalid.token.here' } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not found', async () => {
    const token = signToken({ id: 999 })
    mockFindById.mockResolvedValue(null)
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toContain('no longer exists')
  })

  it('returns 403 when user is inactive', async () => {
    const token = signToken({ id: 1 })
    mockFindById.mockResolvedValue({ id: 1, isActive: false, role: 'user' })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(403)
    expect(res.body.message).toContain('deactivated')
  })

  it('returns 401 when session is revoked (Redis cache hit)', async () => {
    const token = signToken({ id: 1, sessionId: 'sess-123' })
    mockRedisGet.mockResolvedValue(JSON.stringify({ isActive: false }))
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toContain('revoked')
  })

  it('returns 401 when session is revoked (DB fallback)', async () => {
    const token = signToken({ id: 1, sessionId: 'sess-456' })
    mockRedisGet.mockResolvedValue(null)
    mockPoolQuery.mockResolvedValue({ rows: [{ is_active: false }] })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body.message).toContain('revoked')
  })

  it('fails open (allows request) when the session row is missing after a successful DB query', async () => {
    // FIX H1: a missing user_sessions row after a *successful* query is not a
    // transient outage — the DB answered, the row simply isn't there (restart
    // cleanup / backup restore). Returning 503 here made the frontend retry 12
    // times and leave users stuck; the valid JWT is allowed through instead.
    const token = signToken({ id: 1, sessionId: 'sess-789' })
    mockRedisGet.mockResolvedValue(null)
    mockPoolQuery.mockResolvedValue({ rows: [] })
    // Set explicitly — jest.clearAllMocks() does not reset implementations,
    // so without this the previous test's inactive-user mock leaks in.
    mockFindById.mockResolvedValue({
      id: 1, isActive: true, isEmailVerified: true, role: 'user', password: 'x',
    })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.statusCode).toBe(null)
  })

  it('attaches user to req and calls next on valid token', async () => {
    const token = signToken({ id: 1 })
    mockFindById.mockResolvedValue({
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      isActive: true,
      isEmailVerified: true,
      role: 'user',
      password: 'hashed',
    })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBeDefined()
    expect(req.user.id).toBe(1)
    expect(req.user.password).toBeUndefined()
    expect(req.user.isAdmin).toBe(false)
  })

  it('reads token from cookies when header is absent', async () => {
    const token = signToken({ id: 1 })
    mockFindById.mockResolvedValue({
      id: 1, isActive: true, isEmailVerified: true, role: 'user', password: 'x',
    })
    const req = makeReq({ cookies: { token } })
    const res = makeRes()
    const next = jest.fn()

    await protect(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user.id).toBe(1)
  })
})

describe('optionalAuth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearAuthCaches() // Prevent cross-test cache pollution
    process.env.JWT_SECRET = JWT_SECRET
    mockRedisGet.mockResolvedValue(null)
    mockPoolQuery.mockResolvedValue({ rows: [{ is_active: true }] })
  })

  it('calls next without user when no token is present', async () => {
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn()

    await optionalAuth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBeUndefined()
  })

  it('sets req.authError = "token_expired" for expired tokens (SEC-03)', async () => {
    const token = signToken({ id: 1 }, { expiresIn: '-1s' })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await optionalAuth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.authError).toBe('token_expired')
    expect(req.user).toBeUndefined()
  })

  it('sets req.authError = "invalid_token" for tampered tokens (SEC-03)', async () => {
    const req = makeReq({ headers: { authorization: 'Bearer tampered.invalid.token' } })
    const res = makeRes()
    const next = jest.fn()

    await optionalAuth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.authError).toBe('invalid_token')
  })

  it('attaches user on valid token', async () => {
    const token = signToken({ id: 1 })
    mockFindById.mockResolvedValue({
      id: 1, isActive: true, emailVerified: true, role: 'user', password: 'x',
    })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()
    const next = jest.fn()

    await optionalAuth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toBeDefined()
    expect(req.user.id).toBe(1)
  })
})

describe('admin middleware', () => {
  it('returns 403 when user is not admin', () => {
    const req = makeReq({ user: { isAdmin: false } })
    const res = makeRes()
    const next = jest.fn()

    admin(req, res, next)

    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next when user is admin', () => {
    const req = makeReq({ user: { isAdmin: true } })
    const res = makeRes()
    const next = jest.fn()

    admin(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})