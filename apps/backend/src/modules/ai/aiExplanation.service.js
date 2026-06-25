/**
 * AI Explanation Service
 *
 * Generates explanations for questions using AI models.
 * Supports:
 * - Single question explanation generation
 * - Bulk explanation generation
 * - Explanation improvement/rewriting
 * - Multi-language explanations
 * - Cost tracking and rate limiting
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'
import AiGenerationLog from '../../data/models/ai/AiGenerationLog.js'

const AI_CONFIG = {
  defaultModel: process.env.AI_MODEL || 'gpt-4',
  defaultProvider: process.env.AI_PROVIDER || 'openrouter',
  apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY,
  baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
  rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT) || 60,
}

/**
 * Call AI API for text generation.
 */
async function callAI(prompt, options = {}) {
  const startTime = Date.now()

  try {
    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'HTTP-Referer': 'https://trstprep.com',
        'X-Title': 'TrstPrep AI',
      },
      body: JSON.stringify({
        model: options.model || AI_CONFIG.defaultModel,
        messages: [
          {
            role: 'system',
            content: options.systemPrompt || 'You are an expert educator creating clear, accurate explanations for exam questions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || AI_CONFIG.maxTokens,
        temperature: options.temperature || AI_CONFIG.temperature,
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

const aiExplanationService = {
  /**
   * Generate explanation for a single question.
   */
  async generateExplanation(questionId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      // Get question
      const questionResult = await client.query(
        `SELECT * FROM questions WHERE id = $1`,
        [questionId]
      )

      if (questionResult.rows.length === 0) {
        throw new Error('Question not found')
      }

      const question = questionResult.rows[0]

      // Build prompt
      const prompt = this.buildExplanationPrompt(question, options)

      // Call AI
      const aiResult = await callAI(prompt, {
        model: options.model,
        maxTokens: options.maxTokens || 1500,
        systemPrompt: options.systemPrompt || this.getSystemPrompt(options.language),
      })

      // Log the generation
      await AiGenerationLog.logSuccess({
        entityType: 'explanation',
        entityId: questionId,
        prompt: prompt.substring(0, 1000),
        model: aiResult.model,
        provider: AI_CONFIG.defaultProvider,
        tokensInput: aiResult.tokensInput,
        tokensOutput: aiResult.tokensOutput,
        latencyMs: aiResult.latencyMs,
        metadata: {
          language: options.language || 'en',
          questionType: question.question_type,
        },
        createdBy: options.userId || null,
      })

      // Update question explanation if requested
      if (options.saveToQuestion) {
        await client.query(
          `UPDATE questions SET explanation = $1, updated_at = NOW() WHERE id = $2`,
          [aiResult.text, questionId]
        )
      }

      return {
        questionId,
        explanation: aiResult.text,
        model: aiResult.model,
        tokens: aiResult.tokensInput + aiResult.tokensOutput,
        latencyMs: aiResult.latencyMs,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Generate explanations for multiple questions.
   */
  async generateBulk(questionIds, options = {}) {
    const results = {
      total: questionIds.length,
      generated: 0,
      failed: 0,
      errors: [],
    }

    for (const questionId of questionIds) {
      try {
        await this.generateExplanation(questionId, options)
        results.generated++
      } catch (error) {
        results.failed++
        results.errors.push({
          questionId,
          message: error.message || 'Generation failed',
        })
      }
    }

    return results
  },

  /**
   * Improve an existing explanation.
   */
  async improveExplanation(questionId, instructions = '', options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const questionResult = await client.query(
        `SELECT * FROM questions WHERE id = $1`,
        [questionId]
      )

      if (questionResult.rows.length === 0) {
        throw new Error('Question not found')
      }

      const question = questionResult.rows[0]

      if (!question.explanation) {
        throw new Error('No existing explanation to improve')
      }

      const prompt = `
Question: ${question.question_text}
Options: ${JSON.stringify(question.options)}
Correct Answer: Option ${question.correct_option + 1}
Current Explanation: ${question.explanation}

Improvement Instructions: ${instructions || 'Make the explanation clearer, more detailed, and easier to understand.'}

Please provide an improved explanation.
`

      const aiResult = await callAI(prompt, {
        model: options.model,
        maxTokens: options.maxTokens || 1500,
        systemPrompt: 'You are an expert educator improving explanations to make them clearer and more helpful.',
      })

      await AiGenerationLog.logSuccess({
        entityType: 'explanation_improve',
        entityId: questionId,
        prompt: prompt.substring(0, 1000),
        model: aiResult.model,
        provider: AI_CONFIG.defaultProvider,
        tokensInput: aiResult.tokensInput,
        tokensOutput: aiResult.tokensOutput,
        latencyMs: aiResult.latencyMs,
        metadata: {
          originalExplanation: question.explanation.substring(0, 500),
          instructions,
        },
        createdBy: options.userId || null,
      })

      return {
        questionId,
        originalExplanation: question.explanation,
        improvedExplanation: aiResult.text,
        model: aiResult.model,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Generate explanation in Hindi.
   */
  async generateHindiExplanation(questionId, options = {}) {
    return this.generateExplanation(questionId, {
      ...options,
      language: 'hi',
      systemPrompt: `You are an expert educator creating clear, accurate explanations for exam questions in Hindi.
The explanation should be in Hindi (Devanagari script) and easy to understand.
Use simple Hindi words and avoid complex technical terms where possible.`,
    })
  },

  /**
   * Build prompt for explanation generation.
   */
  buildExplanationPrompt(question, options = {}) {
    const optionsList = question.options
      .map((opt, i) => `Option ${i + 1}: ${opt}`)
      .join('\n')

    return `
Question: ${question.question_text}

${optionsList}

Correct Answer: Option ${question.correct_option + 1}

Please provide a detailed explanation for why Option ${question.correct_option + 1} is correct.
${options.includeSteps ? 'Include step-by-step reasoning.' : ''}
${options.includeRelatedConcepts ? 'Also mention related concepts that might be useful.' : ''}
Keep the explanation clear and concise, suitable for exam preparation.
`
  },

  /**
   * Get system prompt for the AI.
   */
  getSystemPrompt(language = 'en') {
    if (language === 'hi') {
      return 'You are an expert educator creating clear, accurate explanations for exam questions in Hindi.'
    }
    return 'You are an expert educator creating clear, accurate explanations for exam questions. Your explanations should be easy to understand and help students learn the underlying concepts.'
  },

  /**
   * Get AI usage statistics.
   */
  async getUsageStats(startDate, endDate) {
    return AiGenerationLog.getCostSummary(startDate, endDate)
  },

  /**
   * Get model performance stats.
   */
  async getModelStats() {
    return AiGenerationLog.getStatsByModel()
  },
}

export default aiExplanationService
