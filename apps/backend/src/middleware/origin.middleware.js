/**
 * Origin Restriction Middleware
 * 
 * Prevents unauthorized access to admin endpoints from non-admin origins.
 * This adds an additional layer of security beyond role-based access control.
 * 
 * Security Threats Mitigated:
 * - Admin API access from user-facing frontend
 * - Cross-origin admin requests from malicious sites
 * - Accidental admin endpoint exposure
 */

/**
 * Check if a request is targeting admin endpoints
 */
const isAdminEndpoint = (req) => {
  return req.path.startsWith('/api/admin')
}

/**
 * Origin restriction middleware for admin endpoints
 * 
 * Usage: Apply BEFORE auth middleware on admin routes
 * 
 * Environment Variables:
 * - ADMIN_PANEL_URL: The allowed admin panel origin
 * - NODE_ENV: 'production' enables strict checking, 'development' is permissive
 */
export const restrictAdminOrigin = (req, res, next) => {
  // Skip if not an admin endpoint
  if (!isAdminEndpoint(req)) {
    return next()
  }

  // Get origin header
  const origin = req.headers.origin

  // In development, be permissive for local testing
  if (process.env.NODE_ENV !== 'production') {
    // Still log the origin for debugging
    if (origin) {
      console.log(`[Admin Origin Check] Dev mode - allowing origin: ${origin}`)
    }
    return next()
  }

  // In production, strictly enforce admin origin
  const allowedAdminOrigin = process.env.ADMIN_PANEL_URL

  if (!allowedAdminOrigin) {
    // Configuration error - fail closed for security
    console.error('[Admin Origin Check] ERROR: ADMIN_PANEL_URL not configured!')
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: Admin origin not configured'
    })
  }

  // Check if origin is empty (could be server-to-server, CLI, etc.)
  if (!origin) {
    // Allow requests without origin (mobile apps, server-to-server, CLI tools)
    // These would still need to pass auth middleware
    return next()
  }

  // Verify origin matches admin panel URL
  if (origin === allowedAdminOrigin) {
    return next()
  }

  // Origin mismatch - block the request
  console.warn(`[Admin Origin Check] BLOCKED: ${origin} trying to access admin endpoint`)
  return res.status(403).json({
    success: false,
    message: 'Admin endpoints are only accessible from the admin panel',
    code: 'ADMIN_ORIGIN_DENIED'
  })
}

/**
 * Mandatory admin API key validation middleware for production
 *
 * Provides an additional security layer beyond origin checking.
 * The admin panel must include the API key in a custom header.
 *
 * Header: X-Admin-API-Key
 * Env: ADMIN_API_KEY (REQUIRED in production)
 */
export const validateAdminApiKey = (req, res, next) => {
  if (!isAdminEndpoint(req)) {
    return next()
  }

  // In development, skip API key validation but warn if missing
  if (process.env.NODE_ENV !== 'production') {
    if (!process.env.ADMIN_API_KEY) {
      console.warn('[Admin API Key] WARNING: ADMIN_API_KEY not set in development. Admin endpoints are permissive.')
    }
    return next()
  }

  // In production, API key is mandatory
  const adminApiKey = process.env.ADMIN_API_KEY

  if (!adminApiKey) {
    console.error('[Admin API Key] ERROR: ADMIN_API_KEY not configured in production!')
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: Admin API key not configured',
      code: 'ADMIN_API_KEY_NOT_CONFIGURED'
    })
  }

  const providedKey = req.headers['x-admin-api-key']

  if (!providedKey) {
    console.warn('[Admin API Key] BLOCKED: Missing API key from', req.headers.origin || 'unknown origin')
    return res.status(403).json({
      success: false,
      message: 'Admin API key required',
      code: 'ADMIN_API_KEY_REQUIRED'
    })
  }

  if (providedKey !== adminApiKey) {
    console.warn('[Admin API Key] BLOCKED: Invalid API key from', req.headers.origin || 'unknown origin')
    return res.status(403).json({
      success: false,
      message: 'Invalid admin credentials',
      code: 'ADMIN_API_KEY_DENIED'
    })
  }

  next()
}

/**
 * Combined admin security middleware
 * 
 * Applies both origin restriction and API key validation
 */
export const adminSecurity = (req, res, next) => {
  // Skip if not an admin endpoint
  if (!isAdminEndpoint(req)) {
    return next()
  }

  // Apply origin restriction first
  restrictAdminOrigin(req, res, (originErr) => {
    if (originErr) return

    // Then apply API key validation (if configured)
    validateAdminApiKey(req, res, next)
  })
}

export default {
  restrictAdminOrigin,
  validateAdminApiKey,
  adminSecurity,
  isAdminEndpoint
}