import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { aiRateLimiter } from '../../middleware/aiRateLimiter.js'
import aiMentorService from './aiMentor.service.js'
import { callAIStream } from './aiClient.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

// Redis-backed rate limiter (falls back to skip if Redis unavailable)
async function aiRateLimit(userId) {
  if (!global.redis) return true
  try {
    const key = `ai:ratelimit:${userId}:${Math.floor(Date.now() / 60000)}`
    const count = await global.redis.incr(key)
    if (count === 1) {
      await global.redis.expire(key, 60)
    }
    return count <= parseInt(process.env.AI_RATE_LIMIT_MAX || '10')
  } catch {
    return true
  }
}

// Per-user token budget (in-memory fallback; uses Redis in production)
const userTokenUsage = new Map()

async function checkTokenBudget(userId, tokensRequested = 0) {
  const limit = parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '50000')
  const todayStr = new Date().toDateString()
  const redis = global.redis

  if (redis) {
    try {
      const key = `ai:tokenbudget:${userId}:${todayStr}`
      const current = parseInt(await redis.get(key) || '0', 10)
      if (current + tokensRequested > limit) return false
      await redis.incrby(key, tokensRequested)
      await redis.expire(key, 36 * 3600) // 36 hours TTL
      return true
    } catch (err) {
      console.error('Redis token budget error:', err)
    }
  }

  const daily = userTokenUsage.get(userId) || { count: 0, date: todayStr }
  if (daily.date !== todayStr) {
    daily.count = 0
    daily.date = todayStr
  }
  if (daily.count + tokensRequested > limit) return false
  daily.count += tokensRequested
  userTokenUsage.set(userId, daily)
  return true
}

function buildMessages(message, history = []) {
  const systemPrompt = `You are TrstPrep AI Mentor, an expert in Indian competitive exam preparation.
You help students with subject doubts, exam strategy, study planning, and motivation.
Be friendly, encouraging, and provide practical advice. Keep responses concise but helpful.`

  return [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({
      role: ['user', 'assistant'].includes(h.role) ? h.role : 'user',
      content: typeof h.content === 'string' ? h.content.substring(0, 2000) : '',
    })),
    { role: 'user', content: typeof message === 'string' ? message.substring(0, 2000) : '' },
  ]
}

router.post('/study-plan', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    }
    if (!await checkTokenBudget(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    const { days } = req.body
    const result = await aiMentorService.generateStudyPlan(req.user.id, {
      days: parseInt(days) || 30,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/doubt', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    }
    if (!await checkTokenBudget(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    const { question, topic, subject } = req.body
    if (!question) {
      return res.status(400).json({ success: false, message: 'Question is required' })
    }

    const result = await aiMentorService.answerDoubt(req.user.id, question, { topic, subject })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/exam-strategy', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    }
    if (!await checkTokenBudget(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    const { examType } = req.body
    if (!examType) {
      return res.status(400).json({ success: false, message: 'examType is required' })
    }

    const result = await aiMentorService.generateExamStrategy(req.user.id, examType)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/daily-tip', protect, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    }
    if (!await checkTokenBudget(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    const result = await aiMentorService.getDailyTip(req.user.id)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/chat', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    }
    if (!await checkTokenBudget(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    const { message, conversationId } = req.body
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' })
    }

    // Verify ownership of the target conversation (IDOR guard) — a user must
    // not be able to continue/read another user's conversation.
    if (conversationId) {
      const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
      const convResult = await pool.query(
        'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      )
      if (convResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Conversation not found' })
      }
    }

    const result = await aiMentorService.chat(req.user.id, message, conversationId)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/chat/stream', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    }
    if (!await checkTokenBudget(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    const message = req.body.message || (Array.isArray(req.body.messages) ? req.body.messages[req.body.messages.length - 1]?.content : null)
    let { conversationId } = req.body
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' })
    }

    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    if (!conversationId) {
      const title = message.substring(0, 50).trim() || 'New Chat'
      const convResult = await pool.query(
        'INSERT INTO ai_conversations (user_id, title) VALUES ($1, $2) RETURNING id',
        [req.user.id, title]
      )
      conversationId = convResult.rows[0].id
    } else {
      // Verify ownership of the target conversation (IDOR guard) — a user must
      // not be able to append to or read another user's conversation.
      const convResult = await pool.query(
        'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      )
      if (convResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Conversation not found' })
      }
    }

    // Fetch history from database
    const msgsResult = await pool.query(
      'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    )
    const history = msgsResult.rows

    // Save user message to database
    await pool.query(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [conversationId, 'user', message]
    )

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const messages = buildMessages(message, history)
    const response = await callAIStream(messages)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let assistantResponseText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          res.write('data: [DONE]\n\n')
          break
        }
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices[0]?.delta?.content
          if (content) {
            assistantResponseText += content
            res.write(`data: ${JSON.stringify({ content, conversationId })}\n\n`)
          }
        } catch (e) {
          // Skip malformed chunks
        }
      }
    }

    // Save assistant response to database
    if (assistantResponseText) {
      await pool.query(
        'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [conversationId, 'assistant', assistantResponseText]
      )
    }

    res.end()
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/conversations', protect, async (req, res) => {
  try {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const result = await pool.query(
      'SELECT id, title, created_at FROM ai_conversations WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    // Verify ownership (IDOR guard) — a user must not be able to read another
    // user's conversation history.
    const convResult = await pool.query(
      'SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    )
    if (convResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found' })
    }
    const result = await pool.query(
      'SELECT role, content, created_at FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    )
    res.json({ success: true, data: result.rows })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/socratic-hint', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' })
    }
    if (!await checkTokenBudget(req.user.id, 800)) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    const { questionText, options, studentAttempt, explanation, stepNumber, language } = req.body
    if (!questionText) {
      return res.status(400).json({ success: false, message: 'questionText is required' })
    }
    const result = await aiMentorService.getSocraticHint(req.user.id, {
      questionText,
      options,
      studentAttempt,
      explanation,
      stepNumber: parseInt(stepNumber) || 1,
      language: language || 'en',
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
