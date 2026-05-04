// Base Controller Class
export class BaseController {
  constructor() {
    this.handleAsync = this.handleAsync.bind(this);
  }

  // Wrapper for async route handlers
  handleAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Success response helper
  sendSuccess(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  // Error response helper
  sendError(res, message = 'Internal Server Error', statusCode = 500, error = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: error ? error.message : undefined
    });
  }

  // Validation error response
  sendValidationError(res, errors) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
}