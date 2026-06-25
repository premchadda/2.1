import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { auth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { executePaginatedQuery } from '../../utils/queryBuilder.js'

const router = express.Router()

/**
 * GET /api/current-affairs
 * Get current affairs with filters (daily, weekly, monthly)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { period = 'daily', category, page = 1, limit = 20 } = req.query

  // Build date filter based on period
  const now = new Date()
  let dateFilter = null

  if (period === 'daily') {
    dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  } else if (period === 'weekly') {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  } else if (period === 'monthly') {
    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }

  const filters = {}
  if (category) filters.category = category
  if (dateFilter) filters.date = { $gte: dateFilter }

  const allowedFields = ['category', 'date']

  const result = await executePaginatedQuery(
    dbHelpers,
    'current_affairs',
    ['id', 'title', 'content', 'category', 'date', 'language', 'created_at'],
    filters,
    allowedFields,
    { page, limit },
    { orderBy: 'date DESC' }
  )

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  })
}))

/**
 * GET /api/current-affairs/:id
 * Get single current affairs article
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await dbHelpers.query(
      `SELECT * FROM current_affairs WHERE id = $1 AND is_active = true`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/current-affairs/:id/quiz
 * Get quiz for current affairs article
 */
router.get('/:id/quiz', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await dbHelpers.query(
      `SELECT id, ca_id, questions, created_at FROM ca_quizzes 
       WHERE ca_id = $1 AND is_active = true LIMIT 1`,
      [id]
    )

    const quiz = result.rows[0]
    
    // SECURITY: Sanitize questions to remove correct answers before sending to client
    if (quiz.questions) {
      try {
        const questions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions
        if (Array.isArray(questions)) {
          quiz.questions = questions.map(q => {
            const { correctAnswer, correct_answer, explanation, ...safeQ } = q
            return safeQ
          })
        }
      } catch (e) {
        console.error('Error parsing CA Quiz questions:', e)
      }
    }

    res.json({ success: true, data: quiz })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/current-affairs/:id/quiz/attempt
 * Submit quiz answers (authenticated)
 */
router.post('/:id/quiz/attempt', auth, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { answers } = req.body

    // Get quiz questions
    const quizResult = await dbHelpers.query(
      `SELECT questions FROM ca_quizzes WHERE ca_id = $1`,
      [id]
    )

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Quiz not found' })
    }

    const questions = JSON.parse(quizResult.rows[0].questions)
    let correctCount = 0
    const questionResults = []

    questions.forEach((question, index) => {
      const isCorrect = answers[index] === question.correctAnswer
      if (isCorrect) correctCount++
      questionResults.push({
        questionId: question.id,
        isCorrect
      })
    })

    const percentage = (correctCount / questions.length) * 100

    // Save attempt
    const insertResult = await dbHelpers.query(
      `INSERT INTO ca_quiz_attempts (user_id, ca_id, answers, correct_count, percentage, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, correct_count, percentage`,
      [userId, id, JSON.stringify(answers), correctCount, percentage]
    )

    res.json({
      success: true,
      data: {
        attemptId: insertResult.rows[0].id,
        correctCount: insertResult.rows[0].correct_count,
        percentage: insertResult.rows[0].percentage,
        totalQuestions: questions.length,
        questionResults
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/current-affairs/categories
 * Get all CA categories
 */
router.get('/categories', async (req, res) => {
  try {
    const result = await dbHelpers.query(
      `SELECT DISTINCT category FROM current_affairs WHERE is_active = true ORDER BY category`
    )

    res.json({
      success: true,
      data: result.rows.map(r => r.category)
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
