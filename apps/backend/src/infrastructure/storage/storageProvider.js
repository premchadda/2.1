import fs from 'fs/promises'
import path from 'path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const normalizeProviderName = () => (process.env.STORAGE_PROVIDER || 'local').toLowerCase()

const sanitizePathPart = (value = '') => String(value).replace(/[^a-zA-Z0-9._/-]/g, '-')

const getLocalBaseUrl = () => process.env.BASE_URL || `http://localhost:${process.env.PORT || 5001}`
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

const buildObjectKey = (category, filename) => {
  const prefix = sanitizePathPart(process.env.STORAGE_BASE_PATH || 'assets')
  const safeCategory = sanitizePathPart(category || 'general')
  const safeFilename = sanitizePathPart(filename || `asset-${Date.now()}`)
  return `${prefix}/${safeCategory}/${Date.now()}-${safeFilename}`
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

const uploadLocal = async (file) => {
  const storageType = getStorageTypeFromMimeType(file.mimetype)
  const fileName = file.filename || path.basename(file.path || '')
  const storageKey = `${storageType}/${fileName}`
  const publicUrl = `${getLocalBaseUrl()}/uploads/${storageType}/${fileName}`

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

const uploadS3 = async (file, category) => {
  const client = getS3Client()
  const body = await readUploadedFile(file)
  const storageKey = buildObjectKey(category, file.originalname || file.filename)
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

const uploadSupabase = async (file, category) => {
  const { url, serviceKey, bucket } = getSupabaseConfig()
  const body = await readUploadedFile(file)
  const storageKey = buildObjectKey(category, file.originalname || file.filename)
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

export const storeUploadedAssetFile = async (file, { category = 'general' } = {}) => {
  const provider = normalizeProviderName()

  // Try configured provider first
  if (provider === 's3') {
    try {
      return await uploadS3(file, category)
    } catch (error) {
      console.warn('S3 upload failed, falling back to local:', error.message)
    }
  }

  if (provider === 'supabase') {
    try {
      return await uploadSupabase(file, category)
    } catch (error) {
      console.warn('Supabase upload failed, falling back to local:', error.message)
    }
  }

  // Default to local storage
  return uploadLocal(file)
}

const deleteLocal = async (storageKey) => {
  if (!storageKey) return true
  const uploadsBase = path.resolve(__dirname, '../../uploads')
  const fullPath = path.join(uploadsBase, storageKey)
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
