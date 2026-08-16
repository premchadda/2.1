import { createSchema } from '../../middleware/validation/inputValidation.js';

// Upload validation — was a placeholder (empty schema). Now validates
// file metadata for upload endpoints.

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/json',
]

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024

export const fileUploadSchema = createSchema()
  .field('fileType', {
    type: 'string',
    required: false,
    custom: (value) => {
      if (!value) return true // optional
      return ALLOWED_MIME_TYPES.some(t => value.startsWith(t.split('/')[0]))
        ? true
        : `File type '${value}' is not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
    },
  })
  .field('description', { type: 'string', required: false, maxLength: 500 })

// Default export (backward compat)
export default createSchema()
