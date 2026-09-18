import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { aiRateLimiter } from '../../middleware/aiRateLimiter.js'
import aiMentorService, { sanitizeForPrompt } from './aiMentor.service.js'
import { callAIStream } from './aiClient.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

// Per-minute burst guard (second layer under the hourly aiRateLimiter).
// Redis is resolved lazily per call — a frozen global.redis snapshot would
// silently disable this the moment boot order changes.
// Fail-closed fallback: when Redis is unreachable the per-process Map below
// caps bursts locally (same shape as the checkTokenBudget fallback) instead
// of returning true (fail-open, which made the guard a no-op in a Redis
// outage). Redis remains authoritative; reconcile this Map against the
// ai:ratelimit:<user>:<minute> key during audits.
const minuteFallbackUsage = new Map()

function checkMinuteFallback(userId) {
  const bucket = Math.floor(Date.now() / 60000)
  const entry = minuteFallbackUsage.get(userId) || { count: 0, bucket }
  if (entry.bucket !== bucket) {
    entry.count = 0
    entry.bucket = bucket
  }
  entry.count += 1
  minuteFallbackUsage.set(userId, entry)
  return entry.count <= parseInt(process.env.AI_RATE_LIMIT_MAX || '10')
}

async function aiRateLimit(userId) {
  let redis = null
  try {
    const { getRedisClient } = await import(
      '../../infrastructure/cache/redisClient.js'
    )
    redis = getRedisClient()
  } catch {
    redis = global.redis || null
  }
  if (!redis) return checkMinuteFallback(userId)
  try {
    const key = `ai:ratelimit:${userId}:${Math.floor(Date.now() / 60000)}`
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, 60)
    }
    return count <= parseInt(process.env.AI_RATE_LIMIT_MAX || '10')
  } catch {
    return checkMinuteFallback(userId)
  }
}

// Minute-limit rejection: same envelope shape as the hourly limiter plus
// Retry-After (the old `{ error }` shape broke client error mapping).
function minuteLimitExceeded(res) {
  res.set('Retry-After', '60')
  return res.status(429).json({
    success: false,
    message: 'AI rate limit exceeded (burst guard). Please try again in a minute.',
    code: 'AI_MINUTE_RATE_LIMIT',
    retryAfter: 60,
  })
}

// Per-user token budget (Redis-authoritative; in-memory Map is a per-process
// fallback only). Pre-reserve an ESTIMATE (chars/4, min 100) per call — never
// a fixed 0 (which made the budget a no-op) or a fixed 1500 (which over-
// blocked short prompts).
const userTokenUsage = new Map()

const estimateTokens = (...parts) => {
  const chars = parts
    .map((p) => (typeof p === 'string' ? p.length : p ? String(p).length : 0))
    .reduce((n, c) => n + c, 0)
  return Math.max(100, Math.ceil(chars / 4))
}

// Circular-safe JSON.stringify for token-estimate inputs: req bodies and DB
// history rows can carry circular refs (or getters that throw), which would
// 500 the budget pre-check before the AI call even starts.
const safeJson = (value) => {
  try {
    return JSON.stringify(value ?? '')
  } catch {
    return '{}'
  }
}

const resolveBudgetRedis = async () => {
  try {
    const { getRedisClient } = await import(
      '../../infrastructure/cache/redisClient.js'
    )
    const client = getRedisClient()
    if (client && client.status === 'ready') return client
  } catch {
    /* fall through to fallback */
  }
  return global.redis || null
}

async function checkTokenBudget(userId, tokensRequested = 0, charge = true) {
  const limit = parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '50000')
  const todayStr = new Date().toDateString()
  const redis = await resolveBudgetRedis()

  if (redis) {
    try {
      const key = `ai:tokenbudget:${userId}:${todayStr}`
      const current = parseInt(await redis.get(key) || '0', 10)
      if (current + tokensRequested > limit) return false
      if (charge) {
        await redis.incrby(key, tokensRequested)
        await redis.expire(key, 36 * 3600) // 36 hours TTL
      }
      return true
    } catch (err) {
      const { default: budgetLogger } = await import(
        '../../infrastructure/logger/logger.js'
      ).catch(() => ({ default: console }))
      budgetLogger.error?.(
        { err },
        'Redis token budget error (falling back to per-process caps)',
      )
    }
  }

  const daily = userTokenUsage.get(userId) || { count: 0, date: todayStr }
  if (daily.date !== todayStr) {
    daily.count = 0
    daily.date = todayStr
  }
  if (daily.count + tokensRequested > limit) return false
  if (charge) {
    daily.count += tokensRequested
    userTokenUsage.set(userId, daily)
  }
  return true
}

function buildMessages(message, history = []) {
  const systemPrompt = `You are TrstPrep AI Mentor, an expert in Indian competitive exam preparation.
You help students with subject doubts, exam strategy, study planning, and motivation.
Be friendly, encouraging, and provide practical advice. Keep responses concise but helpful.`

  return [
    { role: 'system', content: systemPrompt },
    // Stored history is untrusted input — sanitize before replay (the
    // non-stream chat path in aiMentor.service does the same).
    ...history.map(h => ({
      role: ['user', 'assistant'].includes(h.role) ? h.role : 'user',
      content: sanitizeForPrompt(typeof h.content === 'string' ? h.content : ''),
    })),
    { role: 'user', content: sanitizeForPrompt(typeof message === 'string' ? message : '') },
  ]
}

router.post('/study-plan', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return minuteLimitExceeded(res)
    }
    const { days } = req.body
    if (!await checkTokenBudget(req.user.id, estimateTokens('study plan', days))) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
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
      return minuteLimitExceeded(res)
    }
    const { question, topic, subject } = req.body
    if (!await checkTokenBudget(req.user.id, estimateTokens(question, topic, subject))) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
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
      return minuteLimitExceeded(res)
    }
    const { examType } = req.body
    if (!await checkTokenBudget(req.user.id, estimateTokens(examType))) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    if (!examType) {
      return res.status(400).json({ success: false, message: 'examType is required' })
    }

    const result = await aiMentorService.generateExamStrategy(req.user.id, examType)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/daily-tip', protect, aiRateLimiter, async (req, res) => {
  try {
    if (!await aiRateLimit(req.user.id)) {
      return minuteLimitExceeded(res)
    }
    if (!await checkTokenBudget(req.user.id, estimateTokens('daily tip'))) {
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
      return minuteLimitExceeded(res)
    }
    const { message, conversationId } = req.body
    if (!await checkTokenBudget(req.user.id, estimateTokens(message))) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
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
      return minuteLimitExceeded(res)
    }
    const message = req.body.message || (Array.isArray(req.body.messages) ? req.body.messages[req.body.messages.length - 1]?.content : null)
    if (!await checkTokenBudget(req.user.id, estimateTokens(message, safeJson(req.body.messages).slice(0, 4000)))) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
    let { conversationId } = req.body
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' })
    }

    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    if (!conversationId) {
      const title = sanitizeForPrompt(String(message || '').substring(0, 50)).trim() || 'New Chat'
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
    const streamStart = Date.now()
    let streamClosed = false
    req.on('close', () => {
      streamClosed = true
      try { reader.cancel() } catch { /* best-effort */ }
    })

    while (true) {
      if (streamClosed) break
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

    // Debit actual tokens post-call + log stream usage (estimate ~4 chars/token)
    try {
      const { default: AiGenerationLog } = await import('../../data/models/ai/AiGenerationLog.js')
      const estTokens = Math.max(1, Math.ceil(assistantResponseText.length / 4))
      const estInput = estimateTokens(message, safeJson(history).slice(0, 8000))
      // Pre-call estimate already debited; reconcile actuals without a second
      // charge (charge=false) — usage is recorded via logSuccess below.
      await checkTokenBudget(req.user.id, estTokens, false)
      await AiGenerationLog.logSuccess({
        entityType: 'mentor_chat_stream',
        entityId: conversationId,
        model: process.env.AI_MODEL || 'gpt-4',
        provider: process.env.AI_PROVIDER || 'openrouter',
        tokensInput: estInput,
        tokensOutput: estTokens,
        latencyMs: Date.now() - streamStart,
        metadata: { stream: true },
        createdBy: req.user.id,
      }).catch(() => {})
    } catch {
      /* usage logging is best-effort */
    }

    res.end()
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.status || 500).json({ success: false, message: sanitizeErrorMessage(error) })
    } else {
      try { res.end() } catch { /* best-effort */ }
    }
  }
})

router.get('/conversations', protect, aiRateLimiter, async (req, res) => {
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

router.get('/conversations/:id/messages', protect, aiRateLimiter, async (req, res) => {
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
      return minuteLimitExceeded(res)
    }
    const { questionText, options, studentAttempt, explanation, stepNumber, language } = req.body
    if (!await checkTokenBudget(req.user.id, estimateTokens(questionText, safeJson(options), studentAttempt, explanation))) {
      return res.status(429).json({ success: false, error: 'Daily token budget exceeded.' })
    }
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
