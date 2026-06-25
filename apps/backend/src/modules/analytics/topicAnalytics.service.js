/**
 * Topic Analytics Dashboard Service
 *
 * Provides comprehensive analytics for topics:
 * - Topic performance metrics
 * - Question-level analytics
 * - User engagement metrics
 * - Trend analysis
 * - Comparative analytics
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'

const topicAnalyticsService = {
  /**
   * Get topic performance overview.
   */
  async getTopicOverview(topicId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          t.id,
          t.name,
          s.name as subject_name,
          (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id AND q.is_active = true) as total_questions,
          (SELECT COUNT(*) FROM user_topic_stats uts WHERE (uts.topic_id = t.id OR (uts.topic_id IS NULL AND LOWER(uts.topic) = LOWER(t.name)))) as total_users,
          (SELECT AVG(uts.accuracy) FROM user_topic_stats uts WHERE (uts.topic_id = t.id OR (uts.topic_id IS NULL AND LOWER(uts.topic) = LOWER(t.name))) AND uts.total_attempts > 0) as avg_accuracy,
          (SELECT AVG(uts.total_time_spent_seconds / NULLIF(uts.total_attempts, 0))
           FROM user_topic_stats uts WHERE (uts.topic_id = t.id OR (uts.topic_id IS NULL AND LOWER(uts.topic) = LOWER(t.name))) AND uts.total_attempts > 0) as avg_time_per_question
        FROM topics t
        LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE t.id = $1
      `, [topicId])

      return result.rows[0] || null
    } finally {
      client.release()
    }
  },

  /**
   * Get question-level analytics for a topic.
   */
  async getQuestionAnalytics(topicId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          q.id,
          q.question_text,
          q.difficulty,
          q.marks,
          (SELECT COUNT(*) FROM question_attempts qa
           JOIN attempts a ON a.id = qa.attempt_id
           WHERE qa.question_id = q.id AND a.is_completed = true) as total_attempts,
          (SELECT COUNT(*) FROM question_attempts qa
           JOIN attempts a ON a.id = qa.attempt_id
           WHERE qa.question_id = q.id AND qa.selected_option = q.correct_option AND a.is_completed = true) as correct_count,
          (SELECT AVG(qa.time_spent_seconds) FROM question_attempts qa
           WHERE qa.question_id = q.id) as avg_time
        FROM questions q
        WHERE q.topic_id = $1 AND q.is_active = true
        ORDER BY
          CASE
            WHEN (SELECT COUNT(*) FROM question_attempts qa WHERE qa.question_id = q.id) > 0
            THEN (SELECT COUNT(*) FROM question_attempts qa
                  JOIN attempts a ON a.id = qa.attempt_id
                  WHERE qa.question_id = q.id AND qa.selected_option = q.correct_option AND a.is_completed = true)::float /
                 (SELECT COUNT(*) FROM question_attempts qa
                  JOIN attempts a ON a.id = qa.attempt_id
                  WHERE qa.question_id = q.id AND a.is_completed = true)
            ELSE 0
          END ASC
      `, [topicId])

      return result.rows.map(row => ({
        id: row.id,
        questionText: row.question_text,
        difficulty: row.difficulty,
        marks: row.marks,
        totalAttempts: parseInt(row.total_attempts),
        correctCount: parseInt(row.correct_count),
        accuracy: row.total_attempts > 0
          ? Math.round(row.correct_count / row.total_attempts * 100)
          : 0,
        avgTime: Math.round(row.avg_time || 0),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get user engagement metrics for a topic.
   */
  async getUserEngagement(topicId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          COUNT(DISTINCT uts.user_id) as unique_users,
          SUM(uts.total_attempts) as total_attempts,
          AVG(uts.total_attempts) as avg_attempts_per_user,
          MAX(uts.last_attempted_at) as last_activity,
          COUNT(DISTINCT CASE WHEN uts.accuracy >= 80 THEN uts.user_id END) as high_performers,
          COUNT(DISTINCT CASE WHEN uts.accuracy < 40 THEN uts.user_id END) as struggling_users
        FROM user_topic_stats uts
        WHERE uts.topic_id = $1 OR (uts.topic_id IS NULL AND LOWER(uts.topic) IN (
          SELECT LOWER(name) FROM topics WHERE id = $1
        ))
      `, [topicId])

      return result.rows[0] || {
        uniqueUsers: 0,
        totalAttempts: 0,
        avgAttemptsPerUser: 0,
        lastActivity: null,
        highPerformers: 0,
        strugglingUsers: 0,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get difficulty distribution for a topic.
   */
  async getDifficultyDistribution(topicId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          q.difficulty,
          COUNT(*) as count,
          AVG(uts.accuracy) as avg_accuracy
        FROM questions q
        LEFT JOIN user_topic_stats uts ON (uts.topic_id = q.topic_id OR (uts.topic_id IS NULL AND LOWER(uts.topic) = LOWER((SELECT name FROM topics WHERE id = q.topic_id))))
        WHERE q.topic_id = $1 AND q.is_active = true
        GROUP BY q.difficulty
        ORDER BY
          CASE q.difficulty
            WHEN 'easy' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'hard' THEN 3
            WHEN 'very_hard' THEN 4
            ELSE 5
          END
      `, [topicId])

      return result.rows.map(row => ({
        difficulty: row.difficulty,
        count: parseInt(row.count),
        avgAccuracy: parseFloat(row.avg_accuracy || 0),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get performance trends for a topic.
   */
  async getPerformanceTrends(topicId, days = 30) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          DATE(a.completed_at) as date,
          COUNT(DISTINCT a.user_id) as unique_users,
          AVG(a.score / NULLIF(a.total_marks, 0) * 100) as avg_percentage,
          SUM(a.correct_count) as total_correct,
          SUM(a.wrong_count) as total_wrong
        FROM attempts a
        JOIN test_questions tq ON tq.test_id = a.test_id
        JOIN questions q ON q.id = tq.question_id
        WHERE q.topic_id = $1
          AND a.is_completed = true
          AND a.completed_at >= NOW() - ($2 * INTERVAL '1 day')
        GROUP BY DATE(a.completed_at)
        ORDER BY date
      `, [topicId, days])

      return result.rows.map(row => ({
        date: row.date,
        uniqueUsers: parseInt(row.unique_users),
        avgPercentage: parseFloat(row.avg_percentage),
        totalCorrect: parseInt(row.total_correct),
        totalWrong: parseInt(row.total_wrong),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get comparative analytics across topics.
   */
  async getComparativeAnalytics(topicIds) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          t.id,
          t.name,
          (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id AND q.is_active = true) as total_questions,
          (SELECT COUNT(DISTINCT uts.user_id) FROM user_topic_stats uts WHERE uts.topic_id = t.id) as unique_users,
          (SELECT AVG(uts.accuracy) FROM user_topic_stats uts WHERE uts.topic_id = t.id AND uts.total_attempts > 0) as avg_accuracy
        FROM topics t
        WHERE t.id = ANY($1)
        ORDER BY avg_accuracy ASC
      `, [topicIds])

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        totalQuestions: parseInt(row.total_questions),
        uniqueUsers: parseInt(row.unique_users),
        avgAccuracy: parseFloat(row.avg_accuracy || 0),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get topic dashboard summary.
   */
  async getDashboardSummary(topicId) {
    const [overview, engagement, difficultyDist, trends] = await Promise.all([
      this.getTopicOverview(topicId),
      this.getUserEngagement(topicId),
      this.getDifficultyDistribution(topicId),
      this.getPerformanceTrends(topicId, 7),
    ])

    return {
      overview,
      engagement,
      difficultyDistribution: difficultyDist,
      weeklyTrends: trends,
    }
  },
}

export default topicAnalyticsService
