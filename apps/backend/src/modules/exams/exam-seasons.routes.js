import express from 'express'
import { pool } from '../../infrastructure/database/postgres-helpers.js'
import { findEntityByIdentifier } from '../../shared/utils/identifier-utils.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

// @route   GET /api/exam-seasons
// @desc    Get all exam seasons with exam details
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { year, exam_id, category_id } = req.query
    
    let query = `
      SELECT 
        es.id,
        es.exam_id,
        es.season_slug,
        es.year,
        es.title,
        es.notification_date,
        es.application_start_date,
        es.application_end_date,
        es.exam_date,
        es.result_date,
        es.vacancy_total,
        es.status,
        es.is_active,
        e.title as exam_title,
        e.exam_id as exam_code,
        e.category_id,
        ec.name as category_name
      FROM exam_seasons es
      JOIN exams e ON es.exam_id = e.id
      LEFT JOIN exam_categories ec ON e.category_id = ec.category_id
      WHERE es.is_active = true
    `
    
    const params = []
    if (year) {
      params.push(year)
      query += ` AND es.year = $${params.length}`
    }
    if (exam_id) {
      params.push(exam_id)
      query += ` AND es.exam_id = $${params.length}`
    }
    if (category_id) {
      params.push(category_id)
      query += ` AND e.category_id = $${params.length}`
    }
    
    query += ' ORDER BY es.year DESC, e.title'
    
    const result = await pool.query(query, params)
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching exam seasons:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

// @route   GET /api/exam-seasons/:id
// @desc    Get single exam season by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const query = `
      SELECT 
        es.*,
        e.title as exam_title,
        e.exam_id as exam_code,
        e.category_id,
        ec.name as category_name
      FROM exam_seasons es
      JOIN exams e ON es.exam_id = e.id
      LEFT JOIN exam_categories ec ON e.category_id = ec.category_id
      WHERE es.id = $1 AND es.is_active = true
    `
    
    const result = await pool.query(query, [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam season not found'
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error fetching exam season:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

// @route   GET /api/exam-seasons/slug/:slug
// @desc    Get exam season by slug (e.g., 'ssc-cgl-2026')
// @access  Public
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    
    const query = `
      SELECT 
        es.*,
        e.title as exam_title,
        e.exam_id as exam_code,
        e.category_id,
        ec.name as category_name
      FROM exam_seasons es
      JOIN exams e ON es.exam_id = e.id
      LEFT JOIN exam_categories ec ON e.category_id = ec.category_id
      WHERE es.season_slug = $1 AND es.is_active = true
    `
    
    const result = await pool.query(query, [slug])
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam season not found'
      })
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error fetching exam season by slug:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

// @route   GET /api/exam-seasons/exam/:examId
// @desc    Get all seasons for a specific exam
// @access  Public
router.get('/exam/:examId', async (req, res) => {
  try {
    const { examId } = req.params
    
    const query = `
      SELECT 
        es.*,
        e.title as exam_title,
        e.exam_id as exam_code
      FROM exam_seasons es
      JOIN exams e ON es.exam_id = e.id
      WHERE (es.exam_id = $1 OR e.exam_id = $2 OR e.slug = $3) AND es.is_active = true
      ORDER BY es.year DESC
    `
    
    const result = await pool.query(query, [examId, examId, examId])
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching exam seasons:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error)
    })
  }
})

export default router