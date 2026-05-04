import { pool } from '../../infrastructure/database/postgres-helpers.js'
import { idsMatch } from './common.js'

const VALID_ATTEMPT_STATUSES = ['not_started', 'in_progress', 'paused', 'completed', 'submitted']
const MAX_INACTIVE_SECONDS = 3600 // 1 hour max pause

export class TestAttemptController {
  constructor(dbHelpers = pool) {
    this.db = dbHelpers
  }

  async createAttempt(userId, testId, options = {}) {
    const { testSeriesId, source } = options
    
    const testRes = await this.db.query('SELECT * FROM tests WHERE id = $1', [testId])
    if (testRes.rows.length === 0) {
      throw new Error('Test not found')
    }
    const test = testRes.rows[0]
    
    const existingAttempt = await this.db.query(`
      SELECT * FROM attempts 
      WHERE user_id = $1 AND test_id = $2 
      AND status IN ('in_progress', 'paused', 'not_started')
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, testId])
    
    if (existingAttempt.rows.length > 0) {
      throw new Error('Active attempt already exists for this test')
    }
    
    const attemptNumberRes = await this.db.query(`
      SELECT COUNT(*)::int as num FROM attempts 
      WHERE user_id = $1 AND test_id = $2
    `, [userId, testId])
    const attemptNumber = (attemptNumberRes.rows[0]?.num || 0) + 1
    
    const insertRes = await this.db.query(`
      INSERT INTO attempts (
        user_id, test_id, series_id, test_title, 
        status, attempt_number, is_reattempt, parent_attempt_id,
        started_at, time_limit_seconds, total_questions, total_marks,
        negative_marking, passing_marks, language, created_at
      ) VALUES ($1, $2, $3, $4, 'not_started', $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
    `, [
      userId, testId, testSeriesId, test.title || test.name,
      attemptNumber, 
      options.isReattempt || false,
      options.parentAttemptId || null,
      test.duration_minutes ? test.duration_minutes * 60 : (test.time_limit || 3600),
      test.total_questions || 0,
      test.total_marks || 0,
      test.negative_marking || 0.25,
      test.passing_marks || 0,
      test.language || 'en'
    ])
    
    const attempt = insertRes.rows[0]
    
    await this.initializeQuestionStates(attempt.id, testId)
    
    return {
      success: true,
      attemptId: attempt.id,
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      timeLimit: attempt.time_limit_seconds,
      questionsInitialized: true
    }
  }

  async initializeQuestionStates(attemptId, testId) {
    const questionsRes = await this.db.query(`
      SELECT q.id, tq.order_index, tq.marks, tq.negative_marks
      FROM test_questions tq
      JOIN questions q ON q.id = tq.question_id
      WHERE tq.test_id = $1
      ORDER BY tq.order_index
    `, [testId])
    
    for (const q of questionsRes.rows) {
      await this.db.query(`
        INSERT INTO question_attempts (attempt_id, question_id, order_index, status, created_at)
        VALUES ($1, $2, $3, 'not_visited', NOW())
        ON CONFLICT DO NOTHING
      `, [attemptId, q.id, q.order_index])
    }
  }

  async startAttempt(attemptId, userId) {
    const attempt = await this.getAttempt(attemptId, userId)
    if (!attempt) throw new Error('Attempt not found')
    
    if (attempt.status !== 'not_started') {
      throw new Error('Attempt already started')
    }
    
    await this.db.query(`
      UPDATE attempts SET 
        status = 'in_progress',
        started_at = NOW(),
        last_activity = NOW()
      WHERE id = $1
    `, [attemptId])
    
    return { success: true, status: 'in_progress', startedAt: new Date() }
  }

  async saveAnswer(attemptId, userId, data) {
    const { questionId, selectedOption, timeSpent, currentSection, markedForReview } = data
    
    const attempt = await this.validateActiveAttempt(attemptId, userId)
    
    await this.updateQuestionState(attemptId, questionId, {
      selectedOption,
      timeSpent,
      markedForReview,
      status: selectedOption !== null ? 'answered' : 'visited'
    })
    
    await this.db.query(`
      UPDATE attempts SET 
        last_activity = NOW(),
        last_question_id = $1
      WHERE id = $2
    `, [questionId, attemptId])
    
    return { success: true, savedAt: new Date() }
  }

  async updateQuestionState(attemptId, questionId, updates) {
    const setClauses = []
    const values = []
    let paramIdx = 1
    
    if (updates.selectedOption !== undefined) {
      setClauses.push(`selected_option = $${paramIdx++}`)
      values.push(updates.selectedOption)
    }
    if (updates.timeSpent !== undefined) {
      setClauses.push(`time_spent_seconds = $${paramIdx++}`)
      values.push(updates.timeSpent)
    }
    if (updates.markedForReview !== undefined) {
      setClauses.push(`is_marked_for_review = $${paramIdx++}`)
      values.push(updates.markedForReview)
    }
    if (updates.status) {
      setClauses.push(`status = $${paramIdx++}`)
      values.push(updates.status)
    }
    
    setClauses.push(`last_viewed_at = NOW()`)
    
    if (setClauses.length === 1) return
    
    values.push(attemptId, questionId)
    
    await this.db.query(`
      UPDATE question_attempts SET ${setClauses.join(', ')}
      WHERE attempt_id = $${paramIdx++} AND question_id = $${paramIdx}
    `, values)
  }

  async validateActiveAttempt(attemptId, userId) {
    const attempt = await this.getAttempt(attemptId, userId)
    if (!attempt) throw new Error('Attempt not found')
    
    if (!['in_progress', 'paused'].includes(attempt.status)) {
      throw new Error(`Cannot modify attempt with status: ${attempt.status}`)
    }
    
    const lastActivity = new Date(attempt.last_activity || attempt.started_at)
    const inactiveSeconds = Math.floor((Date.now() - lastActivity) / 1000)
    
    if (inactiveSeconds > MAX_INACTIVE_SECONDS) {
      await this.db.query(`UPDATE attempts SET status = 'paused' WHERE id = $1`, [attemptId])
      throw new Error('Session expired due to inactivity')
    }
    
    return attempt
  }

  async getAttempt(attemptId, userId) {
    const res = await this.db.query(`
      SELECT * FROM attempts WHERE id = $1 AND (user_id = $2 OR user_id = $2::text)
    `, [attemptId, userId])
    return res.rows[0] || null
  }

  async submitAttempt(attemptId, userId, finalData = {}) {
    const attempt = await this.validateActiveAttempt(attemptId, userId)
    
    const questionStates = await this.db.query(`
      SELECT * FROM question_attempts WHERE attempt_id = $1
    `, [attemptId])
    
    const answered = questionStates.rows.filter(q => q.selected_option !== null)
    const marked = questionStates.rows.filter(q => q.is_marked_for_review)
    
    let correct = 0, wrong = 0, unattempted = 0, totalMarks = 0
    
    for (const qState of questionStates.rows) {
      const qRes = await this.db.query('SELECT * FROM questions WHERE id = $1', [qState.question_id])
      if (qRes.rows.length === 0) continue
      
      const question = qRes.rows[0]
      const isCorrect = qState.selected_option === question.correct_option
      
      if (qState.selected_option === null) {
        unattempted++
      } else if (isCorrect) {
        correct++
        totalMarks += question.marks || 1
      } else {
        wrong++
        totalMarks -= (question.negative_marks || 0.25)
      }
    }
    
    const totalAttempted = correct + wrong
    const accuracy = totalAttempted > 0 ? Math.round((correct / totalAttempted) * 100) : 0
    const percentage = attempt.total_marks > 0 ? Math.round((totalMarks / attempt.total_marks) * 100) : 0
    
    const passed = totalMarks >= (attempt.passing_marks || 0)
    
    await this.db.query(`
      UPDATE attempts SET 
        status = 'completed',
        submitted_at = NOW(),
        score = $1,
        total_marks = $2,
        percentage = $3,
        accuracy = $4,
        correct_count = $5,
        wrong_count = $6,
        unattempted_count = $7,
        last_activity = NOW()
      WHERE id = $8
    `, [totalMarks, attempt.total_marks, percentage, accuracy, correct, wrong, unattempted, attemptId])
    
    return {
      success: true,
      status: 'completed',
      score: totalMarks,
      percentage,
      accuracy,
      correct,
      wrong,
      unattempted,
      passed
    }
  }

  async getQuestionStates(attemptId) {
    const res = await this.db.query(`
      SELECT qa.*, q.question, q.correct_option, q.marks, q.negative_marks
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      WHERE qa.attempt_id = $1
      ORDER BY qa.order_index
    `, [attemptId])
    return res.rows
  }

  async getAnalytics(attemptId) {
    const attempt = await this.db.query('SELECT * FROM attempts WHERE id = $1', [attemptId])
    if (!attempt.rows[0]) return null
    
    const questionStats = await this.db.query(`
      SELECT 
        status,
        COUNT(*)::int as count,
        SUM(time_spent_seconds)::int as total_time,
        AVG(time_spent_seconds)::int as avg_time
      FROM question_attempts
      WHERE attempt_id = $1
      GROUP BY status
    `, [attemptId])
    
    const topicStats = await this.db.query(`
      SELECT 
        t.name as topic_name,
        s.name as subject_name,
        COUNT(*)::int as attempted,
        SUM(CASE WHEN qa.selected_option = q.correct_option THEN 1 ELSE 0 END)::int as correct
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      LEFT JOIN topics t ON t.id = q.topic_id
      LEFT JOIN subjects s ON s.id = q.subject
      WHERE qa.attempt_id = $1 AND qa.selected_option IS NOT NULL
      GROUP BY t.name, s.name
    `, [attemptId])
    
    return {
      questionStats: questionStats.rows,
      topicStats: topicStats.rows.map(t => ({
        ...t,
        accuracy: t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0
      }))
    }
  }
}

export const testAttemptController = new TestAttemptController(pool)
export default TestAttemptController