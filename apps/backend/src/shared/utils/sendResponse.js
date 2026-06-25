/**
 * Standardized API response helpers
 * Ensures consistent response format and sanitizes error messages
 */

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Sanitize an error message for client response.
 * In production, hides database internals and sensitive details.
 */
const sanitizeMessage = (error, fallback = 'An unexpected error occurred') => {
  if (!error) return fallback

  const msg = error.message || String(error)

  // Hide database error details in production
  if (isProduction) {
    // PostgreSQL error codes — hide internal details
    if (error.code && /^[0-9A-Z]{5}$/.test(error.code)) return fallback
    // Hide SQL-related messages
    if (/relation|column|constraint|syntax error|duplicate key/i.test(msg)) return fallback
  }

  return msg
}

/**
 * Send a success response
 */
export const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data })
}

/**
 * Send a success response with a message
 */
export const sendSuccessMessage = (res, message, data = null, statusCode = 200) => {
  const body = { success: true, message }
  if (data) body.data = data
  return res.status(statusCode).json(body)
}

/**
 * Send an error response with sanitized message
 */
export const sendError = (res, error, statusCode = 500, fallbackMessage = 'An unexpected error occurred') => {
  const message = sanitizeMessage(error, fallbackMessage)
  return res.status(statusCode).json({ success: false, message })
}

/**
 * Send a 404 not found response
 */
export const sendNotFound = (res, resource = 'Resource') => {
  return res.status(404).json({ success: false, message: `${resource} not found` })
}

/**
 * Send a 400 bad request response
 */
export const sendBadRequest = (res, message) => {
  return res.status(400).json({ success: false, message })
}
