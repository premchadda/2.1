/**
 * Custom Error Classes and Error Handling Middleware
 * Addresses Issue #7: Inconsistent Error Handling
 */

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.userMessage = message;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 * In production, raw error messages are sanitized to prevent information leaks
 */
export const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    console.error("Error:", {
      code: err.code,
      statusCode: err.statusCode,
      isOperational: err.isOperational,
    });
  } else {
    console.error("Error:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode,
    });
  }

  const sanitizeMessage = (e) => {
    if (!isProduction) return e.userMessage || e.message;
    if (e.userMessage) return e.userMessage;
    const knownErrors = {
      ValidationError: "Invalid input data",
      UnauthorizedError: "Authentication required",
      ForbiddenError: "Access denied",
      NotFoundError: "Resource not found",
      ConflictError: "Resource conflict",
      RateLimitError: "Too many requests, please try again later",
    };
    const errorName = e.constructor?.name || e.name;
    if (knownErrors[errorName]) return knownErrors[errorName];
    if (e.statusCode && e.statusCode < 500) return e.message;
    return "An unexpected error occurred. Please try again later.";
  };

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: sanitizeMessage(err),
        ...(err.errors && { errors: err.errors }),
      },
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
      },
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_EXPIRED",
        message: "Authentication token has expired",
      },
    });
  }

  if (err.name === "ValidationError" && err.errors) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        errors: Object.values(err.errors).map((e) => ({
          field: e.path || e.param,
          message: e.message,
        })),
      },
    });
  }

  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_ENTRY",
        message: "A record with this information already exists",
      },
    });
  }

  if (err.code === "23503") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_REFERENCE",
        message: "Referenced record does not exist",
      },
    });
  }

  if (err.code === "23502") {
    return res.status(400).json({
      success: false,
      error: {
        code: "MISSING_FIELD",
        message: "Required field is missing",
      },
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: "File size exceeds the allowed limit",
      },
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      error: {
        code: "UNEXPECTED_FILE",
        message: "Unexpected file field in upload",
      },
    });
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      error: {
        code: "CORS_ERROR",
        message: "Origin not allowed by CORS policy",
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction
        ? "An unexpected error occurred. Please try again later."
        : err.message,
    },
  });
};

/**
 * Requests for these look like static assets (images, fonts, docs, media).
 * When they miss, we return a bare 404 instead of routing through
 * errorHandler, which would dump a full Error object + stack trace into the
 * logs for every broken/stale asset URL (e.g. an avatar_url in the DB whose
 * file was written by a different deployment sharing the same database).
 */
const STATIC_ASSET_URL_RE =
  /\.(jpg|jpeg|png|gif|webp|avif|svg|ico|bmp|css|js|map|txt|json|woff2?|ttf|otf|eot|pdf|docx?|xlsx?|pptx?|mp3|mp4|webm|ogg|wav)$/i;

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  const pathOnly = req.originalUrl.split("?")[0];
  if (STATIC_ASSET_URL_RE.test(pathOnly)) {
    return res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${req.originalUrl} not found`,
      },
    });
  }
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors and pass to error middleware
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
