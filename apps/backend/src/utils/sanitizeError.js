function sanitizeErrorMessage(error) {
  if (process.env.NODE_ENV === 'production') {
    const knownErrors = {
      'ValidationError': 'Invalid input data',
      'UnauthorizedError': 'Authentication required',
      'ForbiddenError': 'Access denied',
      'NotFoundError': 'Resource not found',
      'ConflictError': 'Resource conflict',
      'RateLimitError': 'Too many requests, please try again later',
    }
    const errorName = error.constructor?.name || error.name
    if (knownErrors[errorName]) return knownErrors[errorName]
    if (error.statusCode && error.statusCode < 500) return error.message
    return 'An unexpected error occurred. Please try again later.'
  }
  return error.message
}

function createSafeError(statusCode, userMessage, internalMessage) {
  const err = new Error(userMessage)
  err.statusCode = statusCode
  err.userMessage = userMessage
  // Store internal message separately — do NOT put it in Error.message
  // because most Express handlers serialize .message to the client
  if (internalMessage) err.internalMessage = internalMessage
  return err
}

export { sanitizeErrorMessage, createSafeError }
