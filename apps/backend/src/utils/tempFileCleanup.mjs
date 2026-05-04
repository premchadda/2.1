import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// FIXED: Use correct path to uploads directory (relative to backend root, not src/utils)
const TEMP_DIR = path.resolve(__dirname, '../../uploads/temporary')
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Recursively clean up files older than threshold
 * @param {string} dirPath - Directory to scan
 * @param {number} maxAgeMs - Max age in milliseconds
 * @returns {Promise<{deleted: string[], errors: string[]}>}
 */
async function cleanupOldFiles(dirPath = TEMP_DIR, maxAgeMs = MAX_AGE_MS) {
  const result = { deleted: [], errors: [] }

  if (!fs.existsSync(dirPath)) {
    console.log(`Temp directory does not exist: ${dirPath}`)
    return result
  }

  const now = Date.now()

  function scanDirectory(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        scanDirectory(fullPath)
        // Remove empty directories
        try {
          const dirEntries = fs.readdirSync(fullPath)
          if (dirEntries.length === 0) {
            fs.rmdirSync(fullPath)
            console.log(`Removed empty directory: ${fullPath}`)
          }
        } catch (e) {
          console.error(`Error removing directory ${fullPath}:`, e.message)
        }
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath)
        const fileAge = now - stats.mtimeMs

        if (fileAge > maxAgeMs) {
          try {
            fs.unlinkSync(fullPath)
            const relPath = path.relative(TEMP_DIR, fullPath)
            result.deleted.push(relPath)
            console.log(`Deleted old file: ${relPath} (${Math.round(fileAge / (1000 * 60 * 60))}h old)`)
          } catch (e) {
            result.errors.push(`Failed to delete: ${fullPath} - ${e.message}`)
            console.error(`Error deleting ${fullPath}:`, e.message)
          }
        }
      }
    }
  }

  scanDirectory(dirPath)
  return result
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('🧹 Starting temp file cleanup...')
  console.log(`Scanning: ${TEMP_DIR}`)
  console.log(`Max age: ${MAX_AGE_MS / (1000 * 60 * 60)} hours`)

  cleanupOldFiles()
    .then(result => {
      console.log(`\n✅ Cleanup complete: ${result.deleted.length} files deleted`)
      if (result.errors.length > 0) {
        console.warn(`⚠️  ${result.errors.length} errors: ${result.errors.slice(0, 3).join(', ')}`)
      }
      process.exit(0)
    })
    .catch(e => {
      console.error('❌ Cleanup failed:', e)
      process.exit(1)
    })
}

export { cleanupOldFiles }