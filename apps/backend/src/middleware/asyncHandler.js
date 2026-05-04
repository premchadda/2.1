/**
 * Async Handler Middleware
 * Eliminates 500+ lines of try-catch boilerplate across all route files
 */

/**
 * Wraps async route handlers to catch errors automatically
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

/**
 * Wraps multiple async route handlers
 * @param {Function[]} fns - Array of async route handler functions
 * @returns {Function[]} Array of wrapped middleware functions
 */
export const asyncHandlers = (...fns) => {
  return fns.map(fn => asyncHandler(fn))
}