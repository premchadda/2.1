/**
 * Centralized API Response Utility (DX-03).
 * Ensures a consistent response shape across all Express routes:
 * Success: { success: true, data: ... }
 * Failure: { success: false, message: '...', details: ... }
 */

/**
 * Send a successful response.
 * @param {import('express').Response} res - Express response object
 * @param {any} data - Data to send to client
 * @param {number} [status=200] - HTTP status code
 */
export const ok = (res, data, status = 200) => {
  return res.status(status).json({
    success: true,
    data,
  })
}

/**
 * Send a failure response.
 * @param {import('express').Response} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {any} [details=null] - Optional error details
 */
export const fail = (res, status, message, details = null) => {
  const response = {
    success: false,
    message,
  }
  if (details !== null) {
    response.details = details
  }
  return res.status(status).json(response)
}

export default {
  ok,
  fail,
}
