import crypto from 'crypto';
import fs from 'fs';
import { dbHelpers } from '../infrastructure/database/postgres-helpers.js';

// ===== CSRF PROTECTION (Issue #8, #32) =====
// Database-backed CSRF token storage for production resilience
export const csrfTokensMemory = new Map(); // Fallback for database unavailability
const CSRF_TOKEN_FILE = './csrf-tokens-store.json';
function loadCsrfTokens() {
  try {
    if (fs.existsSync(CSRF_TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(CSRF_TOKEN_FILE, 'utf8'));
      for (const [k, v] of Object.entries(data)) {
        csrfTokensMemory.set(k, v);
      }
    }
  } catch (_) {}
}
function persistCsrfTokens() {
  try {
    const obj = Object.fromEntries(csrfTokensMemory);
    fs.writeFileSync(CSRF_TOKEN_FILE, JSON.stringify(obj));
  } catch (_) {}
}
loadCsrfTokens();

// CSRF token lifecycle configuration
export const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
export const CSRF_TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// Generate CSRF token
export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

// Store CSRF token in database with fallback to memory
export const storeCsrfToken = async (authToken, csrfToken) => {
  const expiresAt = new Date(Date.now() + CSRF_TOKEN_EXPIRY_MS).toISOString()

  try {
    // Try database storage first
    await dbHelpers.insertOne('csrf_tokens', {
      auth_token_hash: crypto.createHash('sha256').update(authToken).digest('hex'),
      csrf_token: csrfToken,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    })
    return true
  } catch (error) {
    // Fallback to memory storage if database fails
    console.warn('CSRF database storage failed, using memory fallback:', error.message);
csrfTokensMemory.set(authToken, {
  token: csrfToken,
  expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS
});
persistCsrfTokens();
    return true
  }
}

// Retrieve CSRF token from database with fallback to memory
export const getCsrfToken = async (authToken) => {
  try {
    const authTokenHash = crypto.createHash('sha256').update(authToken).digest('hex')

    // Try database first
    const record = await dbHelpers.findOne('csrf_tokens', {
      auth_token_hash: authTokenHash,
      expires_at: { $gt: new Date().toISOString() }
    })

    if (record) {
      return record.csrf_token
    }

    // Check memory fallback
    const memoryRecord = csrfTokensMemory.get(authToken)
    if (memoryRecord && memoryRecord.expiresAt > Date.now()) {
      return memoryRecord.token
    }

    return null
  } catch (error) {
    // Fallback to memory on database error
    console.warn('CSRF database lookup failed, checking memory:', error.message)
    const memoryRecord = csrfTokensMemory.get(authToken)
    if (memoryRecord && memoryRecord.expiresAt > Date.now()) {
      return memoryRecord.token
    }
    return null
  }
}

// Delete CSRF token (for logout)
export const deleteCsrfToken = async (authToken) => {
  try {
    const authTokenHash = crypto.createHash('sha256').update(authToken).digest('hex')
    await dbHelpers.deleteMany('csrf_tokens', { auth_token_hash: authTokenHash })
  } catch (error) {
    console.warn('CSRF token deletion failed:', error.message)
  }
  csrfTokensMemory.delete(authToken);
  persistCsrfTokens();
}

// Cleanup expired CSRF tokens (run periodically)
export const cleanupExpiredCsrfTokens = async () => {
  try {
    await dbHelpers.deleteMany('csrf_tokens', {
      expires_at: { $lt: new Date().toISOString() }
    })

    // Also cleanup memory fallback
    const now = Date.now()
    for (const [key, value] of csrfTokensMemory.entries()) {
      if (value.expiresAt < now) {
        csrfTokensMemory.delete(key)
      }
    }
  } catch (error) {
    console.error('CSRF token cleanup failed:', error.message)
  }
}

// Run cleanup periodically — unref() so it doesn't block process.exit in tests
// LOW-02 FIX: Export so it can be cleared on graceful shutdown
export const csrfCleanupInterval = setInterval(cleanupExpiredCsrfTokens, CSRF_TOKEN_CLEANUP_INTERVAL_MS)
csrfCleanupInterval.unref()

// CSRF validation middleware
// MED-01 FIX: Accept the previous token for a grace period to prevent
// race conditions when multiple tabs submit simultaneously
export const CSRF_GRACE_PERIOD_MS = 30 * 1000 // 30 seconds

export const validateCsrfToken = async (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Skip CSRF for auth routes (they have their own protection)
  if (req.path.startsWith('/api/auth/')) {
    return next()
  }

  // Skip CSRF for webhook/payment callback routes (external services don't have CSRF)
  if (req.path.startsWith('/api/payments/webhook')) {
    return next()
  }

  const csrfToken = req.headers['x-csrf-token'] || req.body?._csrf
  const authToken = req.headers.authorization?.replace('Bearer ', '')

  if (!authToken) {
    // No auth token, skip CSRF (unauthenticated request)
    return next()
  }

  const storedToken = await getCsrfToken(authToken)

  // Also check the previous token (grace period for concurrent requests)
  const authTokenHash = crypto.createHash('sha256').update(authToken).digest('hex')
  const previousToken = csrfTokensMemory.get(`prev:${authTokenHash}`)
  const previousValid = previousToken
    && previousToken.token === csrfToken
    && previousToken.expiresAt > Date.now()

  if (!csrfToken || (!storedToken && !previousValid) || (csrfToken !== storedToken && !previousValid)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token'
    })
  }

  // Rotate the token after successful validation for better security
  // Store the old token temporarily so concurrent requests still work
  if (storedToken) {
    csrfTokensMemory.set(`prev:${authTokenHash}`, {
      token: storedToken,
        expiresAt: Date.now() + CSRF_GRACE_PERIOD_MS
      });
      persistCsrfTokens();
  }

  const newToken = generateCsrfToken()
  await storeCsrfToken(authToken, newToken)
  res.set('X-CSRF-Token', newToken) // Send new token in response header

  next()
}
