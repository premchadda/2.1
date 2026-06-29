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

async function saveTestContent(testId, content) {
  await ensureDir()
  const filePath = filePathFor(testId)
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf8')
  return relativePathFor(testId)
}

async function readTestContent(testId) {
  const filePath = filePathFor(testId)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function readTestContentByPath(contentPath) {
  const filePath = path.join(process.cwd(), contentPath)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function deleteTestContent(testId) {
  const filePath = filePathFor(testId)
  try {
    await fs.unlink(filePath)
    return true
  } catch {
    return false
  }
}

async function testContentExists(testId) {
  const filePath = filePathFor(testId)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function listTestContent() {
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