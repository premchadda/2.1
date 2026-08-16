import { createSchema } from '../../middleware/validation/inputValidation.js';

// Auth validation schemas — was a placeholder (empty schema) that let any input
// through. Now defines actual validation rules for login, register, password reset.

// POST /api/auth/login
export const loginSchema = createSchema()
  .field('email', { type: 'email', required: true, message: 'A valid email address is required' })
  .field('password', { type: 'string', required: true, minLength: 1, maxLength: 128, sanitize: false })

// POST /api/auth/register
export const registerSchema = createSchema()
  .field('email', { type: 'email', required: true, message: 'A valid email address is required' })
  .field('password', { type: 'string', required: true, minLength: 8, maxLength: 128, sanitize: false })
  .field('name', { type: 'string', required: true, minLength: 1, maxLength: 100 })
  .field('mobile', {
    type: 'string',
    required: false,
    pattern: /^[6-9]\d{9}$/,
    message: 'Mobile number must be a valid 10-digit Indian number starting with 6-9',
  })

// POST /api/auth/forgot-password
export const forgotPasswordSchema = createSchema()
  .field('email', { type: 'email', required: true, message: 'A valid email address is required' })

// POST /api/auth/reset-password
export const resetPasswordSchema = createSchema()
  .field('token', { type: 'string', required: true, sanitize: false })
  .field('newPassword', { type: 'string', required: true, minLength: 8, maxLength: 128, sanitize: false })

// POST /api/auth/change-password
export const changePasswordSchema = createSchema()
  .field('currentPassword', { type: 'string', required: true, sanitize: false })
  .field('newPassword', { type: 'string', required: true, minLength: 8, maxLength: 128, sanitize: false })

// Default export (backward compat — was empty schema)
export default createSchema()
