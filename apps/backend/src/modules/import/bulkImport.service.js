/**
 * Bulk Import Service
 *
 * Provides endpoints and utilities for the bulk import UI:
 * - File upload with progress tracking
 * - Import validation and preview
 * - Import history and status
 * - Template-based imports
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'
import { universalImport } from '../../services/import/enhancedImporter.js'

const bulkImportService = {
  /**
   * Get import statistics.
   */
  async getStats() {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          source,
          COUNT(*) as total_imports,
          SUM(total_records) as total_records,
          SUM(imported) as total_imported,
          SUM(skipped) as total_skipped,
          SUM(failed) as total_failed,
          MAX(created_at) as last_import
        FROM import_logs
        GROUP BY source
        ORDER BY last_import DESC
      `)

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Get recent imports.
   */
  async getRecentImports(limit = 20) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT il.*, u.name as imported_by_name
        FROM import_logs il
        LEFT JOIN users u ON il.imported_by = u.id
        ORDER BY il.created_at DESC
        LIMIT $1
      `, [limit])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Get import details by ID.
   */
  async getImportById(id) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT il.*, u.name as imported_by_name
        FROM import_logs il
        LEFT JOIN users u ON il.imported_by = u.id
        WHERE il.id = $1
      `, [id])

      return result.rows[0] || null
    } finally {
      client.release()
    }
  },

  /**
   * Validate import file before actual import.
   */
  async validateFile(fileBuffer, filename) {
    const { detectFormat, normalizeToClassX, parseExcelData, parseCSVData } = await import('../../services/import/enhancedImporter.js')

    let data
    let format

    if (filename.endsWith('.json')) {
      data = JSON.parse(fileBuffer.toString('utf-8'))
      format = detectFormat(filename, data)
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      data = await parseExcelData(fileBuffer, filename)
      format = 'excel'
    } else if (filename.endsWith('.csv')) {
      data = parseCSVData(fileBuffer.toString('utf-8'))
      format = 'csv'
    } else {
      throw new Error('Unsupported file format')
    }

    const rows = normalizeToClassX(data, format)

    return {
      format,
      totalRows: rows.length,
      sampleRows: rows.slice(0, 5),
      validation: this.validateRows(rows),
    }
  },

  /**
   * Validate a batch of rows.
   */
  validateRows(rows) {
    const errors = []
    let validCount = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowErrors = []

      if (!row.question && !row.question_text) {
        rowErrors.push('Missing question text')
      }

      const options = [
        row.option_1,
        row.option_2,
        row.option_3,
        row.option_4,
      ].filter(o => o && String(o).trim())

      if (options.length < 2) {
        rowErrors.push('At least 2 options required')
      }

      if (!row.answer && row.correct_option === undefined) {
        rowErrors.push('Missing correct answer')
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: i + 1,
          errors: rowErrors,
        })
      } else {
        validCount++
      }
    }

    return {
      total: rows.length,
      valid: validCount,
      invalid: rows.length - validCount,
      errors: errors.slice(0, 100),
    }
  },

  /**
   * Import questions from file buffer.
   */
  async importFile(fileBuffer, filename, config = {}) {
    return universalImport(fileBuffer, filename, config)
  },

  /**
   * Get supported file formats.
   */
  getSupportedFormats() {
    return [
      {
        extension: '.json',
        name: 'JSON',
        description: 'ClassX or custom JSON format',
        mimeTypes: ['application/json'],
      },
      {
        extension: '.xlsx',
        name: 'Excel',
        description: 'Excel spreadsheet (.xlsx)',
        mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      },
      {
        extension: '.xls',
        name: 'Excel (Legacy)',
        description: 'Legacy Excel format (.xls)',
        mimeTypes: ['application/vnd.ms-excel'],
      },
      {
        extension: '.csv',
        name: 'CSV',
        description: 'Comma-separated values',
        mimeTypes: ['text/csv'],
      },
    ]
  },

  /**
   * Get import template for Excel/CSV.
   */
  getTemplate() {
    return {
      headers: [
        'question',
        'option_1',
        'option_2',
        'option_3',
        'option_4',
        'answer',
        'explanation',
        'difficulty',
        'marks',
        'negative_marks',
        'subject',
        'topic',
      ],
      sampleRows: [
        {
          question: 'What is 2 + 2?',
          option_1: '3',
          option_2: '4',
          option_3: '5',
          option_4: '6',
          answer: '2',
          explanation: '2 + 2 = 4',
          difficulty: 'easy',
          marks: 1,
          negative_marks: 0.25,
          subject: 'Mathematics',
          topic: 'Basic Arithmetic',
        },
      ],
    }
  },
}

export default bulkImportService
