import fs from 'fs/promises'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'tests')

async function ensureDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

function filePathFor(testId) {
  return path.join(STORAGE_DIR, `${testId}.json`)
}

function relativePathFor(testId) {
  return `storage/tests/${testId}.json`
}

function s3KeyFor(testId) {
  return `tests/${testId}.json`
}

function isS3Mode() {
  return (process.env.STORAGE_PROVIDER || 'local').toLowerCase() === 's3' && process.env.S3_BUCKET
}

async function getS3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3')
  const clientConfig = {
    region: process.env.AWS_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  }
  if (process.env.S3_ENDPOINT) {
    clientConfig.endpoint = process.env.S3_ENDPOINT
  }
  return new S3Client(clientConfig)
}

async function saveTestContent(testId, content) {
  const json = JSON.stringify(content, null, 2)

  if (isS3Mode()) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await getS3Client()
    const key = s3KeyFor(testId)
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: json,
      ContentType: 'application/json',
    }))
    return key
  }

  await ensureDir()
  const filePath = filePathFor(testId)
  await fs.writeFile(filePath, json, 'utf8')
  return relativePathFor(testId)
}

async function readTestContent(testId) {
  if (isS3Mode()) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await getS3Client()
    const key = s3KeyFor(testId)
    const response = await client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }))
    const body = await response.Body.transformToString('utf8')
    return JSON.parse(body)
  }

  const filePath = filePathFor(testId)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function readTestContentByPath(contentPath) {
  if (isS3Mode() && contentPath.startsWith('tests/')) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await getS3Client()
    const response = await client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: contentPath,
    }))
    const body = await response.Body.transformToString('utf8')
    return JSON.parse(body)
  }

  const filePath = path.join(process.cwd(), contentPath)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function deleteTestContent(testId) {
  if (isS3Mode()) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await getS3Client()
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3KeyFor(testId),
      }))
      return true
    } catch {
      return false
    }
  }

  const filePath = filePathFor(testId)
  try {
    await fs.unlink(filePath)
    return true
  } catch {
    return false
  }
}

async function testContentExists(testId) {
  if (isS3Mode()) {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
    const client = await getS3Client()
    try {
      await client.send(new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3KeyFor(testId),
      }))
      return true
    } catch {
      return false
    }
  }

  const filePath = filePathFor(testId)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function listTestContent() {
  if (isS3Mode()) {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const client = await getS3Client()
    const response = await client.send(new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: 'tests/',
    }))
    return (response.Contents || [])
      .map(obj => obj.Key)
      .filter(key => key.endsWith('.json'))
      .map(key => key.replace(/^tests\//, '').replace(/\.json$/, ''))
  }

  await ensureDir()
  const files = await fs.readdir(STORAGE_DIR)
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
}

export {
  saveTestContent,
  readTestContent,
  readTestContentByPath,
  deleteTestContent,
  testContentExists,
  listTestContent,
  relativePathFor,
  STORAGE_DIR,
}