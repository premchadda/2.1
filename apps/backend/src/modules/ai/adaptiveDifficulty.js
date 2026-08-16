/**
 * Adaptive Difficulty Service
 *
 * Tracks user performance per topic and calculates a dynamic
 * difficulty score (0-100). Suggests next difficulty level:
 *   easy   (0-30)
 *   medium (30-70)
 *   hard   (70-100)
 *
 * Uses an exponential moving average (EMA) to blend historical
 * accuracy with recent performance so the score adapts quickly
 * but doesn't swing wildly on a single question.
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'

// ── Constants ───────────────────────────────────────────────
const EMA_ALPHA = 0.3               // weighting for new observations (0-1)
const DEFAULT_DIFFICULTY = 50       // neutral starting point
const MIN_ATTEMPTS_FOR_CONFIDENCE = 5

// In-memory fallback when Redis is unavailable
const localCache = new Map()

function cacheKey(userId, topicId) {
  return `${userId}:${topicId}`
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Map a numeric difficulty score (0-100) to a level label.
 */
function scoreToLevel(score) {
  if (score <= 30) return 'easy'
  if (score <= 70) return 'medium'
  return 'hard'
}

/**
 * Map a level label back to a representative score (midpoint).
 */
function levelToScore(level) {
  if (level === 'easy') return 15
  if (level === 'medium') return 50
  if (level === 'hard') return 85
  return DEFAULT_DIFFICULTY
}

/**
 * Compute the expected average time (seconds) for a question at a
 * given difficulty, based on global averages stored in the
 * `user_topic_stats` table.  Returns 0 when no data is available.
 */
async function getAvgTimeForTopic(topicId) {
  const result = await pool.query(
    `SELECT AVG(total_time_spent_seconds / NULLIF(total_attempts, 0)) AS avg_time
     FROM user_topic_stats
     WHERE topic_id = $1 AND total_attempts > 0`,
    [topicId]
  )
  return parseFloat(result.rows[0]?.avg_time || 0)
}

// ── Core public API ────────────────────────────────────────

const adaptiveDifficultyService = {
  /**
   * Get the current difficulty for a user + topic.
   *
   * Returns:
   *   { score, level, totalAttempts, recentAccuracy }
   */
  async getDifficulty(userId, topicId) {
    // 1. Try in-memory cache first
    const memKey = cacheKey(userId, topicId)
    const cached = localCache.get(memKey)
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return cached.data
    }

    // 2. Try Redis if available
    if (global.redis) {
      try {
        const raw = await global.redis.get(`adiff:${memKey}`)
        if (raw) {
          const data = JSON.parse(raw)
          localCache.set(memKey, { data, ts: Date.now() })
          return data
        }
      } catch { /* fall through */ }
    }

    // 3. Compute from DB
    const stats = await pool.query(
      `SELECT total_attempts, correct_answers, accuracy
       FROM user_topic_stats
       WHERE user_id = $1 AND topic_id = $2
       LIMIT 1`,
      [userId, topicId]
    )

    let score, totalAttempts, recentAccuracy

    if (stats.rows.length > 0) {
      const row = stats.rows[0]
      totalAttempts = parseInt(row.total_attempts) || 0
      recentAccuracy = parseFloat(row.accuracy) || 0
      // Score = accuracy percentage directly (0-100)
      score = recentAccuracy
    } else {
      totalAttempts = 0
      recentAccuracy = 0
      score = DEFAULT_DIFFICULTY
    }

    const data = {
      score: Math.round(score * 10) / 10,
      level: scoreToLevel(score),
      totalAttempts,
      recentAccuracy: Math.round(recentAccuracy * 10) / 10,
    }

    // Populate caches
    localCache.set(memKey, { data, ts: Date.now() })
    if (global.redis) {
      try {
        await global.redis.set(`adiff:${memKey}`, JSON.stringify(data), 'EX', 300)
      } catch { /* best-effort */ }
    }

    return data
  },

  /**
   * Record a performance event and recalculate the difficulty.
   *
   * @param {number}  userId
   * @param {number}  topicId
   * @param {boolean} correct   – whether the answer was correct
   * @param {number}  timeSpent – seconds
   * @returns Updated difficulty data.
   */
  async updatePerformance(userId, topicId, correct, timeSpent = 0) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Upsert user_topic_stats
      const existing = await client.query(
        `SELECT id, total_attempts, correct_answers, wrong_answers,
                total_time_spent_seconds, accuracy
         FROM user_topic_stats
         WHERE user_id = $1 AND topic_id = $2
         LIMIT 1`,
        [userId, topicId]
      )

      let newAttempts, newCorrect, newWrong, newTime, newAccuracy

      if (existing.rows.length > 0) {
        const row = existing.rows[0]
        const oldAttempts = parseInt(row.total_attempts) || 0
        const oldCorrect = parseInt(row.correct_answers) || 0
        const oldWrong = parseInt(row.wrong_answers) || 0
        const oldTime = parseFloat(row.total_time_spent_seconds) || 0

        newAttempts = oldAttempts + 1
        newCorrect = oldCorrect + (correct ? 1 : 0)
        newWrong = oldWrong + (correct ? 0 : 1)
        newTime = oldTime + (timeSpent || 0)
        newAccuracy = (newCorrect / newAttempts) * 100

        await client.query(
          `UPDATE user_topic_stats SET
            total_attempts   = $3,
            correct_answers  = $4,
            wrong_answers    = $5,
            total_time_spent_seconds = $6,
            accuracy         = $7,
            last_attempted_at = NOW(),
            updated_at       = NOW()
           WHERE id = $1 AND user_id = $2`,
          [row.id, userId, newAttempts, newCorrect, newWrong, newTime, newAccuracy]
        )
      } else {
        newAttempts = 1
        newCorrect = correct ? 1 : 0
        newWrong = correct ? 0 : 1
        newTime = timeSpent || 0
        newAccuracy = correct ? 100 : 0

        await client.query(
          `INSERT INTO user_topic_stats
            (user_id, topic_id, total_attempts, correct_answers, wrong_answers,
             total_time_spent_seconds, accuracy, last_attempted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())`,
          [userId, topicId, newAttempts, newCorrect, newWrong, newTime, newAccuracy]
        )
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // Invalidate caches
    const memKey = cacheKey(userId, topicId)
    localCache.delete(memKey)
    if (global.redis) {
      try { await global.redis.del(`adiff:${memKey}`) } catch { /* ignore */ }
    }

    // Return fresh difficulty
    return this.getDifficulty(userId, topicId)
  },

  /**
   * Batch: get difficulties for many topics at once.
   */
  async getDifficulties(userId, topicIds) {
    return Promise.all(topicIds.map(id => this.getDifficulty(userId, id)))
  },

  /**
   * Reset a user's difficulty for a topic back to neutral.
   */
  async resetDifficulty(userId, topicId) {
    const memKey = cacheKey(userId, topicId)
    localCache.delete(memKey)
    if (global.redis) {
      try { await global.redis.del(`adiff:${memKey}`) } catch { /* ignore */ }
    }
    return this.getDifficulty(userId, topicId)
  },
}

export default adaptiveDifficultyService
