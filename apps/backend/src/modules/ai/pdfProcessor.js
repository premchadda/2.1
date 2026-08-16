import { ragService } from './rag.service.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

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
      // Basic text file / PDF format check
      const isPdf = buffer.slice(0, 4).toString() === '%PDF'

      if (isPdf) {
        // PDF text extraction using PyMuPDF4LLM
        const tempId = crypto.randomUUID()
        const tempPdfPath = path.join(os.tmpdir(), `${tempId}.pdf`)
        await fs.writeFile(tempPdfPath, buffer)

        try {
          const scriptPath = path.join(__dirname, 'extract_pdf.py')
          const { stdout } = await execFileAsync('python', [scriptPath, tempPdfPath], {
            maxBuffer: 50 * 1024 * 1024 // 50MB max output buffer
          })
          text = stdout
        } finally {
          // Cleanup
          await fs.unlink(tempPdfPath).catch(err => console.error('[PDF Processor] Failed to clean up temp pdf', err))
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
      console.error('[PDF Processor] Document processing failed:', error)
      throw error
    }
  }
}
