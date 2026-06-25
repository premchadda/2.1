import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ===== FILE UPLOAD SECURITY (Issue #5) =====
// Reduced max file size from 500MB to reasonable limits
const MAX_FILE_SIZE_IMAGE = 10 * 1024 * 1024  // 10MB for images
const MAX_FILE_SIZE_PDF = 50 * 1024 * 1024    // 50MB for PDFs
const MAX_FILE_SIZE_VIDEO = 100 * 1024 * 1024 // 100MB for videos (reduced from 500MB)

// Allowed file extensions (additional validation beyond MIME type)
const ALLOWED_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  pdf: ['.pdf'],
  video: ['.mp4', '.webm'],
  document: ['.json', '.csv', '.xlsx', '.xls']
}

// File magic numbers for content validation
const FILE_SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
}

// Create upload directories function
function ensureUploadDirs() {
  const uploadsDir = path.join(__dirname, '../../uploads')
  const videosDir = path.join(uploadsDir, 'videos')
  const pdfsDir = path.join(uploadsDir, 'pdfs')
  const imagesDir = path.join(uploadsDir, 'images')
  const docsDir = path.join(uploadsDir, 'docs')
  
  const dirs = [uploadsDir, videosDir, pdfsDir, imagesDir, docsDir]
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })
  
  return { uploadsDir, videosDir, pdfsDir, imagesDir, docsDir }
}

// Ensure directories exist
const dirs = ensureUploadDirs()

// Generate secure random filename using UUID
const generateSecureFilename = (originalExt) => {
  const uuid = crypto.randomUUID()
  const ext = originalExt.toLowerCase()
  return `${uuid}${ext}`
}

// Validate file content by checking magic numbers
const validateFileContent = (filePath, mimetype) => {
  try {
    const buffer = Buffer.alloc(8)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buffer, 0, 8, 0)
    fs.closeSync(fd)
    
    const signature = FILE_SIGNATURES[mimetype]
    if (!signature) {
      // For types without signature validation (videos), accept based on extension
      return true
    }
    
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false
      }
    }
    return true
  } catch (error) {
    console.error('File content validation error:', error.message)
    return false
  }
}

// Get max file size based on file type
const getMaxFileSize = (mimetype) => {
  if (mimetype.startsWith('image/')) return MAX_FILE_SIZE_IMAGE
  if (mimetype === 'application/pdf') return MAX_FILE_SIZE_PDF
  if (mimetype.startsWith('video/')) return MAX_FILE_SIZE_VIDEO
  return 10 * 1024 * 1024 // Default 10MB
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = dirs.uploadsDir
    
    // Determine destination based on file type
    if (file.mimetype.startsWith('video/')) {
      uploadPath = dirs.videosDir
    } else if (file.mimetype === 'application/pdf') {
      uploadPath = dirs.pdfsDir
    } else if (file.mimetype.startsWith('image/')) {
      uploadPath = dirs.imagesDir
    } else if (['application/json', 'text/csv'].includes(file.mimetype) || file.mimetype.includes('spreadsheet')) {
      uploadPath = dirs.docsDir
    }
    
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    // ===== SECURITY: Use UUID-based filenames (Issue #5) =====
    // Don't use original filename to prevent information leakage
    const ext = path.extname(file.originalname).toLowerCase()
    
    // Validate extension
    let fileType = 'other'
    if (file.mimetype.startsWith('image/')) fileType = 'image'
    else if (file.mimetype === 'application/pdf') fileType = 'pdf'
    else if (file.mimetype.startsWith('video/')) fileType = 'video'
    else if (['application/json', 'text/csv'].includes(file.mimetype) || file.mimetype.includes('spreadsheet')) fileType = 'document'
    
    if (!ALLOWED_EXTENSIONS[fileType]?.includes(ext)) {
      return cb(new Error(`File extension ${ext} not allowed for ${fileType}`), false)
    }
    
    const secureFilename = generateSecureFilename(ext)
    cb(null, secureFilename)
  }
})

// File filter with enhanced validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/webm',
    'video/mkv',
    'application/json',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
  
  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} not allowed`), false)
  }
  
  // Check extension matches MIME type
  const ext = path.extname(file.originalname).toLowerCase()
  let expectedExtensions = []
  
  if (file.mimetype.startsWith('image/')) {
    expectedExtensions = ALLOWED_EXTENSIONS.image
  } else if (file.mimetype === 'application/pdf') {
    expectedExtensions = ALLOWED_EXTENSIONS.pdf
  } else if (file.mimetype.startsWith('video/')) {
    expectedExtensions = ALLOWED_EXTENSIONS.video
  } else if (['application/json', 'text/csv'].includes(file.mimetype) || file.mimetype.includes('spreadsheet')) {
    expectedExtensions = ALLOWED_EXTENSIONS.document
  }
  
  if (!expectedExtensions.includes(ext)) {
    return cb(new Error(`File extension ${ext} does not match MIME type ${file.mimetype}`), false)
  }
  
  cb(null, true)
}

// Multer instance with dynamic file size limits
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_VIDEO, // Max limit (individual routes can set lower)
    files: 5, // Limit number of files per request
  }
})

// Memory storage for bulk uploads that need buffer access (JSON, CSV, Excel)
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit should be plenty for data files
    files: 1,
  }
})

// Create upload middleware with specific file size limit
export const createUploadMiddleware = (fileType) => {
  const maxSize = getMaxFileSize(fileType + '/')
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
      files: 1,
    }
  })
}

// Helper to get file URL
export const getFileUrl = (filename, type) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5001'
  return `${baseUrl}/uploads/${type}/${filename}`
}

// Export validation functions for use in routes
export { validateFileContent, getMaxFileSize, ALLOWED_EXTENSIONS }

