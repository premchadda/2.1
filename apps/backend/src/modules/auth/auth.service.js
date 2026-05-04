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
export const CookieOptions = {
  httpOnly: true, // Prevents JavaScript access (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Use 'lax' in dev for cross-origin
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
}

export const setAuthCookies = (res, { token, refreshToken }) => {
  if (token) {
    res.cookie('token', token, CookieOptions)
  }

  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, CookieOptions)
  }
}

// Clear auth cookies helper
export const clearAuthCookies = (res) => {
  res.clearCookie('token', CookieOptions)
  res.clearCookie('refreshToken', CookieOptions)
}

// ===== PASSWORD STRENGTH VALIDATION (Issue #13) =====
export const validatePasswordStrength = (password) => {
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
