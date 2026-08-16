/**
 * Question Difficulty Prediction (Question Lifecycle — Difficulty Prediction stage)
 *
 * FIX (2026-07-11): prior to this, question difficulty was set manually and
 * constrained only by a static taxonomy (difficultyConfig.js). There was no
 * automated prediction. This heuristic service blends:
 *   1. Question feature signals (text/explanation length, option count, marks, image)
 *   2. Historical topic accuracy from `user_topic_stats` (lower accuracy => harder)
 *
 * It is intentionally defensive: any DB/feature failure degrades to a feature-only
 * heuristic and never throws to the caller.
 *
 * Output: { level, score (0-100), confidence, signals }
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'

function clamp(n, min = 0, max = 100) {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function scoreToLevel(score) {
  if (score <= 25) return 'easy'
  if (score <= 50) return 'medium'
  if (score <= 75) return 'hard'
  return 'very_hard'
}

export async function predictQuestionDifficulty(question = {}) {
  const signals = {}

  // ── 1. Feature-based score ───────────────────────────────────────────────
  let featureScore = 50

  const text = String(question.question_text || question.questionText || '')
  const explanation = String(question.explanation || '')
  const options = Array.isArray(question.options) ? question.options : []
  const marks = Number(question.marks) || 1
  const hasImage = !!(question.image || question.image_asset_id || question.solution_image_url)

  if (text.length > 300) featureScore += 10
  else if (text.length < 80) featureScore -= 5

  if (options.length >= 5) featureScore += 8

  if (marks >= 4) featureScore += 8
  else if (marks <= 1) featureScore -= 5

  if (explanation.length > 200) featureScore -= 8

  if (hasImage) featureScore += 5

  featureScore = clamp(featureScore)
  signals.featureScore = featureScore

  // ── 2. Historical topic accuracy ────────────────────────────────────────
  let historicalScore = null
  const topicId = question.topic_id || question.topicId
  if (topicId) {
    try {
      const res = await pool.query(
        `SELECT AVG(accuracy) AS avg_acc
           FROM user_topic_stats
          WHERE topic_id = $1 AND total_attempts >= 3`,
        [topicId]
      )
      const avgAcc = parseFloat(res.rows[0]?.avg_acc)
      if (!Number.isNaN(avgAcc)) {
        // Lower historical accuracy => harder question => higher difficulty score.
        historicalScore = clamp(100 - avgAcc)
        signals.historicalAccuracy = Math.round(avgAcc * 10) / 10
      }
    } catch {
      // DB unavailable / table missing — fall back to feature-only score.
    }
  }
  signals.historicalAccuracyUsed = historicalScore != null

  // ── 3. Blend ────────────────────────────────────────────────────────────
  const finalScore = historicalScore != null
    ? clamp(Math.round(featureScore * 0.4 + historicalScore * 0.6))
    : featureScore

  const level = scoreToLevel(finalScore)
  const confidence = historicalScore != null ? 'medium' : 'low'

  return {
    level,
    score: finalScore,
    confidence,
    signals: {
      ...signals,
      featureScore,
      finalScore,
    },
  }
}

export default { predictQuestionDifficulty }
