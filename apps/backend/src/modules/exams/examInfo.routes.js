import express from 'express'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { findEntityByIdentifier } from '../../shared/utils/identifier-utils.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';

const router = express.Router()

// @route   GET /api/exam-info
// @desc    Get all exam information
// @access  Public
router.get('/', responseCache('exam-info', 120), async (req, res) => {
  try {
    // Query the exams table directly with snake_case columns via raw query
    // to avoid toCamel transformation that loses snake_case fields
    const result = await pool.query(
      // Intentional SELECT * — the response spreads all exam columns (...e)
      // and adds camelCase aliases for frontend compatibility. Listing columns
      // here would silently drop fields the frontend depends on if the schema
      // gains columns in a later migration.
      'SELECT * FROM exams WHERE is_active = true OR is_active IS NULL ORDER BY display_order ASC, id ASC'
    )
    const exams = result.rows
    // Add camelCase aliases for frontend compatibility
    // Keep snake_case originals and add camelCase aliases
    const examsWithAliases = exams.map(e => ({
      ...e,
      categoryId: e.category_id,
      examId: e.exam_id,
      fullName: e.full_name,
      isActive: e.is_active,
      displayOrder: e.display_order,
    }))
    res.json({ success: true, count: examsWithAliases.length, data: examsWithAliases })
  } catch (error) {
    console.error('Error fetching exam info:', error)
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   POST /api/exam-info/report-error
// @desc    Submit a content-error report from the public exam page
// @access  Public
router.post('/report-error', async (req, res) => {
  const { examId, examTitle, year, category, details } = req.body || {}
  const reason = String(category || '').slice(0, 100)
  if (!reason) {
    return res.status(400).json({ success: false, message: 'Report category is required' })
  }
  try {
    await pool.query(
      'INSERT INTO question_reports (question_id, reason, notes, status) VALUES (0, $1, $2, $3)',
      [reason, JSON.stringify({ examId: examId ?? null, examTitle: examTitle ?? '', year: year ?? null, details: String(details || '').slice(0, 2000) }), 'open']
    )
    res.status(201).json({ success: true, message: 'Report submitted' })
  } catch (error) {
    console.error('POST /report-error error:', error.message)
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   GET /api/exam-info/:id
// @desc    Get exam information by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const exam = await findEntityByIdentifier(dbHelpers, 'exams', req.params.id, {
      slugFields: ['slug', 'exam_id']
    })
    if (!exam || !exam.isActive) {
      return res.status(404).json({ success: false, message: 'Exam information not found' })
    }
    res.json({ success: true, data: exam })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   GET /api/exam-info/category/:categoryId
// @desc    Get exam information by category
// @access  Public
router.get('/category/:categoryId', async (req, res) => {
  try {
    const exams = await dbHelpers.find('exams', {
      categoryId: req.params.categoryId,
      isActive: true
    })
    exams.sort((a, b) => (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0))
    res.json({ success: true, count: exams.length, data: exams })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})


// @route   GET /api/exam-info/:examId/updates
// @desc    Get latest updates for a specific exam
// @access  Public
router.get('/:examId/updates', async (req, res) => {
  try {
    const updates = await dbHelpers.find('exam_updates', {
      exam_id: req.params.examId,
      is_active: true
    }, { order: 'update_date DESC' })
    res.json({
      success: true,
      count: updates.length,
      data: updates.map(u => ({
        id: u.id,
        type: u.type,
        title: u.title,
        description: u.description,
        priority: u.priority,
        date: u.update_date
      }))
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   GET /api/exam-info/:examId/yearly-data
// @desc    Get yearly data (vacancy, cutoff, dates) for a specific exam
// @access  Public
router.get('/:examId/yearly-data', async (req, res) => {
  try {
    const yearlyData = await dbHelpers.find('exam_yearly_data', {
      exam_id: req.params.examId,
      is_active: true
    }, { order: 'year DESC' })
    const dataByYear = {}
    yearlyData.forEach(item => {
      dataByYear[item.year] = {
        notification: item.notification,
        notificationDate: item.notification_date,
        applicationStart: item.application_start,
        applicationEnd: item.application_end,
        tier1ExamDate: item.tier1_exam_date,
        tier2ExamDate: item.tier2_exam_date,
        vacancy: item.vacancy_total,
        vacancyBreakup: item.vacancy_breakup,
        cutoff: item.cutoff,
        syllabusChanges: item.syllabus_changes,
        patternChanges: item.pattern_changes,
        importantDates: item.important_dates,
        result: item.result_status
      }
    })
    res.json({ success: true, data: dataByYear, list: yearlyData })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
