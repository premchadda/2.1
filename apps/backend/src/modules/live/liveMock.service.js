/**
 * Live Mock Infrastructure Service
 *
 * Manages live mock tests:
 * - Real-time test sessions
 * - Timer management
 * - Anti-cheat measures
 * - Live leaderboard
 * - Results publication
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'

const liveMockService = {
  /**
   * Create a live mock test session.
   */
  async createSession(data) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(
        `INSERT INTO live_tests (
          test_id, start_time, end_time, result_time,
          is_active, registration_open, max_participants,
          chat_enabled, is_all_india_mock, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          true, $5, $6,
          $7, $8, NOW(), NOW()
        ) RETURNING *`,
        [
          data.testId,
          data.startTime,
          data.endTime,
          data.resultTime || null,
          data.registrationOpen !== false,
          data.maxParticipants || 10000,
          data.chatEnabled !== false,
          data.isAllIndiaMock || false,
        ]
      )

      return result.rows[0]
    } finally {
      client.release()
    }
  },

  /**
   * Get upcoming live tests.
   */
  async getUpcoming(limit = 20) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT lt.*, t.title, t.total_questions, t.duration,
               ts.name as series_name
        FROM live_tests lt
        JOIN tests t ON t.id = lt.test_id
        LEFT JOIN test_series ts ON ts.id = t.series_id
        WHERE lt.is_active = true
          AND lt.start_time > NOW()
        ORDER BY lt.start_time ASC
        LIMIT $1
      `, [limit])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Get active live test.
   */
  async getActive() {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT lt.*, t.title, t.total_questions, t.duration
        FROM live_tests lt
        JOIN tests t ON t.id = lt.test_id
        WHERE lt.is_active = true
          AND lt.start_time <= NOW()
          AND lt.end_time > NOW()
        ORDER BY lt.start_time DESC
        LIMIT 1
      `)

      return result.rows[0] || null
    } finally {
      client.release()
    }
  },

  /**
   * Get live test details.
   */
  async getById(id) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT lt.*, t.title, t.total_questions, t.duration, t.instructions,
               ts.name as series_name
        FROM live_tests lt
        JOIN tests t ON t.id = lt.test_id
        LEFT JOIN test_series ts ON ts.id = t.series_id
        WHERE lt.id = $1
      `, [id])

      return result.rows[0] || null
    } finally {
      client.release()
    }
  },

  /**
   * Register user for live test.
   */
  async register(userId, liveTestId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      // Check if already registered
      const existing = await client.query(
        `SELECT id FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_active = true`,
        [userId, liveTestId]
      )

      if (existing.rows.length > 0) {
        return { action: 'already_registered' }
      }

      // Check capacity
      const session = await this.getById(liveTestId)
      if (!session) throw new Error('Live test not found')

      const participantCount = await client.query(
        `SELECT COUNT(*) as count FROM attempts WHERE test_id = $1 AND is_active = true`,
        [session.test_id]
      )

      if (participantCount.rows[0].count >= session.max_participants) {
        throw new Error('Live test is full')
      }

      // Create attempt
      const result = await client.query(
        `INSERT INTO attempts (
          user_id, test_id, status, is_active, started_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'registered', true, NOW(), NOW(), NOW()
        ) RETURNING id`,
        [userId, session.test_id]
      )

      return { action: 'registered', attemptId: result.rows[0].id }
    } finally {
      client.release()
    }
  },

  /**
   * Start live test attempt.
   */
  async startAttempt(userId, liveTestId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const session = await this.getById(liveTestId)
      if (!session) throw new Error('Live test not found')

      // Check if test has started
      if (new Date(session.start_time) > new Date()) {
        throw new Error('Live test has not started yet')
      }

      // Get or create attempt
      let attempt = await client.query(
        `SELECT * FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_active = true`,
        [userId, session.test_id]
      )

      if (attempt.rows.length === 0) {
        // Auto-register and start
        const regResult = await this.register(userId, liveTestId)
        attempt = await client.query(
          `SELECT * FROM attempts WHERE id = $1`,
          [regResult.attemptId]
        )
      }

      // Update status to in_progress
      await client.query(
        `UPDATE attempts SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [attempt.rows[0].id]
      )

      // Get questions
      const questions = await client.query(`
        SELECT q.id, q.question_text, q.options, q.marks, q.negative_marks,
               q.difficulty, q.question_type
        FROM test_questions tq
        JOIN questions q ON q.id = tq.question_id
        WHERE tq.test_id = $1
        ORDER BY tq.question_number
      `, [session.test_id])

      return {
        attemptId: attempt.rows[0].id,
        questions: questions.rows,
        duration: session.duration,
        startTime: session.start_time,
        endTime: session.end_time,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get live leaderboard.
   */
  async getLeaderboard(liveTestId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          a.user_id,
          u.name as user_name,
          u.avatar_url,
          a.score,
          a.total_marks,
          CASE WHEN a.total_marks > 0
            THEN ROUND(a.score / a.total_marks * 100, 2)
            ELSE 0
          END as percentage,
          a.correct,
          a.wrong,
          a.time_spent,
          RANK() OVER (ORDER BY a.score DESC, a.time_spent ASC) as rank
        FROM attempts a
        JOIN users u ON u.id = a.user_id
        WHERE a.test_id = $1
          AND a.is_active = true
          AND a.status = 'completed'
        ORDER BY a.score DESC, a.time_spent ASC
        LIMIT 100
      `, [liveTestId])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Submit live test attempt.
   */
  async submitAttempt(userId, liveTestId, answers) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const session = await this.getById(liveTestId)
      if (!session) throw new Error('Live test not found')

      // Get attempt
      const attempt = await client.query(
        `SELECT * FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_active = true`,
        [userId, session.test_id]
      )

      if (attempt.rows.length === 0) {
        throw new Error('No active attempt found')
      }

      // Get correct answers
      const questions = await client.query(
        `SELECT q.id, q.correct_option, q.marks, q.negative_marks
         FROM test_questions tq
         JOIN questions q ON q.id = tq.question_id
         WHERE tq.test_id = $1`,
        [session.test_id]
      )

      // Calculate score
      let score = 0
      let correct = 0
      let wrong = 0
      let skipped = 0

      for (const question of questions.rows) {
        const userAnswer = answers[question.id]
        if (userAnswer === undefined || userAnswer === null) {
          skipped++
        } else if (userAnswer === question.correct_option) {
          score += question.marks || 1
          correct++
        } else {
          score -= question.negative_marks || 0.25
          wrong++
        }
      }

      // Update attempt
      await client.query(
        `UPDATE attempts SET
          status = 'completed',
          score = $1,
          correct = $2,
          wrong = $3,
          unattempted = $4,
          time_spent = EXTRACT(EPOCH FROM (NOW() - started_at)),
          completed_at = NOW(),
          updated_at = NOW()
         WHERE id = $5`,
        [Math.max(0, score), correct, wrong, skipped, attempt.rows[0].id]
      )

      return {
        attemptId: attempt.rows[0].id,
        score: Math.max(0, score),
        correct,
        wrong,
        skipped,
        totalMarks: questions.rows.reduce((sum, q) => sum + (q.marks || 1), 0),
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get live test results.
   */
  async getResults(userId, liveTestId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          a.*,
          t.title as test_title,
          lt.result_time,
          RANK() OVER (ORDER BY a.score DESC, a.time_spent ASC) as rank,
          COUNT(*) OVER () as total_participants
        FROM attempts a
        JOIN tests t ON t.id = a.test_id
        JOIN live_tests lt ON lt.test_id = a.test_id
        WHERE a.user_id = $1
          AND a.test_id = $2
          AND a.is_active = true
      `, [userId, liveTestId])

      return result.rows[0] || null
    } finally {
      client.release()
    }
  },
}

export default liveMockService
