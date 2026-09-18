import { ragService } from './rag.service.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import logger from '../../infrastructure/logger/logger.js'

const execFileAsync = promisify(execFile)

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const pdfProcessor = {
  /**
   * Process and extract text from a file buffer (gracefully handling plain text or PDF format)
   */
  async processFile(documentName, buffer) {
    let text = ''
    try {
      // 20MB input cap — oversized uploads fail fast before temp-file + spawn
      const MAX_PDF_BYTES = 20 * 1024 * 1024
      if (buffer.length > MAX_PDF_BYTES) {
        throw new Error('Document exceeds 20MB size limit')
      }
      // Basic text file / PDF format check
      const isPdf = buffer.slice(0, 4).toString() === '%PDF'

      if (isPdf) {
        // PDF text extraction using PyMuPDF4LLM
        const tempId = crypto.randomUUID()
        const tempPdfPath = path.join(os.tmpdir(), `${tempId}.pdf`)
        await fs.writeFile(tempPdfPath, buffer)

        const runExtract = async (pythonBin) => {
          const scriptPath = path.join(__dirname, 'extract_pdf.py')
          return execFileAsync(pythonBin, [scriptPath, tempPdfPath], {
            maxBuffer: 20 * 1024 * 1024, // 20MB max output buffer
            timeout: 60000,
          })
        }
        try {
          let stdout
          try {
            ;({ stdout } = await runExtract('python3'))
          } catch {
            ;({ stdout } = await runExtract('python'))
          }
          text = stdout
        } finally {
          // Cleanup
          await fs.unlink(tempPdfPath).catch(err => logger.error({ err }, '[PDF Processor] Failed to clean up temp pdf'))
        }
      } else {
        // Standard Text / UTF-8
        text = buffer.toString('utf-8')
      }

      if (!text || text.trim().length === 0) {
        throw new Error('No readable text found in document')
      }

      return await ragService.addDocument(documentName, text)
    } catch (error) {
      logger.error({ err: error, document: documentName }, '[PDF Processor] Document processing failed')
      throw error
    }
  }
}
