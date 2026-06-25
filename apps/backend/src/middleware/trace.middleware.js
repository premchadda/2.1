import crypto from 'crypto'

// OBS-01: Correlation ID middleware for distributed tracing.
// Use existing x-request-id if present, else generate UUIDv4.
export const traceMiddleware = (req, res, next) => {
  const id = req.headers['x-request-id'] || crypto.randomUUID()
  req.traceId = id
  res.setHeader('x-request-id', id)
  req.startTime = Date.now()
  next()
}