import jwt from 'jsonwebtoken';

// Generate JWT Token
// Can include additional claims via options.claims (e.g., refreshTokenVersion)
// Secret: defaults to JWT_SECRET; can override with options.secret (e.g., for refresh token using JWT_REFRESH_SECRET)
export const generateToken = (id, role = 'user', options = {}) => {
  const secret = options.secret || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT secret not configured')
  }
  const payload = { id, role, ...options.claims }
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn })
}

// Cookie options for httpOnly cookies (Issue #21 fix)
// sameSite: 'lax' by default so the cookie is sent on same-site requests
// (and shared across subdomains when COOKIE_DOMAIN is set). For fully
// cross-site deployments (different registrable domains) set
// COOKIE_SAMESITE=none together with COOKIE_SECURE=true (or NODE_ENV=production).
const cookieSameSite = process.env.COOKIE_SAMESITE || 'lax'
const cookieDomain = process.env.COOKIE_DOMAIN || undefined
const cookieSecure = process.env.COOKIE_SECURE === 'true' || ['production', 'staging'].includes(process.env.NODE_ENV)

export const CookieOptions = {
  httpOnly: true, // Prevents JavaScript access (XSS protection)
  secure: cookieSecure,
  sameSite: cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT_EXPIRES_IN default)
  path: '/',
  ...(cookieDomain ? { domain: cookieDomain } : {}),
}

// Refresh token cookie must last as long as the refresh token JWT (default 30d).
// Without this, the cookie expires after 7d even though the JWT is still valid,
// forcing the user to re-login.
const REFRESH_COOKIE_MAX_AGE = (() => {
  const match = (process.env.JWT_REFRESH_EXPIRES_IN || '30d').match(/^(\d+)([dhm])$/)
  if (!match) return 30 * 24 * 60 * 60 * 1000
  const val = parseInt(match[1], 10)
  switch (match[2]) {
    case 'd': return val * 24 * 60 * 60 * 1000
    case 'h': return val * 60 * 60 * 1000
    case 'm': return val * 60 * 1000
    default: return 30 * 24 * 60 * 60 * 1000
  }
})()

export const RefreshCookieOptions = {
  ...CookieOptions,
  maxAge: REFRESH_COOKIE_MAX_AGE,
}

export const setAuthCookies = (res, { token, refreshToken }) => {
  if (token) {
    res.cookie('token', token, CookieOptions)
  }

  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, RefreshCookieOptions)
  }
}

// Clear auth cookies helper — use each cookie's own maxAge so the browser
// actually clears the cookie (some browsers ignore clearCookie without matching options).
export const clearAuthCookies = (res) => {
  res.clearCookie('token', CookieOptions)
  res.clearCookie('refreshToken', RefreshCookieOptions)
}

// ===== PASSWORD STRENGTH VALIDATION (Issue #13) =====
export const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'], strength: 0 }
  }
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
  const errors = []
  
  if (password.length < minLength) {
    errors.push('Password must be at least 8 characters long')
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number')
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength: [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar, password.length >= minLength].filter(Boolean).length
  }
}
