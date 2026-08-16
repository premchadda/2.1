import { URL } from 'url'

// ============================================================
// FIX 2.8b: Origin validation — CSRF defense-in-depth
//
// httpOnly + SameSite=Lax cookies already prevent the browser from attaching
// the auth cookies to cross-site requests for most flows. This middleware adds
// an explicit Origin/Referer check on state-changing (non-GET) requests so that
// a cross-origin request carrying credentials is rejected outright, even if a
// future cookie/header change weakens the SameSite guarantee.
//
// Behaviour:
//  - GET/HEAD/OPTIONS: not state-changing → skipped.
//  - No Origin header: treated as same-origin (browser omits Origin for
//    same-origin navigations / same-origin fetch) → allowed.
//  - Origin host === request host: same-origin → allowed.
//  - Origin host is localhost/loopback (dev proxy, Vite :5173, etc.): allowed
//    in non-production to avoid breaking local development.
//  - Origin in ALLOWED_ORIGINS (comma-separated env): allowed (e.g. a trusted
//    admin SPA on another subdomain that shares the cookie domain).
//  - Otherwise: 403 (CSRF_ORIGIN).
//
// Webhook callbacks (Razorpay, etc.) are explicitly skipped — they legitimately
// arrive from external servers and are protected by signature verification, not
// cookies.
// ============================================================

const TRUSTED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const WEBHOOK_PREFIXES = ['/api/payments/webhook', '/api/webhooks']

const isLoopback = (hostname) => {
  if (!hostname) return false
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  )
}

const sameOriginHost = (originHost, requestHost) => {
  if (!requestHost) return false
  // Compare host with and without explicit port.
  return originHost === requestHost || originHost === requestHost.split(':')[0]
}

export const validateOrigin = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()

  const path = req.path || req.originalUrl || ''
  if (WEBHOOK_PREFIXES.some((p) => path.startsWith(p))) return next()

  const origin = req.headers.origin
  // No Origin header → same-origin (or non-browser client). Allow; CSRF tokens
  // still gate mutation routes elsewhere.
  if (!origin) return next()

  let originHost
  let originHostname
  try {
    const parsedOrigin = new URL(origin)
    originHost = parsedOrigin.host
    originHostname = parsedOrigin.hostname
  } catch {
    return res.status(403).json({
      success: false,
      code: 'CSRF_ORIGIN',
      message: 'Invalid Origin header',
    })
  }

  const requestHost = req.headers['x-forwarded-host'] || req.headers.host || null

  if (sameOriginHost(originHost, requestHost)) return next()

  // Trusted, explicitly configured origins (e.g. admin SPA on another subdomain).
  if (TRUSTED_ORIGINS.includes(origin)) return next()

  // Development convenience: allow loopback origins regardless of port so the
  // Vite dev server (e.g. :5173) can call the API (e.g. :5001).
  if (process.env.NODE_ENV !== 'production' && isLoopback(originHostname)) return next()

  console.warn(`[CSRF] Blocked cross-origin state-changing request from ${origin} to ${requestHost || path}`)
  return res.status(403).json({
    success: false,
    code: 'CSRF_ORIGIN',
    message: 'Cross-origin request blocked',
  })
}

// ============================================================
// FIX: Admin route security layers (legacy exports retained for
// compatibility with admin.js / module controllers)
//
// The admin SPA previously sent an `X-Admin-API-Key` header, but that was
// removed during the security audit (VITE_ADMIN_API_KEY leaked the key in the
// client bundle). Admin authorization now relies exclusively on the httpOnly
// cookie + JWT (`protect`/`admin` middleware). These two middlewares preserve
// the original defense-in-depth layering without re-introducing the leaked key.
// ============================================================

const ADMIN_PANEL_URL = (process.env.ADMIN_PANEL_URL || '').trim()

// Layer 1: restrict admin state-changing requests to the admin panel origin.
//  - GET/HEAD/OPTIONS: not state-changing → skipped.
//  - No Origin header: same-origin / non-browser client → allowed.
//  - Origin host === request host: same-origin → allowed.
//  - Origin host === configured ADMIN_PANEL_URL: the trusted admin SPA → allowed.
//  - Origin is loopback: allowed in non-production (admin panel on :3002, etc.).
//  - Otherwise: 403.
export const restrictAdminOrigin = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()

  const path = req.path || req.originalUrl || ''
  if (WEBHOOK_PREFIXES.some((p) => path.startsWith(p))) return next()

  const origin = req.headers.origin
  if (!origin) return next()

  let originHost
  let originHostname
  try {
    const parsedOrigin = new URL(origin)
    originHost = parsedOrigin.host
    originHostname = parsedOrigin.hostname
  } catch {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_ORIGIN',
      message: 'Invalid Origin header',
    })
  }

  const requestHost = req.headers['x-forwarded-host'] || req.headers.host || null

  if (sameOriginHost(originHost, requestHost)) return next()

  if (ADMIN_PANEL_URL) {
    try {
      if (new URL(ADMIN_PANEL_URL).host === originHost) return next()
    } catch {
      // malformed ADMIN_PANEL_URL → fall through to rejection
    }
  }

  if (process.env.NODE_ENV !== 'production' && isLoopback(originHostname)) return next()

  console.warn(`[ADMIN] Blocked non-admin-origin state-changing request from ${origin}`)
  return res.status(403).json({
    success: false,
    code: 'ADMIN_ORIGIN',
    message: 'Admin requests must originate from the admin panel',
  })
}

// Layer 2: optional API-key check — defense-in-depth only.
// If ADMIN_API_KEY is set server-side, require a matching `X-Admin-API-Key`
// header. If it is not configured, pass through (cookie/JWT remains the
// authoritative gate and the client no longer sends a key).
export const validateAdminApiKey = (req, res, next) => {
  const configuredKey = process.env.ADMIN_API_KEY
  if (!configuredKey) return next()

  const provided = req.headers['x-admin-api-key']
  if (provided && provided === configuredKey) return next()

  return res.status(403).json({
    success: false,
    code: 'ADMIN_API_KEY',
    message: 'Invalid or missing admin API key',
  })
}

export const isAdminEndpoint = (req) => {
  const path = req.path || req.originalUrl || ''
  return path.startsWith('/api/admin')
}

export default validateOrigin
