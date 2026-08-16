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
        LEFT JOIN subject_topics t ON t.id = q.topic_id
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
      const priorityMap = { low: 0, medium: 1, high: 2 };
      const priorityInt = priorityMap[priority] !== undefined ? priorityMap[priority] : 1;

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
          [priorityInt, userId, questionId]
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
      const daysInterval = intervals[priority] || 3;
      nextReview.setDate(nextReview.getDate() + daysInterval)

      await client.query(
        `INSERT INTO revision_queue (user_id, question_id, priority, due_at, schedule_day, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [userId, questionId, priorityInt, nextReview, daysInterval]
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
          id,
          question_id,
          priority,
          next_review_at,
          metadata,
          question_text,
          options,
          correct_option,
          difficulty,
          topic_name
        FROM (
          SELECT DISTINCT ON (rq.question_id)
            rq.id,
            rq.question_id,
            rq.priority,
            rq.due_at as next_review_at,
            rq.metadata,
            q.question_text,
            q.options,
            q.correct_option,
            q.difficulty,
            t.name as topic_name
          FROM revision_queue rq
          JOIN questions q ON q.id = rq.question_id
          LEFT JOIN subject_topics t ON t.id = q.topic_id
          WHERE rq.user_id = $1
            AND rq.due_at <= NOW()
            AND rq.status = 'pending'
          ORDER BY rq.question_id, rq.due_at ASC
        ) deduped
        ORDER BY priority DESC, next_review_at ASC
      `, [userId])

      const priorityStrMap = { 0: 'low', 1: 'medium', 2: 'high' }
      return result.rows.map(row => ({
        ...row,
        priority: priorityStrMap[row.priority] || 'medium'
      }))
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
      // Get current revision — earliest-due pending row, so the reschedule
      // always targets the row the user was actually shown.
      const current = await client.query(
        `SELECT id, user_id, question_id, priority, due_at, metadata, created_at, updated_at FROM revision_queue WHERE user_id = $1 AND question_id = $2 AND status = 'pending' ORDER BY due_at ASC, id ASC LIMIT 1`,
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

      const priorityStrMap = { 0: 'low', 1: 'medium', 2: 'high' }
      const priorityStr = priorityStrMap[revision.priority] || 'medium'
      const currentInterval = intervals[priorityStr] || intervals.medium
      
      let metadata = {}
      try {
        metadata = typeof revision.metadata === 'string' ? JSON.parse(revision.metadata) : (revision.metadata || {})
      } catch {
        metadata = {}
      }
      const reviewCount = Number(metadata.reviewCount || 0)

      let nextInterval
      if (remembered) {
        nextInterval = currentInterval[Math.min(reviewCount + 1, currentInterval.length - 1)]
      } else {
        nextInterval = currentInterval[0]
      }

      const nextReview = new Date()
      nextReview.setDate(nextReview.getDate() + nextInterval)

      // Clear the other pre-inserted rows (days 1/3/7/14) for this question so
      // duplicates never resurface in the due list.
      await client.query(
        `UPDATE revision_queue SET
          status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
         WHERE user_id = $1 AND question_id = $2 AND status = 'pending' AND id <> $3`,
        [userId, questionId, revision.id]
      )

      await client.query(
        `UPDATE revision_queue SET
          due_at = $1,
          metadata = $2,
          updated_at = NOW()
         WHERE id = $3`,
        [
          nextReview,
          JSON.stringify({
            ...metadata,
            reviewCount: reviewCount + 1,
            lastReviewed: new Date(),
            remembered,
          }),
          revision.id,
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
          COUNT(CASE WHEN due_at <= NOW() AND status = 'pending' THEN 1 END) as due_now,
          COUNT(CASE WHEN priority = 2 THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority = 1 THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority = 0 THEN 1 END) as low_priority
        FROM revision_queue
        WHERE user_id = $1
      `, [userId])

      return result.rows[0]
    } finally {
      client.release()
    }
  },

  /**
   * Get unified mistake questions for direct practice session.
   */
  async getMistakePracticeQuestions(userId, { testId = null, subjectId = null, limit = 25 } = {}) {
    const { pool, dbHelpers } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const params = [userId]
      let idx = 2

      let testFilter = ''
      if (testId && !isNaN(Number(testId))) {
        testFilter = `AND (wq.test_id = $${idx} OR wq.source_attempt_id = $${idx})`
        params.push(Number(testId))
        idx++
      }

      const sql = `
        WITH unified_mistakes AS (
          SELECT question_id, created_at FROM practice_answers WHERE user_id = $1 AND is_correct = false
          UNION
          SELECT question_id, COALESCE(last_seen_at, updated_at, created_at) AS created_at
          FROM wrong_questions wq
          WHERE wq.user_id = $1 AND (wq.is_active = true OR wq.is_active IS NULL) ${testFilter}
        ),
        deduped AS (
          SELECT DISTINCT ON (question_id) question_id, created_at
          FROM unified_mistakes
          ORDER BY question_id, created_at DESC
        )
        SELECT d.question_id, d.created_at, q.*, t.name as topic_name, s.name as subject_name
        FROM deduped d
        JOIN questions q ON d.question_id = q.id
        LEFT JOIN subject_topics t ON t.id = q.topic_id
        LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE q.is_active = true
        ORDER BY d.created_at DESC
        LIMIT $${idx}
      `
      params.push(Math.min(limit, 100))

      const result = await client.query(sql, params)
      return result.rows.map(row => {
        const q = dbHelpers.toCamel(row)
        const { correctAnswer, correct_option, correctOption, correct, answer, isCorrect, is_correct, ...safe } = q
        return safe
      })
    } finally {
      client.release()
    }
  },
}

export default smartRevisionService
