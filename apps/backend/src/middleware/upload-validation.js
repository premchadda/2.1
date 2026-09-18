import multer from 'multer'
import path from 'path'
import fs from 'fs'
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

// Extension allowlist: enforce even when the MIME type is allowed, so a
// spoofed mimetype with a dangerous extension (.php/.js/.exe/...) is
// rejected instead of being written to disk under an executable name.
const ALLOWED_EXTENSIONS = new Set([
  '.json',
  '.xlsx',
  '.xls',
  '.csv',
  '.pdf',
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'temporary')

// Mirror ensureUploadDirs-style behavior: create the destination recursively
// so the first upload after a fresh deploy does not fail with ENOENT.
const ensureTempUploadDir = () => {
  try {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true })
  } catch {
    /* exists or created concurrently */
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureTempUploadDir()
    cb(null, TEMP_UPLOAD_DIR)
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
  // Sanitize: normalize the extension (extname → lowercase) and require it
  // to be in the allowlist. Extensionless names yield '' and are rejected.
  const ext = path.extname(file.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new Error(`File extension ${ext || '(none)'} not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`), false)
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