/**
 * Input Validation Middleware and Utilities
 * Addresses Issue #6: Missing Input Validation
 */

// Validation helper functions
const validators = {
  // Check if value is a non-empty string
  isNonEmptyString: (value, minLength = 1, maxLength = 1000) => {
    if (typeof value !== 'string') return false
    const trimmed = value.trim()
    return trimmed.length >= minLength && trimmed.length <= maxLength
  },

  // Check if value is a valid email
  isValidEmail: (value) => {
    if (typeof value !== 'string') return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  },

  // Check if value is a valid MongoDB/ObjectId-like ID
  isValidId: (value) => {
    if (!value) return false
    // Allow numeric IDs (PostgreSQL) or UUIDs
    if (/^\d+$/.test(value)) return true
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true
    return false
  },

  // Check if value is a valid positive integer
  isPositiveInteger: (value) => {
    const num = parseInt(value, 10)
    return !isNaN(num) && num > 0 && String(num) === String(value)
  },

  // Check if value is within a range
  isInRange: (value, min, max) => {
    const num = parseFloat(value)
    return !isNaN(num) && num >= min && num <= max
  },

  // Check if value is in allowed list
  isOneOf: (value, allowedValues) => {
    return allowedValues.includes(value)
  },

  // Check if value is a valid URL
  isValidUrl: (value) => {
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  },

  // Check if value is valid JSON
  isValidJson: (value) => {
    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  },

  // Sanitize string (remove potential XSS)
  sanitizeString: (value, maxLength = 1000) => {
    if (typeof value !== 'string') return ''
    return value
      .trim()
      .substring(0, maxLength)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  },

  // Check if object has required fields
  hasRequiredFields: (obj, fields) => {
    return fields.every(field => {
      const value = obj[field]
      return value !== undefined && value !== null && value !== ''
    })
  },
}

/**
 * Validation schema builder
 */
class ValidationSchema {
  constructor() {
    this.rules = []
  }

  field(fieldName, options = {}) {
    this.rules.push({
      field: fieldName,
      required: options.required !== false,
      type: options.type || 'string',
      minLength: options.minLength || 0,
      maxLength: options.maxLength || 1000,
      min: options.min,
      max: options.max,
      pattern: options.pattern || null,
      custom: options.custom || null,
      sanitize: options.sanitize !== false,
      message: options.message || null,
    })
    return this
  }

  validate(data) {
    const errors = []
    const sanitized = {}

    for (const rule of this.rules) {
      const value = data[rule.field]
      
      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: rule.field,
          message: rule.message || `${rule.field} is required`,
          code: 'REQUIRED',
        })
        continue
      }

      // Skip further validation if optional and not provided
      if (value === undefined || value === null || value === '') {
        sanitized[rule.field] = null
        continue
      }

      let processedValue = value

      // Type validation
      switch (rule.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a string`,
              code: 'TYPE_ERROR',
            })
          } else {
            // Length validation
            if (value.length < rule.minLength) {
              errors.push({
                field: rule.field,
                message: `${rule.field} must be at least ${rule.minLength} characters`,
                code: 'MIN_LENGTH',
              })
            }
            if (value.length > rule.maxLength) {
              errors.push({
                field: rule.field,
                message: `${rule.field} must be at most ${rule.maxLength} characters`,
                code: 'MAX_LENGTH',
              })
            }
            // Pattern validation
            if (rule.pattern && !rule.pattern.test(value)) {
              errors.push({
                field: rule.field,
                message: rule.message || `${rule.field} format is invalid`,
                code: 'PATTERN_MISMATCH',
              })
            }
            // Sanitization
            if (rule.sanitize) {
              processedValue = validators.sanitizeString(value, rule.maxLength)
            }
          }
          break

        case 'email':
          if (!validators.isValidEmail(value)) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a valid email address`,
              code: 'INVALID_EMAIL',
            })
          }
          break

        case 'id':
          if (!validators.isValidId(value)) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a valid ID`,
              code: 'INVALID_ID',
            })
          }
          break

        case 'integer': {
          const intVal = parseInt(value, 10)
          const min = rule.min ?? 1
          if (isNaN(intVal) || intVal < min || String(intVal) !== String(value)) {
            errors.push({
              field: rule.field,
              message: min > 0 ? `${rule.field} must be a positive integer` : `${rule.field} must be a non-negative integer`,
              code: 'INVALID_INTEGER',
            })
          } else {
            processedValue = intVal
          }
          break
        }

        case 'number':
          if (isNaN(parseFloat(value))) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a number`,
              code: 'INVALID_NUMBER',
            })
          } else {
            processedValue = parseFloat(value)
          }
          break

        case 'boolean':
          if (typeof value !== 'boolean' && !['true', 'false', '1', '0'].includes(String(value))) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a boolean`,
              code: 'INVALID_BOOLEAN',
            })
          } else {
            processedValue = value === true || value === 'true' || value === '1'
          }
          break

        case 'array':
          if (!Array.isArray(value)) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be an array`,
              code: 'INVALID_ARRAY',
            })
          }
          break

        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be an object`,
              code: 'INVALID_OBJECT',
            })
          }
          break

        case 'url':
          if (!validators.isValidUrl(value)) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a valid URL`,
              code: 'INVALID_URL',
            })
          }
          break
      }

      // Custom validation
      if (rule.custom && !errors.find(e => e.field === rule.field)) {
        const customResult = rule.custom(value)
        if (customResult !== true) {
          errors.push({
            field: rule.field,
            message: customResult || `${rule.field} is invalid`,
            code: 'CUSTOM_VALIDATION',
          })
        }
      }

      sanitized[rule.field] = processedValue
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: sanitized,
    }
  }
}

/**
 * Create a validation schema
 */
export const createSchema = () => new ValidationSchema()

/**
 * Validation middleware factory
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.validate(req.body)
    if (!result.isValid) {
      console.warn('[VALIDATION ERROR]', {
        endpoint: req.path,
        method: req.method,
        errors: result.errors,
        receivedFields: Object.keys(req.body)
      })
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: result.errors,
        },
      })
    }
    req.validatedBody = result.data
    next()
  }
}

export const validateQuery = (schema) => {
  return (req, res, next) => {
    const result = schema.validate(req.query)
    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: result.errors,
        },
      })
    }
    req.validatedQuery = result.data
    next()
  }
}

export const validateParams = (schema) => {
  return (req, res, next) => {
    const result = schema.validate(req.params)
    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: result.errors,
        },
      })
    }
    req.validatedParams = result.data
    next()
  }
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // ID parameter validation
  idParam: createSchema().field('id', { type: 'id', required: true }),

  // Pagination query validation
  pagination: createSchema()
    .field('page', { type: 'integer', required: false })
    .field('limit', { type: 'integer', required: false })
    .field('sort', { type: 'string', required: false, maxLength: 50 })
    .field('order', { type: 'string', required: false, maxLength: 10 }),

  // User registration validation
  userRegistration: createSchema()
    .field('name', { type: 'string', required: true, minLength: 2, maxLength: 100 })
    .field('email', { type: 'email', required: true })
    .field('password', { type: 'string', required: true, minLength: 8, maxLength: 128 }),

  // User login validation
  userLogin: createSchema()
    .field('email', { type: 'email', required: true })
    .field('password', { type: 'string', required: true }),

  // Test series validation
  testSeries: createSchema()
    .field('name', { type: 'string', required: true, minLength: 2, maxLength: 200 })
    .field('description', { type: 'string', required: false, maxLength: 2000 })
    .field('isPro', { type: 'boolean', required: false }),

  // Question validation
  question: createSchema()
    .field('question', { type: 'string', required: true, minLength: 5, maxLength: 5000 })
    .field('options', { type: 'array', required: true })
    .field('correctAnswer', { type: 'integer', required: true })
    .field('subject', { type: 'string', required: false, maxLength: 100 })
    .field('topic', { type: 'string', required: false, maxLength: 100 }),
}

// Export validators for custom use
export { validators }

export default {
  createSchema,
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
  validators,
}