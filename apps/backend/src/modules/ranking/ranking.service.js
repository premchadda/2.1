/**
 * National Ranking System Service
 *
 * Provides ranking across all users:
 * - Overall ranking
 * - Subject-wise ranking
 * - Exam-specific ranking
 * - Rank history
 * - Percentile calculation
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'

const rankingService = {
  /**
   * Get overall national ranking.
   */
  async getOverallRanking(options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const limit = options.limit || 100
      const offset = options.offset || 0

      const result = await client.query(`
        SELECT
          u.id as user_id,
          u.name,
          u.avatar_url,
          COUNT(DISTINCT a.id) as total_tests,
          AVG(CASE WHEN a.total_marks > 0
            THEN a.score / a.total_marks * 100
            ELSE 0
          END) as avg_percentage,
          SUM(a.score) as total_score,
          RANK() OVER (ORDER BY SUM(a.score) DESC) as rank
        FROM users u
        JOIN attempts a ON a.user_id = u.id
        WHERE a.is_completed = true
          AND a.is_active = true
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY total_score DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Get user's overall rank.
   */
  async getUserRank(userId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        WITH user_scores AS (
          SELECT
            u.id as user_id,
            SUM(a.score) as total_score,
            COUNT(DISTINCT a.id) as total_tests,
            AVG(CASE WHEN a.total_marks > 0
              THEN a.score / a.total_marks * 100
              ELSE 0
            END) as avg_percentage
          FROM users u
          JOIN attempts a ON a.user_id = u.id
          WHERE a.is_completed = true
            AND a.is_active = true
          GROUP BY u.id
        ),
        ranked_users AS (
          SELECT
            user_id,
            total_score,
            total_tests,
            avg_percentage,
            RANK() OVER (ORDER BY total_score DESC) as rank,
            COUNT(*) OVER () as total_users
          FROM user_scores
        )
        SELECT user_id, total_score, total_tests, avg_percentage, rank, total_users
        FROM ranked_users WHERE user_id = $1
      `, [userId])

      return result.rows[0] || null
    } finally {
      client.release()
    }
  },

  /**
   * Get subject-wise ranking.
   */
  async getSubjectRanking(subjectId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const limit = options.limit || 100

      const result = await client.query(`
        SELECT
          u.id as user_id,
          u.name,
          u.avatar_url,
          COUNT(DISTINCT COALESCE(uts.topic_id, t.id)) as topics_attempted,
          SUM(uts.total_attempts) as total_questions,
          SUM(uts.correct_answers) as correct_answers,
          CASE
            WHEN SUM(uts.total_attempts) > 0
            THEN ROUND(SUM(uts.correct_answers)::numeric / SUM(uts.total_attempts) * 100, 2)
            ELSE 0
          END as accuracy,
          RANK() OVER (ORDER BY SUM(uts.correct_answers) DESC) as rank
        FROM users u
        JOIN user_topic_stats uts ON uts.user_id = u.id
        JOIN subject_topics t ON (t.id = uts.topic_id OR (uts.topic_id IS NULL AND LOWER(t.name) = LOWER(uts.topic)))
        WHERE t.subject_id = $1
          AND uts.total_attempts > 0
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY correct_answers DESC
        LIMIT $2
      `, [subjectId, limit])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Get exam-specific ranking.
   */
  async getExamRanking(examId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const limit = options.limit || 100

      const result = await client.query(`
        SELECT
          u.id as user_id,
          u.name,
          u.avatar_url,
          COUNT(DISTINCT a.id) as total_tests,
          AVG(CASE WHEN a.total_marks > 0
            THEN a.score / a.total_marks * 100
            ELSE 0
          END) as avg_percentage,
          RANK() OVER (ORDER BY AVG(CASE WHEN a.total_marks > 0
            THEN a.score / a.total_marks * 100
            ELSE 0
          END) DESC) as rank
        FROM users u
        JOIN attempts a ON a.user_id = u.id
        JOIN tests t ON t.id = a.test_id
        WHERE a.is_completed = true
          AND a.is_active = true
          AND t.exam_id = $1
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY avg_percentage DESC
        LIMIT $2
      `, [examId, limit])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Get rank history for a user.
   */
  async getRankHistory(userId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const days = options.days || 30

      const result = await client.query(`
        SELECT
          DATE(a.completed_at) as date,
          a.test_id,
          t.title as test_title,
          a.score,
          a.total_marks,
          CASE WHEN a.total_marks > 0
            THEN ROUND(a.score / a.total_marks * 100, 2)
            ELSE 0
          END as percentage
        FROM attempts a
        JOIN tests t ON t.id = a.test_id
        WHERE a.user_id = $1
          AND a.is_completed = true
          AND a.completed_at >= NOW() - ($2 * INTERVAL '1 day')
        ORDER BY a.completed_at DESC
      `, [userId, days])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Calculate percentile.
   */
  async calculatePercentile(userId, testId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      // Get user's score
      const userScore = await client.query(
        `SELECT score, total_marks FROM attempts
         WHERE user_id = $1 AND test_id = $2 AND is_active = true
         ORDER BY completed_at DESC LIMIT 1`,
        [userId, testId]
      )

      if (userScore.rows.length === 0) return null

      const score = userScore.rows[0].score

      // Calculate percentile
      const result = await client.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN score < $1 THEN 1 END) as users_below
        FROM attempts
        WHERE test_id = $2
          AND is_completed = true
          AND is_active = true
      `, [score, testId])

      const { total_users, users_below } = result.rows[0]
      const percentile = total_users > 0
        ? Math.round((users_below / total_users) * 100)
        : 0

      return {
        score,
        percentile,
        totalUsers: parseInt(total_users),
        usersBelow: parseInt(users_below),
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get top performers.
   */
  async getTopPerformers(options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const limit = options.limit || 10
      const period = options.period || 'all'

      let dateFilter = ''
      if (period === 'week') {
        dateFilter = `AND a.completed_at >= NOW() - INTERVAL '7 days'`
      } else if (period === 'month') {
        dateFilter = `AND a.completed_at >= NOW() - INTERVAL '30 days'`
      }

      const result = await client.query(`
        SELECT
          u.id as user_id,
          u.name,
          u.avatar_url,
          COUNT(DISTINCT a.id) as total_tests,
          SUM(a.score) as total_score,
          AVG(CASE WHEN a.total_marks > 0
            THEN a.score / a.total_marks * 100
            ELSE 0
          END) as avg_percentage
        FROM users u
        JOIN attempts a ON a.user_id = u.id
        WHERE a.is_completed = true
          AND a.is_active = true
          ${dateFilter}
        GROUP BY u.id, u.name, u.avatar_url
        ORDER BY total_score DESC
        LIMIT $1
      `, [limit])

      return result.rows
    } finally {
      client.release()
    }
  },
}

export default rankingService
