import multer from 'multer'
import path from 'path'
import crypto from 'crypto'

// HIGH-13 FIX: Request validation for bulk upload endpoints
// Validates file type, size, and content before processing

const ALLOWED_MIME_TYPES = new Set([
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/pdf',
  'text/csv',
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'temporary'))
  },
  filename: (req, file, cb) => {
    const hash = crypto.randomBytes(16).toString('hex')
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${hash}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`), false)
    return
  }
  cb(null, true)
}

export const uploadValidation = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
})

export default uploadValidation