/**
 * Adaptive Testing Service
 *
 * AI-powered adaptive testing:
 * - Dynamic difficulty adjustment
 * - Personalized question selection
 * - Real-time performance tracking
 * - Adaptive scoring
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'
import adaptiveDifficultyService from '../ai/adaptiveDifficulty.js'

const adaptiveTestService = {
  /**
   * Create an adaptive test session.
   */
  async createSession(userId, config = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const session = {
        userId,
        totalQuestions: config.totalQuestions || 30,
        startingDifficulty: config.startingDifficulty || 'medium',
        currentDifficulty: config.startingDifficulty || 'medium',
        questionsAnswered: 0,
        correctCount: 0,
        wrongCount: 0,
        score: 0,
        questionHistory: [],
        difficultyHistory: [],
      }

      // Store session in metadata
      const result = await client.query(
        `INSERT INTO attempts (
          user_id, test_id, status, is_active, metadata, started_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'in_progress', true, $3, NOW(), NOW(), NOW()
        ) RETURNING id`,
        [userId, config.testId || null, JSON.stringify(session)]
      )

      return {
        sessionId: result.rows[0].id,
        ...session,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get next question based on current performance.
   */
  async getNextQuestion(sessionId, userId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const sessionResult = await client.query(
        `SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      )

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found')
      }

      const session = sessionResult.rows[0]
      const metadata = session.metadata || {}
      const answeredIds = metadata.questionHistory || []

      let targetDifficulty = metadata.currentDifficulty || 'medium'
      
      if (metadata.topicId) {
        try {
          const userDifficulty = await adaptiveDifficultyService.getDifficulty(userId, metadata.topicId)
          targetDifficulty = userDifficulty.level
        } catch (_err) {
          void _err;
        }
      }

      const difficultyOrder = ['easy', 'medium', 'hard', 'very_hard']
      const currentIdx = difficultyOrder.indexOf(targetDifficulty)
      const fallbackDifficulties = difficultyOrder.slice(Math.max(0, currentIdx), currentIdx + 2)

      let questions = await client.query(`
        SELECT q.id, q.question_text, q.options, q.marks, q.negative_marks,
               q.difficulty, q.question_type, q.topic_id, t.name as topic_name
        FROM questions q
        LEFT JOIN subject_topics t ON t.id = q.topic_id
        WHERE q.is_active = true
          AND q.difficulty = ANY($1)
          AND NOT (q.id = ANY($2))
        ORDER BY RANDOM()
        LIMIT 1
      `, [fallbackDifficulties, answeredIds])

      if (questions.rows.length === 0) {
        questions = await client.query(`
          SELECT q.id, q.question_text, q.options, q.marks, q.negative_marks,
                 q.difficulty, q.question_type, q.topic_id, t.name as topic_name
          FROM questions q
          LEFT JOIN subject_topics t ON t.id = q.topic_id
          WHERE q.is_active = true
            AND NOT (q.id = ANY($1))
          ORDER BY RANDOM()
          LIMIT 1
        `, [answeredIds])
      }

      if (questions.rows.length === 0) {
        return null
      }

      return {
        ...questions.rows[0],
        currentDifficulty: targetDifficulty,
        questionsAnswered: metadata.questionsAnswered || 0,
        totalQuestions: metadata.totalQuestions || 30,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Submit answer and adjust difficulty.
   */
  async submitAnswer(sessionId, userId, questionId, selectedOption, timeSpent) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      // Get session
      const sessionResult = await client.query(
        `SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      )

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found')
      }

      const session = sessionResult.rows[0]
      const metadata = session.metadata || {}

      // Get correct answer
      const question = await client.query(
        `SELECT id, question_text, question_text_hi, options, options_hi, correct_answer, correct_option, explanation, explanation_hi, marks, negative_marks, difficulty, question_type, category, sub_category_id, tags, status, is_active, is_practice, question_number, test_id, series_id, section_id, subject, subject_id, chapter_id, topic_id, topic, quiz_id, study_material_id, image_asset_id, image_url, passage_id, created_by, category_id, external_question_id, language, solution_image_url, source, imported_from, is_deleted, deleted_by, deleted_at, created_at, updated_at FROM questions WHERE id = $1`,
        [questionId]
      )

      if (question.rows.length === 0) {
        throw new Error('Question not found')
      }

      const correctOption = question.rows[0].correct_option
      const isCorrect = selectedOption === correctOption
      const marks = question.rows[0].marks || 1
      const negativeMarks = question.rows[0].negative_marks || 0.25

      // Update metadata
      metadata.questionsAnswered = (metadata.questionsAnswered || 0) + 1
      metadata.questionHistory = [...(metadata.questionHistory || []), questionId]
      metadata.difficultyHistory = [...(metadata.difficultyHistory || []), metadata.currentDifficulty]

      if (isCorrect) {
        metadata.correctCount = (metadata.correctCount || 0) + 1
        metadata.score = (metadata.score || 0) + marks
      } else {
        metadata.wrongCount = (metadata.wrongCount || 0) + 1
        metadata.score = (metadata.score || 0) - negativeMarks
      }

      let newDifficulty = metadata.currentDifficulty
      if (isCorrect && metadata.correctCount > metadata.wrongCount) {
        if (metadata.currentDifficulty === 'easy') newDifficulty = 'medium'
        else if (metadata.currentDifficulty === 'medium') newDifficulty = 'hard'
        else if (metadata.currentDifficulty === 'hard') newDifficulty = 'very_hard'
      } else if (!isCorrect && metadata.wrongCount > metadata.correctCount) {
        if (metadata.currentDifficulty === 'very_hard') newDifficulty = 'hard'
        else if (metadata.currentDifficulty === 'hard') newDifficulty = 'medium'
        else if (metadata.currentDifficulty === 'medium') newDifficulty = 'easy'
      }

      metadata.currentDifficulty = newDifficulty

      if (metadata.topicId) {
        try {
          await adaptiveDifficultyService.updatePerformance(userId, metadata.topicId, isCorrect, timeSpent)
        } catch (_err) {
          void _err;
        }
      }

      // Update session
      await client.query(
        `UPDATE attempts SET
          metadata = $1,
          score = $2,
          correct = $3,
          wrong = $4,
          updated_at = NOW()
         WHERE id = $5`,
        [
          JSON.stringify(metadata),
          Math.max(0, metadata.score),
          metadata.correctCount,
          metadata.wrongCount,
          sessionId,
        ]
      )

      await client.query('COMMIT')

      return {
        isCorrect,
        correctOption,
        marks: isCorrect ? marks : -negativeMarks,
        newDifficulty,
        score: metadata.score,
        questionsAnswered: metadata.questionsAnswered,
        totalQuestions: metadata.totalQuestions,
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Complete adaptive test session.
   */
  async completeSession(sessionId, userId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(
        `UPDATE attempts SET
          status = 'completed',
          is_completed = true,
          completed_at = NOW(),
          updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [sessionId, userId]
      )

      if (result.rows.length === 0) {
        throw new Error('Session not found')
      }

      const session = result.rows[0]
      const metadata = session.metadata || {}

      return {
        sessionId,
        score: metadata.score,
        correct: metadata.correctCount,
        wrong: metadata.wrongCount,
        totalQuestions: metadata.questionsAnswered,
        difficultyProgression: metadata.difficultyHistory,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get user's adaptive test history.
   */
  async getHistory(userId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const limit = options.limit || 20

      const result = await client.query(`
        SELECT
          a.id,
          a.metadata,
          a.score,
          a.correct,
          a.wrong,
          a.started_at,
          a.completed_at,
          t.title as test_title
        FROM attempts a
        LEFT JOIN tests t ON t.id = a.test_id
        WHERE a.user_id = $1
          AND a.metadata->>'totalQuestions' IS NOT NULL
        ORDER BY a.created_at DESC
        LIMIT $2
      `, [userId, limit])

      return result.rows.map(row => ({
        id: row.id,
        score: row.score,
        correct: row.correct,
        wrong: row.wrong,
        totalQuestions: row.metadata?.totalQuestions,
        difficultyProgression: row.metadata?.difficultyHistory,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        testTitle: row.test_title,
      }))
    } finally {
      client.release()
    }
  },
}

export default adaptiveTestService
