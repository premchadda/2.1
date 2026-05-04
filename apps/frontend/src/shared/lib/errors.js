/**
 * Error Types - Custom error classes for API operations
 * 
 * Provides typed errors for better error handling across the application.
 */

/**
 * Base data error class
 */
export class DataError extends Error {
  constructor(message, code, details = null) {
    super(message)
    this.name = 'DataError'
    this.code = code
    this.details = details
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends DataError {
  constructor(message, details = null) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}

/**
 * Validation errors (client-side or server-side)
 */
export class ValidationError extends DataError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends DataError {
  constructor(message, details = null) {
    super(message, 'AUTHENTICATION_ERROR', details)
    this.name = 'AuthenticationError'
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends DataError {
  constructor(message, details = null) {
    super(message, 'NOT_FOUND_ERROR', details)
    this.name = 'NotFoundError'
  }
}

export default {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError
}