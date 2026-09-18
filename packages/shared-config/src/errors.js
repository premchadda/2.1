/**
 * Shared API error types — single source of truth.
 *
 * Previously duplicated in:
 *   - apps/frontend/src/shared/lib/apiClient.js
 *   - apps/frontend/src/shared/lib/errors.js (dead)
 *   - apps/admin-panel/src/shared/lib/dataService.js
 *
 * Import from '@trstprep/shared-config' instead of redefining locally.
 */

export class DataError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = "DataError";
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends DataError {
  constructor(message, details = null) {
    super(message, "NETWORK_ERROR", details);
    this.name = "NetworkError";
    this.status = 0;
  }
}

export class ValidationError extends DataError {
  constructor(message, details = null) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
    this.status = 400;
  }
}

export class AuthenticationError extends DataError {
  constructor(message, details = null) {
    super(message, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
    this.status = 401;
  }
}

export class NotFoundError extends DataError {
  constructor(message, details = null) {
    super(message, "NOT_FOUND_ERROR", details);
    this.name = "NotFoundError";
    this.status = 404;
  }
}

export class ForbiddenError extends DataError {
  constructor(message, details = null) {
    super(message, "FORBIDDEN_ERROR", details);
    this.name = "ForbiddenError";
    this.status = 403;
  }
}

export class RateLimitError extends DataError {
  constructor(message, details = null, retryAfter = null) {
    super(message, "RATE_LIMIT_ERROR", details);
    this.name = "RateLimitError";
    this.status = 429;
    this.retryAfter = retryAfter;
  }
}

export default {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
  RateLimitError,
};
