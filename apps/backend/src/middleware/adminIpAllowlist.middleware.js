import { isAdminEndpoint } from './origin.middleware.js'

/**
 * Admin IP allowlist middleware for /api/admin endpoints (new control #13).
 *
 * Reads ALLOWED_ADMIN_IPS — a comma-separated list of IPv4 addresses and/or
 * CIDR ranges (e.g. "10.0.0.0/8,203.0.113.5"). If unset/empty, the middleware is
 * a no-op passthrough so nothing breaks by default.
 *
 * When configured, only clients whose resolved IP exactly matches an entry or
 * falls within a CIDR range are permitted. All other requests get 403.
 *
 * Limitation: IPv6 is intentionally NOT supported (matches the design brief).
 * An IPv6 client will never match an IPv4 allowlist entry and is therefore
 * denied. Operators should use IPv4 for admin access or front with an IPv4 proxy.
 */

// Convert a dotted-quad IPv4 string to a 32-bit unsigned integer.
const ipToLong = (ip) => {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (let i = 0; i < 4; i++) {
    const octet = Number(parts[i])
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    result = (result << 8) | octet
  }
  return result >>> 0
}

// Parse a CIDR entry ("ip" or "ip/prefix") into { base, mask } longs, or null.
const parseCidr = (entry) => {
  const trimmed = entry.trim()
  if (!trimmed) return null
  if (trimmed.includes('/')) {
    const [ip, prefixStr] = trimmed.split('/')
    const prefix = Number(prefixStr)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null
    const base = ipToLong(ip)
    if (base === null) return null
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    return { base: base & mask, mask }
  }
  const base = ipToLong(trimmed)
  if (base === null) return null
  return { base, mask: 0xffffffff }
}

// Resolve the client IPv4 address. Prefer req.ip — when `trust proxy` is set
// correctly, Express resolves this to the real client IP. Only fall back to the
// first hop of x-forwarded-for in dev when no proxy is configured.
// NOTE: in production behind nginx, do NOT trust XFF — the proxy overwrites it.
const resolveClientIp = (req) => {
  if (req.ip) {
    let ip = req.ip
    if (ip.startsWith('::ffff:')) ip = ip.slice(7)
    if (ipToLong(ip) !== null) return ip
  }
  // Dev-only fallback when there's no proxy configured.
  if (process.env.NODE_ENV !== 'production') {
    const xff = req.headers['x-forwarded-for']
    if (typeof xff === 'string' && xff.length > 0) {
      const firstHop = xff.split(',')[0].trim()
      const ip = firstHop.startsWith('::ffff:') ? firstHop.slice(7) : firstHop
      if (ipToLong(ip) !== null) return ip
    }
  }
  return null
}

export const adminIpAllowlist = (req, res, next) => {
  // Only guard admin endpoints.
  if (!isAdminEndpoint(req)) {
    return next()
  }

  const rawList = process.env.ALLOWED_ADMIN_IPS
  if (!rawList || rawList.trim() === '') {
    // No allowlist configured → passthrough (no-op).
    return next()
  }

  const rules = rawList.split(',').map(parseCidr).filter(Boolean)
  if (rules.length === 0) {
    return next()
  }

  const clientIp = resolveClientIp(req)
  if (!clientIp) {
    // Could not resolve an IPv4 client address (e.g. IPv6-only) → deny.
    return res.status(403).json({
      success: false,
      message: 'Admin access denied from this IP',
      code: 'ADMIN_IP_DENIED'
    })
  }

  const clientLong = ipToLong(clientIp)
  const allowed = rules.some(({ base, mask }) => (clientLong & mask) === base)

  if (!allowed) {
    console.warn(`[Admin IP Allowlist] BLOCKED: ${clientIp} not in ALLOWED_ADMIN_IPS`)
    return res.status(403).json({
      success: false,
      message: 'Admin access denied from this IP',
      code: 'ADMIN_IP_DENIED'
    })
  }

  next()
}

export default adminIpAllowlist
