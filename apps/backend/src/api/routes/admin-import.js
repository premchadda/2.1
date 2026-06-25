/**
 * Admin Import Routes
 *
 * Endpoints for importing external question banks (ClassX, etc.)
 * into the TrstPrep database.
 *
 * Routes:
 *   POST   /api/admin/import/classx          — Bulk import ClassX JSON
 *   POST   /api/admin/import/classx/preview   — Dry-run preview
 *   POST   /api/admin/import/classx/tests     — Import tests + questions
 *   GET    /api/admin/import/history          — Import audit log
 */

import express from 'express'
import multer from 'multer'
import { importClassXQuestions, importClassXTestsWithQuestions } from '../../services/import/classxImporter.js'
import { universalImport } from '../../services/import/enhancedImporter.js'
import { pool } from '../../infrastructure/database/postgres-helpers.js'
import { sendError } from '../../shared/utils/sendResponse.js'

const router = express.Router()

// File upload config: accept JSON, Excel, and CSV files up to 50MB
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
    const allowed = ['.json', '.xlsx', '.xls', '.csv']
    if (!allowed.includes(ext)) {
      return cb(new Error('Only JSON, Excel, or CSV files are accepted'))
    }
    cb(null, true)
  },
})

/**
 * Parse JSON from either request body or uploaded file.
 */
function parseImportData(req) {
  // If a file was uploaded, parse it
  if (req.file) {
    try {
      const data = JSON.parse(req.file.buffer.toString('utf-8'))
      return { data, fileName: req.file.originalname }
    } catch {
      throw new Error('Invalid JSON file')
    }
  }

  // Otherwise use request body
  if (req.body && (Array.isArray(req.body.questions) || Array.isArray(req.body))) {
    return {
      data: Array.isArray(req.body) ? req.body : req.body.questions,
      fileName: null,
    }
  }

  throw new Error('No import data provided. Send a JSON file or { questions: [...] } in the body.')
}

/**
 * POST /api/admin/import/classx
 * Bulk import ClassX JSON questions.
 *
 * Accepts either:
 *   - A JSON file upload (field name: "file")
 *   - JSON body: { questions: [...], config: { testId, sectionId, ... } }
 *   - JSON body: [ ...questions ]
 */
router.post('/import/classx', importUpload.single('file'), async (req, res) => {
  try {
    const { data, fileName } = parseImportData(req)
    const questions = Array.isArray(data) ? data : data.questions || []

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions found in import data',
      })
    }

    const config = {
      testId: req.body.testId || req.body.test_id || null,
      sectionId: req.body.sectionId || req.body.section_id || null,
      topicId: req.body.topicId || req.body.topic_id || null,
      marks: parseFloat(req.body.marks) || 1,
      negativeMarks: parseFloat(req.body.negativeMarks || req.body.negative_marks) || 0.25,
      difficulty: req.body.difficulty || 'medium',
      skipDuplicates: req.body.skipDuplicates !== false,
      fileName,
      userId: req.user?.id || null,
    }

    const results = await importClassXQuestions(questions, config)

    res.json({
      success: true,
      message: `Imported ${results.imported} of ${results.total} questions`,
      data: {
        total: results.total,
        imported: results.imported,
        skipped: results.skipped,
        duplicates: results.duplicates,
        failed: results.failed,
        errors: results.errors.slice(0, 20), // Return first 20 errors
      },
    })
  } catch (error) {
    sendError(res, error)
  }
})

/**
 * POST /api/admin/import/classx/preview
 * Dry-run preview: validate and map ClassX JSON without inserting.
 */
router.post('/import/classx/preview', importUpload.single('file'), async (req, res) => {
  try {
    const { data, fileName } = parseImportData(req)
    const questions = Array.isArray(data) ? data : data.questions || []

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions found in import data',
      })
    }

    const config = {
      testId: req.body.testId || req.body.test_id || null,
      sectionId: req.body.sectionId || req.body.section_id || null,
      topicId: req.body.topicId || req.body.topic_id || null,
      marks: parseFloat(req.body.marks) || 1,
      negativeMarks: parseFloat(req.body.negativeMarks || req.body.negative_marks) || 0.25,
      dryRun: true,
      fileName,
      userId: req.user?.id || null,
    }

    const results = await importClassXQuestions(questions, config)

    res.json({
      success: true,
      message: `Preview: ${results.imported} questions would be imported`,
      data: {
        total: results.total,
        wouldImport: results.imported,
        wouldSkip: results.skipped,
        preview: results.questions.slice(0, 10), // First 10 questions
        errors: results.errors.slice(0, 20),
      },
    })
  } catch (error) {
    sendError(res, error)
  }
})

/**
 * POST /api/admin/import/classx/tests
 * Import ClassX tests with their questions.
 *
 * Body: { tests: [...], questions: [...], config: { seriesId, ... } }
 */
router.post('/import/classx/tests', importUpload.single('file'), async (req, res) => {
  try {
    const { data, fileName } = parseImportData(req)
    const importData = Array.isArray(data) ? { questions: data } : data

    const config = {
      seriesId: req.body.seriesId || req.body.series_id || null,
      topicId: req.body.topicId || req.body.topic_id || null,
      duration: parseInt(req.body.duration) || 60,
      marks: parseFloat(req.body.marks) || 1,
      negativeMarks: parseFloat(req.body.negativeMarks || req.body.negative_marks) || 0.25,
      fileName,
      userId: req.user?.id || null,
    }

    const results = await importClassXTestsWithQuestions(importData, config)

    res.json({
      success: true,
      message: `Imported ${results.tests.imported} tests and ${results.questions.imported} questions`,
      data: {
        tests: {
          total: results.tests.total,
          imported: results.tests.imported,
          skipped: results.tests.skipped,
          errors: results.tests.errors.slice(0, 10),
        },
        questions: {
          total: results.questions.total,
          imported: results.questions.imported,
          skipped: results.questions.skipped,
          failed: results.questions.failed,
          errors: results.questions.errors.slice(0, 10),
        },
        testIdMap: results.testIdMap,
      },
    })
  } catch (error) {
    sendError(res, error)
  }
})

/**
 * GET /api/admin/import/history
 * View import audit log.
 */
router.get('/import/history', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
    const offset = Math.max(parseInt(req.query.offset) || 0, 0)

    const countResult = await pool.query('SELECT COUNT(*)::int AS c FROM import_logs')
    const total = countResult.rows[0]?.c || 0

    const result = await pool.query(
      `SELECT il.*, u.name AS imported_by_name
       FROM import_logs il
       LEFT JOIN users u ON il.imported_by = u.id
       ORDER BY il.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    res.json({
      success: true,
      data: result.rows,
      total,
      limit,
      offset,
    })
  } catch (error) {
    sendError(res, error)
  }
})

/**
 * GET /api/admin/import/history/:id
 * Get details of a specific import.
 */
router.get('/import/history/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT il.*, u.name AS imported_by_name
       FROM import_logs il
       LEFT JOIN users u ON il.imported_by = u.id
       WHERE il.id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Import log not found' })
    }

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    sendError(res, error)
  }
})

/**
 * POST /api/admin/import/universal
 * Universal import endpoint that accepts JSON, Excel, or CSV files.
 *
 * Auto-detects format and imports questions.
 * Body (multipart/form-data):
 *   - file: JSON, Excel, or CSV file
 *   - testId: Optional test ID to link questions to
 *   - sectionId: Optional section ID
 *   - topicId: Optional topic ID
 *   - skipDuplicates: Skip duplicate questions (default: true)
 */
router.post('/import/universal', importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      })
    }

    const config = {
      testId: req.body.testId || req.body.test_id || null,
      sectionId: req.body.sectionId || req.body.section_id || null,
      topicId: req.body.topicId || req.body.topic_id || null,
      marks: parseFloat(req.body.marks) || 1,
      negativeMarks: parseFloat(req.body.negativeMarks || req.body.negative_marks) || 0.25,
      difficulty: req.body.difficulty || 'medium',
      skipDuplicates: req.body.skipDuplicates !== false,
      fileName: req.file.originalname,
      userId: req.user?.id || null,
    }

    const results = await universalImport(req.file.buffer, req.file.originalname, config)

    res.json({
      success: true,
      message: `Imported ${results.imported} of ${results.total} questions`,
      data: {
        total: results.total,
        imported: results.imported,
        skipped: results.skipped,
        duplicates: results.duplicates,
        failed: results.failed,
        errors: results.errors.slice(0, 20),
      },
    })
  } catch (error) {
    sendError(res, error)
  }
})

export default router
