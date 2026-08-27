import fs from 'fs/promises'
import path from 'path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const normalizeProviderName = () => (process.env.STORAGE_PROVIDER || 'local').toLowerCase()

// Strip path traversal sequences and non-safe characters.
// Forward slashes are NOT allowed — each part must be a single path segment.
const sanitizePathPart = (value = '') => String(value)
  .replace(/\.\./g, '_')           // block traversal
  .replace(/^[./\\]+|[./\\]+$/g, '') // trim leading/trailing dots and slashes
  .replace(/[^\w\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B00-\u0B7F\u0C00-\u0C7F\u0D00-\u0D7F._-]/ug, '_') // eslint-disable-line no-misleading-character-class

const getLocalBaseUrl = () => {
  const isHttps = process.env.ENFORCE_HTTPS === 'true'
  return process.env.BASE_URL || `${isHttps ? 'https' : 'http'}://localhost:${process.env.PORT || 5001}`
}
const getS3Region = () => process.env.AWS_REGION || 'ap-south-1'

const toSupabaseObjectPath = (key) =>
  key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

const getStorageTypeFromMimeType = (mimeType = '') => {
  if (mimeType.startsWith('video/')) return 'videos'
  if (mimeType === 'application/pdf') return 'pdfs'
  return 'images'
}

// Build the object key. When a test/series scope is provided, the category
// becomes a hierarchical path like "tests/123" or "tests/123/questions" so
// that all assets belonging to one test live under a single prefix:
//   assets/tests/123/1234567890-q1.png
// Falls back to the previous flat "assets/<category>" layout.
export const buildObjectKey = (category, filename, { testId, testSeriesId } = {}) => {
  const prefix = sanitizePathPart(process.env.STORAGE_BASE_PATH || 'assets')
  const safeFilename = sanitizePathPart(filename || `asset-${Date.now()}`)
  let segment
  const safeTestId = testId ? sanitizePathPart(String(testId)) : null
  const safeSeriesId = testSeriesId ? sanitizePathPart(String(testSeriesId)) : null

  if (safeTestId && safeSeriesId) {
    segment = `series/${safeSeriesId}/tests/${safeTestId}`
  } else if (safeTestId) {
    segment = `tests/${safeTestId}`
  } else if (safeSeriesId) {
    segment = `series/${safeSeriesId}`
  } else {
    segment = sanitizePathPart(category || 'general')
  }
  return `${prefix}/${segment}/${Date.now()}-${safeFilename}`
}

const readUploadedFile = async (file) => {
  if (file?.buffer) {
    return file.buffer
  }

  if (file?.path) {
    return fs.readFile(file.path)
  }

  throw new Error('Uploaded file buffer/path not found')
}

const cleanupTempFile = async (file) => {
  if (!file?.path) return
  try {
    await fs.unlink(file.path)
  } catch {
    // ignore temp cleanup failures
  }
}

const UPLOADS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../uploads'
)

const ensureDir = async (dir) => {
  try { await fs.mkdir(dir, { recursive: true }) } catch { /* exists */ }
}

const uploadLocal = async (file, scope = {}) => {
  const storageType = getStorageTypeFromMimeType(file.mimetype)
  const fileName = file.filename || path.basename(file.path || '')
  const { testId, testSeriesId } = scope

  // For scoped uploads, mirror the S3-style path on local disk:
  //   uploads/tests/<id>/questions/filename.jpg
  // For unscoped, keep the legacy flat layout (uploads/images/filename.jpg).
  let storageKey
  let fullPath
  if (testId) {
    const safeTestId = sanitizePathPart(String(testId))
    const scopedFolder = testSeriesId
      ? `series/${sanitizePathPart(String(testSeriesId))}/tests/${safeTestId}`
      : `tests/${safeTestId}`
    storageKey = `${scopedFolder}/${fileName}`
    const destDir = path.join(UPLOADS_ROOT, ...scopedFolder.split('/'))
    await ensureDir(destDir)
    fullPath = path.join(destDir, fileName)
  } else {
    storageKey = `${storageType}/${fileName}`
    const destDir = path.join(UPLOADS_ROOT, storageType)
    await ensureDir(destDir)
    fullPath = path.join(destDir, fileName)
  }

  // Move from multer's destination to the scoped folder (if different) or write buffer
  if (file.buffer) {
    await fs.writeFile(fullPath, file.buffer)
  } else {
    const currentPath = file.path ? path.resolve(file.path) : null
    const targetPath = path.resolve(fullPath)
    if (currentPath && currentPath !== targetPath) {
      try {
        await fs.rename(currentPath, targetPath)
      } catch {
        // cross-device rename — fall back to copy+unlink
        await fs.copyFile(currentPath, targetPath)
        await fs.unlink(currentPath).catch(() => {})
      }
    }
  }

  const publicUrl = `${getLocalBaseUrl()}/uploads/${storageKey.split('/').map(encodeURIComponent).join('/')}`
  return {
    provider: 'local',
    storageKey,
    storageType,
    publicUrl,
    signedUrl: publicUrl
  }
}

const getS3Client = () => {
  if (!process.env.S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing S3 configuration. Set S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.')
  }

  const clientConfig = {
    region: getS3Region(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }

  if (process.env.S3_ENDPOINT) {
    clientConfig.endpoint = process.env.S3_ENDPOINT
  }

  return new S3Client(clientConfig)
}

const toS3PublicUrl = (bucket, storageKey) => {
  const encodedKey = storageKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${encodedKey}`
  }

  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}/${encodedKey}`
  }

  return `https://${bucket}.s3.${getS3Region()}.amazonaws.com/${encodedKey}`
}

const uploadS3 = async (file, category, scope = {}) => {
  const client = getS3Client()
  const body = await readUploadedFile(file)
  const storageKey = buildObjectKey(category, file.originalname || file.filename, scope)
  const bucket = process.env.S3_BUCKET
  const putCommandInput = {
    Bucket: bucket,
    Key: storageKey,
    Body: body,
    ContentType: file.mimetype
  }

  if (process.env.S3_ACL) {
    putCommandInput.ACL = process.env.S3_ACL
  }

  await client.send(new PutObjectCommand(putCommandInput))

  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey
    }),
    {
      expiresIn: Number(process.env.SIGNED_URL_TTL_SECONDS || 3600)
    }
  )

  await cleanupTempFile(file)

  return {
    provider: 's3',
    storageKey,
    storageType: category,
    publicUrl: toS3PublicUrl(bucket, storageKey),
    signedUrl
  }
}

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET

  if (!url || !serviceKey || !bucket) {
    throw new Error('Missing Supabase storage config. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET.')
  }

  return { url: url.replace(/\/$/, ''), serviceKey, bucket }
}

const createSupabaseHeaders = (serviceKey, mimeType = 'application/octet-stream') => ({
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  'x-upsert': 'true',
  'Content-Type': mimeType
})

const uploadSupabase = async (file, category, scope = {}) => {
  const { url, serviceKey, bucket } = getSupabaseConfig()
  const body = await readUploadedFile(file)
  const storageKey = buildObjectKey(category, file.originalname || file.filename, scope)
  const objectPath = toSupabaseObjectPath(storageKey)

  const uploadResponse = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: createSupabaseHeaders(serviceKey, file.mimetype),
    body
  })

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text()
    throw new Error(`Supabase upload failed: ${errorBody}`)
  }

  const publicUrl = `${url}/storage/v1/object/public/${bucket}/${objectPath}`

  let signedUrl = publicUrl
  try {
    const signResponse = await fetch(`${url}/storage/v1/object/sign/${bucket}/${objectPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: Number(process.env.SIGNED_URL_TTL_SECONDS || 3600) })
    })
    if (signResponse.ok) {
      const signData = await signResponse.json()
      if (signData?.signedURL) {
        signedUrl = `${url}/storage/v1${signData.signedURL}`
      }
    }
  } catch {
    // keep public URL fallback
  }

  await cleanupTempFile(file)

  return {
    provider: 'supabase',
    storageKey,
    storageType: category,
    publicUrl,
    signedUrl
  }
}

let hasLoggedLocalFallbackWarning = false

const logLocalFallbackWarningIfNeeded = () => {
  if (!hasLoggedLocalFallbackWarning && process.env.NODE_ENV === 'production') {
    hasLoggedLocalFallbackWarning = true
    console.warn('[Storage] WARNING: Falling back to local filesystem storage. Uploaded files will be lost if this container is redeployed or scaled out.')
  }
}

export const storeUploadedAssetFile = async (file, { category = 'general', testId, testSeriesId } = {}) => {
  const provider = normalizeProviderName()
  const scope = { testId, testSeriesId }

  // Try configured provider first
  if (provider === 's3') {
    try {
      return await uploadS3(file, category, scope)
    } catch (error) {
      console.warn('S3 upload failed, falling back to local:', error.message)
    }
  }

  if (provider === 'supabase') {
    try {
      return await uploadSupabase(file, category, scope)
    } catch (error) {
      console.warn('Supabase upload failed, falling back to local:', error.message)
    }
  }

  // Default to local storage — still build a test-scoped path so local
  // filesystem mirrors the S3/Supabase layout.
  logLocalFallbackWarningIfNeeded()
  return uploadLocal(file, scope)
}

const UPLOADS_BASE = process.env.STORAGE_BASE_PATH || path.resolve(__dirname, '../../uploads')

const deleteLocal = async (storageKey) => {
  if (!storageKey) return true
  const resolvedUploads = path.resolve(UPLOADS_BASE)
  const fullPath = path.resolve(path.join(UPLOADS_BASE, storageKey))
  // Prevent path traversal: resolved path must be within UPLOADS_BASE
  if (!fullPath.startsWith(resolvedUploads + path.sep) && fullPath !== resolvedUploads) {
    console.error(`[Storage] Path traversal blocked: ${storageKey} resolves outside uploads dir`)
    return false
  }
  try {
    await fs.unlink(fullPath)
  } catch {
    // file may already be absent
  }
  return true
}

const deleteS3 = async (storageKey) => {
  if (!storageKey) return true
  const client = getS3Client()
  await client.send(new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storageKey
  }))
  return true
}

const deleteSupabase = async (storageKey) => {
  if (!storageKey) return true
  const { url, serviceKey, bucket } = getSupabaseConfig()
  const objectPath = toSupabaseObjectPath(storageKey)
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey
    }
  })
  return response.ok
}

export const deleteStoredAssetFile = async (asset) => {
  const provider = asset?.metadata?.provider || normalizeProviderName()
  const storageKey = asset?.metadata?.storageKey

  if (!storageKey) return true

  if (provider === 's3') {
    return deleteS3(storageKey)
  }
  if (provider === 'supabase') {
    return deleteSupabase(storageKey)
  }

  return deleteLocal(storageKey)
}

export const resolveAssetAccessUrl = (asset) => {
  if (!asset) return null
  return asset?.metadata?.signedUrl || asset?.url || null
}
