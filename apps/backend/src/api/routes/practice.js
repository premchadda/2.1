import express from 'express'
import { auth } from '../../middleware/auth.middleware.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { executePaginatedQuery } from '../../utils/queryBuilder.js'
import { emitDomainEvent } from '../../infrastructure/events/eventBus.js'

const router = express.Router()

const publishEvent = async (eventName, payload) => {
  try {
    await emitDomainEvent(eventName, payload)
  } catch (error) {
    console.error(`[EventBus] Failed to publish "${eventName}":`, error.message)
  }
}

/**
 * GET /api/practice/questions
 * Get practice questions with filters
 */
router.get('/questions', asyncHandler(async (req, res) => {
  const { subject, topic, difficulty, page = 1, limit = 20 } = req.query

  const filters = { subject, topic, difficulty }
  const allowedFields = ['subject', 'topic', 'difficulty']

  const result = await executePaginatedQuery(
    global.dbHelpers,
    'practice_questions',
    ['id', 'question_text', 'options', 'subject', 'topic', 'difficulty', 'language'],
    filters,
    allowedFields,
    { page, limit }
  )

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  })
}))

/**
 * GET /api/practice/questions/:id
 * Get single practice question with solution
 */
router.get('/questions/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await global.dbHelpers.query(
      `SELECT id, question_text, options, subject, topic, difficulty, language, explanation FROM practice_questions WHERE id = $1 AND is_active = true`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Question not found' })
    }

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/practice/answer
 * Submit practice question answer (authenticated)
 */
router.post('/answer', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { questionId, selectedAnswer, timeSpent } = req.body

    // Get question
    const questionResult = await global.dbHelpers.query(
      `SELECT correct_answer, difficulty FROM practice_questions WHERE id = $1`,
      [questionId]
    )

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Question not found' })
    }

    const isCorrect = selectedAnswer === questionResult.rows[0].correct_answer

    // Save answer
    const result = await global.dbHelpers.query(
      `INSERT INTO practice_answers (user_id, question_id, selected_answer, is_correct, time_spent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, is_correct, time_spent`,
      [userId, questionId, selectedAnswer, isCorrect, timeSpent]
    )

    // Get user's accuracy for this topic
    const topicResult = await global.dbHelpers.query(
      `SELECT pq.topic, COUNT(*) as total, SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END) as correct
       FROM practice_answers pa
       JOIN practice_questions pq ON pa.question_id = pq.id
       WHERE pa.user_id = $1 AND pq.topic = (SELECT topic FROM practice_questions WHERE id = $2)
       GROUP BY pq.topic`,
      [userId, questionId]
    )

    await publishEvent('question_answered', {
      source: 'practice',
      userId,
      questionId: Number(questionId),
      isCorrect,
      timeSpent: Number(timeSpent) || 0
    })

    res.json({
      success: true,
      data: {
        answerId: result.rows[0].id,
        isCorrect: result.rows[0].is_correct,
        timeTaken: result.rows[0].time_spent,
        topicAccuracy: topicResult.rows.length > 0 ? 
          ((topicResult.rows[0].correct / topicResult.rows[0].total) * 100).toFixed(2) : 0
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/practice/history
 * Get user's practice history (authenticated)
 */
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 50 } = req.query

    const result = await global.dbHelpers.query(
      `SELECT pa.id, pa.question_id, pa.selected_answer, pa.is_correct, 
              pa.time_spent, pa.created_at, pq.question_text, pq.subject, pq.topic
       FROM practice_answers pa
       JOIN practice_questions pq ON pa.question_id = pq.id
       WHERE pa.user_id = $1
       ORDER BY pa.created_at DESC
       LIMIT $2`,
      [userId, limit]
    )

    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/practice/stats
 * Get practice statistics (authenticated)
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id

    // Overall stats
    const overallStats = await global.dbHelpers.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
              AVG(CASE WHEN is_correct THEN 100 ELSE 0 END) as accuracy,
              AVG(time_spent) as avg_time
       FROM practice_answers WHERE user_id = $1`,
      [userId]
    )

    // Topic-wise stats
    const topicStats = await global.dbHelpers.query(
      `SELECT pq.topic, 
              COUNT(*) as attempts,
              SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END) as correct,
              (SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) * 100) as accuracy
       FROM practice_answers pa
       JOIN practice_questions pq ON pa.question_id = pq.id
       WHERE pa.user_id = $1
       GROUP BY pq.topic
       ORDER BY accuracy DESC`,
      [userId]
    )

    res.json({
      success: true,
      data: {
        overall: overallStats.rows[0],
        byTopic: topicStats.rows
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
