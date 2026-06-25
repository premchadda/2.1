/**
 * Smart Revision Planner Service
 *
 * AI-powered revision planning:
 * - Spaced repetition scheduling
 * - Priority-based revision
 * - Custom revision plans
 * - Progress tracking
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'
import weakAreaDetectionService from '../analytics/weakAreaDetection.service.js'
import AiGenerationLog from '../../data/models/ai/AiGenerationLog.js'

const AI_CONFIG = {
  model: process.env.AI_MODEL || 'gpt-4',
  provider: process.env.AI_PROVIDER || 'openrouter',
  apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY,
  baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
}

async function callAI(messages, options = {}) {
  const startTime = Date.now()

  try {
    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'HTTP-Referer': 'https://trstprep.com',
        'X-Title': 'TrstPrep Smart Revision',
      },
      body: JSON.stringify({
        model: options.model || AI_CONFIG.model,
        messages,
        max_tokens: options.maxTokens || AI_CONFIG.maxTokens,
        temperature: options.temperature || 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    const latencyMs = Date.now() - startTime

    return {
      text: data.choices[0]?.message?.content || '',
      model: data.model,
      tokensInput: data.usage?.prompt_tokens || 0,
      tokensOutput: data.usage?.completion_tokens || 0,
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    throw {
      message: error.message,
      latencyMs,
    }
  }
}

const smartRevisionService = {
  /**
   * Generate a smart revision plan.
   */
  async generateRevisionPlan(userId, options = {}) {
    const weakAreas = await weakAreaDetectionService.getFullAnalysis(userId)
    const wrongQuestions = await this.getWrongQuestions(userId)

    const systemPrompt = `You are an expert revision planner for competitive exam preparation.
Create a smart revision plan using spaced repetition principles.
Prioritize topics with low accuracy and high frequency of mistakes.
Include specific revision activities and time allocation.`

    const userPrompt = `
Student Performance Analysis:
- Overall Accuracy: ${weakAreas.overallAccuracy}%
- Total Questions Attempted: ${weakAreas.totalQuestionsAttempted}

Weak Topics (Priority for Revision):
${weakAreas.weakTopics.slice(0, 10).map((t, i) =>
  `${i + 1}. ${t.topicName} (${t.subjectName}) - ${t.accuracy}% accuracy, ${t.totalAttempts} attempts`
).join('\n')}

Wrong Questions Analysis:
- Total Wrong Questions: ${wrongQuestions.length}
- Most Common Topics: ${this.getMostCommonTopics(wrongQuestions)}

Create a ${options.days || 14}-day revision plan that:
1. Uses spaced repetition (review after 1 day, 3 days, 7 days, 14 days)
2. Prioritizes high-impact topics (low accuracy + high frequency)
3. Includes daily revision targets (e.g., "Revise 20 questions from Algebra")
4. Suggests specific revision techniques (flashcards, practice tests, etc.)
5. Allocates more time to critical weak areas
6. Includes rest days and light revision days
`

    const aiResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    await AiGenerationLog.logSuccess({
      entityType: 'revision_plan',
      entityId: userId,
      prompt: userPrompt.substring(0, 1000),
      model: aiResult.model,
      provider: AI_CONFIG.provider,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      latencyMs: aiResult.latencyMs,
      metadata: {
        days: options.days || 14,
        weakTopicsCount: weakAreas.weakTopics.length,
        wrongQuestionsCount: wrongQuestions.length,
      },
      createdBy: userId,
    })

    return {
      revisionPlan: aiResult.text,
      weakAreas: weakAreas.weakTopics.slice(0, 5),
      wrongQuestionsCount: wrongQuestions.length,
      model: aiResult.model,
    }
  },

  /**
   * Get questions user got wrong.
   */
  async getWrongQuestions(userId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          wq.id,
          wq.question_id,
          wq.wrong_count,
          wq.last_wrong_at,
          q.question_text,
          q.difficulty,
          t.name as topic_name,
          s.name as subject_name
        FROM wrong_questions wq
        JOIN questions q ON q.id = wq.question_id
        LEFT JOIN topics t ON t.id = q.topic_id
        LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE wq.user_id = $1
        ORDER BY wq.wrong_count DESC, wq.last_wrong_at DESC
      `, [userId])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Get most common topics from wrong questions.
   */
  getMostCommonTopics(wrongQuestions) {
    const topicCounts = {}
    wrongQuestions.forEach(q => {
      const topic = q.topic_name || 'Unknown'
      topicCounts[topic] = (topicCounts[topic] || 0) + 1
    })

    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => `${topic} (${count} wrong)`)
      .join(', ')
  },

  /**
   * Add question to revision queue.
   */
  async addToRevisionQueue(userId, questionId, priority = 'medium') {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      // Check if already in queue
      const existing = await client.query(
        `SELECT id FROM revision_queue WHERE user_id = $1 AND question_id = $2`,
        [userId, questionId]
      )

      if (existing.rows.length > 0) {
        // Update priority
        await client.query(
          `UPDATE revision_queue SET priority = $1, updated_at = NOW()
           WHERE user_id = $2 AND question_id = $3`,
          [priority, userId, questionId]
        )
        return { action: 'updated', priority }
      }

      // Calculate next review time based on priority
      const intervals = {
        high: 1,    // 1 day
        medium: 3,  // 3 days
        low: 7,     // 7 days
      }

      const nextReview = new Date()
      nextReview.setDate(nextReview.getDate() + (intervals[priority] || 3))

      await client.query(
        `INSERT INTO revision_queue (user_id, question_id, priority, next_review_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, questionId, priority, nextReview]
      )

      return { action: 'added', priority, nextReview }
    } finally {
      client.release()
    }
  },

  /**
   * Get questions due for revision.
   */
  async getDueRevisions(userId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          rq.id,
          rq.question_id,
          rq.priority,
          rq.next_review_at,
          rq.metadata,
          q.question_text,
          q.options,
          q.correct_option,
          q.difficulty,
          t.name as topic_name
        FROM revision_queue rq
        JOIN questions q ON q.id = rq.question_id
        LEFT JOIN topics t ON t.id = q.topic_id
        WHERE rq.user_id = $1
          AND rq.next_review_at <= NOW()
        ORDER BY
          CASE rq.priority
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
          END,
          rq.next_review_at ASC
      `, [userId])

      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Mark revision as completed and schedule next.
   */
  async completeRevision(userId, questionId, remembered = true) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      // Get current revision
      const current = await client.query(
        `SELECT * FROM revision_queue WHERE user_id = $1 AND question_id = $2`,
        [userId, questionId]
      )

      if (current.rows.length === 0) {
        return null
      }

      const revision = current.rows[0]

      // Calculate next interval based on performance
      const intervals = {
        high: [1, 3, 7, 14, 30],
        medium: [3, 7, 14, 30, 60],
        low: [7, 14, 30, 60, 120],
      }

      const currentInterval = intervals[revision.priority] || intervals.medium
      const metadata = revision.metadata || { reviewCount: 0 }
      const reviewCount = metadata.reviewCount || 0

      let nextInterval
      if (remembered) {
        nextInterval = currentInterval[Math.min(reviewCount + 1, currentInterval.length - 1)]
      } else {
        nextInterval = currentInterval[0]
      }

      const nextReview = new Date()
      nextReview.setDate(nextReview.getDate() + nextInterval)

      await client.query(
        `UPDATE revision_queue SET
          next_review_at = $1,
          metadata = $2,
          updated_at = NOW()
         WHERE user_id = $3 AND question_id = $4`,
        [
          nextReview,
          JSON.stringify({
            ...metadata,
            reviewCount: reviewCount + 1,
            lastReviewed: new Date(),
            remembered,
          }),
          userId,
          questionId,
        ]
      )

      return {
        nextReview,
        interval: nextInterval,
        reviewCount: reviewCount + 1,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get revision statistics.
   */
  async getRevisionStats(userId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          COUNT(*) as total_in_queue,
          COUNT(CASE WHEN next_review_at <= NOW() THEN 1 END) as due_now,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority
        FROM revision_queue
        WHERE user_id = $1
      `, [userId])

      return result.rows[0]
    } finally {
      client.release()
    }
  },
}

export default smartRevisionService
