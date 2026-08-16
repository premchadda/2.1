import crypto from 'crypto'

const ID_MAX_LENGTH = 64

// SEC: Reject attacker-controlled `x-request-id` values that contain
// characters usable for log/header injection. Anything unsafe is ignored
// and a server-generated id is used instead.
const sanitizeRequestId = (raw) => {
  if (typeof raw !== 'string') return null
  if (raw.length > ID_MAX_LENGTH || raw.length === 0) return null
  return /^[A-Za-z0-9._:/=+-]+$/.test(raw) ? raw : null
}

// OBS-01: Correlation ID middleware for distributed tracing.
// Use a sanitized x-request-id if present, else generate UUIDv4.
export const traceMiddleware = (req, res, next) => {
  const incoming = sanitizeRequestId(req.headers['x-request-id'])
  const id = incoming || crypto.randomUUID()
  req.id = id
  req.traceId = id
  res.setHeader('X-Request-Id', id)
  req.startTime = Date.now()
  next()
}
