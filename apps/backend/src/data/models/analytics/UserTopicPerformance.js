/**
 * UserTopicPerformance Model
 *
 * Tracks per-user, per-topic AI analytics for adaptive learning:
 * - Accuracy rates
 * - Average time per question
 * - Weak area identification
 *
 * One row per (user_id, topic_id) pair, updated after each test submission.
 */

import { pool } from '../../../infrastructure/database/postgres-helpers.js'

class UserTopicPerformance {
  /**
   * Get all performance records for a user, sorted by accuracy (weakest first).
   */
  static async getByUser(userId) {
    const result = await pool.query(
      `SELECT utp.*, t.name AS topic_name, s.name AS subject_name
       FROM user_topic_performance utp
       LEFT JOIN topics t ON utp.topic_id = t.id
       LEFT JOIN subjects s ON t.subject_id = s.id
       WHERE utp.user_id = $1
       ORDER BY utp.accuracy ASC`,
      [userId]
    )
    return result.rows
  }

  /**
   * Get performance for a specific user + topic.
   */
  static async getByUserAndTopic(userId, topicId) {
    const result = await pool.query(
      `SELECT * FROM user_topic_performance
       WHERE user_id = $1 AND topic_id = $2`,
      [userId, topicId]
    )
    return result.rows[0] || null
  }

  /**
   * Get the user's weakest topics (lowest accuracy, minimum 5 attempts).
   */
  static async getWeakAreas(userId, limit = 5) {
    const result = await pool.query(
      `SELECT utp.*, t.name AS topic_name, s.name AS subject_name
       FROM user_topic_performance utp
       LEFT JOIN topics t ON utp.topic_id = t.id
       LEFT JOIN subjects s ON t.subject_id = s.id
       WHERE utp.user_id = $1 AND utp.total_attempted >= 5
       ORDER BY utp.accuracy ASC
       LIMIT $2`,
      [userId, limit]
    )
    return result.rows
  }

  /**
   * Get the user's strongest topics (highest accuracy, minimum 5 attempts).
   */
  static async getStrongAreas(userId, limit = 5) {
    const result = await pool.query(
      `SELECT utp.*, t.name AS topic_name, s.name AS subject_name
       FROM user_topic_performance utp
       LEFT JOIN topics t ON utp.topic_id = t.id
       LEFT JOIN subjects s ON t.subject_id = s.id
       WHERE utp.user_id = $1 AND utp.total_attempted >= 5
       ORDER BY utp.accuracy DESC
       LIMIT $2`,
      [userId, limit]
    )
    return result.rows
  }

  /**
   * Upsert topic performance after a test submission.
   * Uses PostgreSQL UPSERT (INSERT ... ON CONFLICT ... UPDATE).
   *
   * @param {number} userId
   * @param {number} topicId
   * @param {Object} data - { attempted, correct, wrong, totalTime }
   */
  static async updatePerformance(userId, topicId, data) {
    const { attempted = 0, correct = 0, wrong = 0, totalTime = 0 } = data

    const result = await pool.query(
      `INSERT INTO user_topic_performance (user_id, topic_id, total_attempted, total_correct, total_wrong, accuracy, average_time, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, topic_id) DO UPDATE SET
         total_attempted = user_topic_performance.total_attempted + EXCLUDED.total_attempted,
         total_correct = user_topic_performance.total_correct + EXCLUDED.total_correct,
         total_wrong = user_topic_performance.total_wrong + EXCLUDED.total_wrong,
         accuracy = CASE
           WHEN (user_topic_performance.total_correct + EXCLUDED.total_correct + user_topic_performance.total_wrong + EXCLUDED.total_wrong) > 0
           THEN ROUND(
             (user_topic_performance.total_correct + EXCLUDED.total_correct)::numeric /
             (user_topic_performance.total_correct + EXCLUDED.total_correct + user_topic_performance.total_wrong + EXCLUDED.total_wrong)::numeric * 100,
             2
           )
           ELSE 0
         END,
         average_time = CASE
           WHEN (user_topic_performance.total_attempted + EXCLUDED.total_attempted) > 0
           THEN ROUND(
             ((user_topic_performance.average_time * user_topic_performance.total_attempted) + $7) /
             (user_topic_performance.total_attempted + EXCLUDED.total_attempted),
             2
           )
           ELSE 0
         END,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        topicId,
        attempted,
        correct,
        wrong,
        attempted > 0 ? Math.round((correct / attempted) * 100 * 100) / 100 : 0,
        totalTime,
      ]
    )

    return result.rows[0]
  }

  /**
   * Batch update topic performance from a completed test attempt.
   * Groups question results by topic and upserts each.
   *
   * @param {number} userId
   * @param {Array} questionResults - Array of { topicId, isCorrect, timeSpent }
   */
  static async batchUpdateFromAttempt(userId, questionResults) {
    if (!Array.isArray(questionResults) || questionResults.length === 0) return

    // Group by topic
    const topicMap = new Map()
    for (const qr of questionResults) {
      if (!qr.topicId) continue
      const key = qr.topicId
      if (!topicMap.has(key)) {
        topicMap.set(key, { attempted: 0, correct: 0, wrong: 0, totalTime: 0 })
      }
      const stats = topicMap.get(key)
      stats.attempted++
      if (qr.isCorrect) {
        stats.correct++
      } else {
        stats.wrong++
      }
      stats.totalTime += qr.timeSpent || 0
    }

    // Upsert each topic
    for (const [topicId, stats] of topicMap) {
      await this.updatePerformance(userId, topicId, stats)
    }
  }

  /**
   * Get overall subject-level performance (aggregated from topics).
   */
  static async getSubjectPerformance(userId) {
    const result = await pool.query(
      `SELECT
         s.id AS subject_id,
         s.name AS subject_name,
         SUM(utp.total_attempted) AS total_attempted,
         SUM(utp.total_correct) AS total_correct,
         SUM(utp.total_wrong) AS total_wrong,
         CASE
           WHEN SUM(utp.total_correct) + SUM(utp.total_wrong) > 0
           THEN ROUND(SUM(utp.total_correct)::numeric / (SUM(utp.total_correct) + SUM(utp.total_wrong))::numeric * 100, 2)
           ELSE 0
         END AS accuracy,
         COUNT(DISTINCT utp.topic_id) AS topics_practiced
       FROM user_topic_performance utp
       JOIN topics t ON utp.topic_id = t.id
       JOIN subjects s ON t.subject_id = s.id
       WHERE utp.user_id = $1
       GROUP BY s.id, s.name
       ORDER BY accuracy ASC`,
      [userId]
    )
    return result.rows
  }
}

export default UserTopicPerformance
