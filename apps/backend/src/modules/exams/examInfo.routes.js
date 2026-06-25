import express from 'express'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { findEntityByIdentifier } from '../../shared/utils/identifier-utils.js'

const router = express.Router()

// @route   GET /api/exam-info
// @desc    Get all exam information
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Query the exams table directly with snake_case columns via raw query
    // to avoid toCamel transformation that loses snake_case fields
    const result = await pool.query(
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
    res.status(500).json({ success: false, message: error.message })
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
    res.status(500).json({ success: false, message: error.message })
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
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/exams/category/:categoryId
// @desc    Get category with exams by category ID (alternate route for frontend)
// @access  Public
router.get('/../exams/category/:categoryId', async (req, res) => {
  try {
    const categoryId = req.params.categoryId
    const categories = await dbHelpers.find('examCategories', {
      id: categoryId,
      isActive: true
    })
    if (categories.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' })
    }
    const category = categories[0]
    const exams = await dbHelpers.find('exams', {
      categoryId,
      isActive: true
    })
    exams.sort((a, b) => (a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0))
    res.json({
      success: true,
      data: {
        ...category,
        exams: exams.map(exam => ({
          id: exam.examId,
          examId: exam.examId,
          title: exam.title,
          fullName: exam.fullName,
          description: exam.description,
          desc: exam.description,
          notification: exam.notification,
          eligibility: exam.eligibility,
          ageLimit: exam.ageLimit,
          syllabus: exam.syllabus,
          seriesId: exam.seriesId,
          isActive: exam.isActive
        }))
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
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
    res.status(500).json({ success: false, message: error.message })
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
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
