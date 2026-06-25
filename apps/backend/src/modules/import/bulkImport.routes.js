import express from 'express'
import multer from 'multer'
import { protect, admin } from '../../middleware/auth.middleware.js'
import bulkImportService from './bulkImport.service.js'
import { importFullTest } from '../../services/import/fullTestImporter.js'

const router = express.Router()

function extractYear(json) {
  if (json.isPyq && json.pyqYear) return json.pyqYear;
  const seriesMatch = String(json.testSeriesId || "").match(/(\d{4})/);
  if (seriesMatch) return parseInt(seriesMatch[1], 10);
  const titleMatch = String(json.title || "").match(/(\d{4})/);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  return null;
}

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

router.get('/stats', protect, admin, async (req, res) => {
  try {
    const stats = await bulkImportService.getStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/formats', async (req, res) => {
  try {
    const formats = bulkImportService.getSupportedFormats()
    res.json({ success: true, data: formats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/template', async (req, res) => {
  try {
    const template = bulkImportService.getTemplate()
    res.json({ success: true, data: template })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/history', protect, admin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    const imports = await bulkImportService.getRecentImports(limit)
    res.json({ success: true, data: imports })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/history/:id', protect, admin, async (req, res) => {
  try {
    const importLog = await bulkImportService.getImportById(req.params.id)
    if (!importLog) {
      return res.status(404).json({ success: false, message: 'Import not found' })
    }
    res.json({ success: true, data: importLog })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/validate', protect, admin, importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const validation = await bulkImportService.validateFile(req.file.buffer, req.file.originalname)
    res.json({ success: true, data: validation })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/import', protect, admin, importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const config = {
      testId: req.body.testId || req.body.test_id || null,
      sectionId: req.body.sectionId || req.body.section_id || null,
      topicId: req.body.topicId || req.body.topic_id || null,
      seriesId: req.body.seriesId || req.body.series_id || null,
      marks: parseFloat(req.body.marks) || 1,
      negativeMarks: parseFloat(req.body.negativeMarks || req.body.negative_marks) || 0.25,
      difficulty: req.body.difficulty || 'medium',
      skipDuplicates: req.body.skipDuplicates !== false,
      fileName: req.file.originalname,
      userId: req.user.id,
    }

    const results = await bulkImportService.importFile(req.file.buffer, req.file.originalname, config)

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
    res.status(400).json({ success: false, message: error.message })
  }
})

// ─── Full-test JSON import ─────────────────────────────────────────────────────

const fullTestUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new Error('Only JSON files are accepted for full-test import'))
    }
    cb(null, true)
  },
})

const handleFullTestUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 50 MB.' })
    }
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` })
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message })
  }
  next()
}

router.post('/full-test/preview', protect, admin, fullTestUpload.single('file'), handleFullTestUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    let json
    try {
      json = JSON.parse(req.file.buffer.toString('utf8'))
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON file' })
    }

    // Auto-detect: array of questions vs full-test object
    const isArray = Array.isArray(json)
    const hasSections = !isArray && json.sections
    const hasQuestionArray = !isArray && json.questions && Array.isArray(json.questions)

    if (!hasSections && !hasQuestionArray && isArray) {
      return res.status(400).json({
        success: false,
        message: 'This appears to be a question-list JSON, not a full test. Use the standard question import endpoint.',
      })
    }

    if (!hasSections && !hasQuestionArray && !isArray) {
      return res.status(400).json({
        success: false,
        message: 'JSON must contain "sections" array (full test format) or "questions" array.',
      })
    }

    const result = await importFullTest(json, { dryRun: true, fileName: req.file.originalname, strict: req.body.strict === 'true' })

    res.json({
      success: true,
      data: {
        testTitle: result.testTitle,
        sectionsFound: (json.sections || []).length,
        questionsFound: (json.sections || []).reduce((sum, s) => sum + (s.questions || []).length, 0),
        warnings: result.warnings,
        errors: result.errors,
      },
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/full-test/import', protect, admin, fullTestUpload.single('file'), handleFullTestUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    let json
    try {
      json = JSON.parse(req.file.buffer.toString('utf8'))
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON file' })
    }

    const config = {
      userId: req.user.id,
      fileName: req.file.originalname,
      skipDuplicates: req.body.skipDuplicates !== false,
      dryRun: false,
      strict: req.body.strict === 'true',
    }

    const result = await importFullTest(json, config)

    // Move file to imported/ folder (after successful DB commit)
    const path = await import('path')
    const fs = await import('fs/promises')
    const uploadsDir = path.default.join(
      process.cwd(),
      'uploads', 'test-imports', 'imported',
      json.examCategoryId || '_uncategorized',
      String(json.examId || '_no-exam'),
      String(json.stageId || '_no-stage'),
      String(json.categoryId || '_no-category'),
      json.testType || '_no-type',
      String(json.testSeriesId || '_no-series'),
      String(extractYear(json) || '_no-year')
    )
    try {
      await fs.default.mkdir(uploadsDir, { recursive: true })
      await fs.default.writeFile(
        path.default.join(uploadsDir, req.file.originalname),
        req.file.buffer
      )
    } catch (fileErr) {
      // DB import succeeded; file save is best-effort
      result.warnings.push(`File save failed: ${fileErr.message}`)
    }

    res.json({
      success: true,
      message: `Imported test "${result.testTitle}" with ${result.questionsCreated} questions`,
      data: {
        testId: result.testId,
        testTitle: result.testTitle,
        sectionsCreated: result.sectionsCreated,
        questionsCreated: result.questionsCreated,
        questionsSkipped: result.questionsSkipped,
        warnings: result.warnings,
        errors: result.errors,
      },
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

export default router
