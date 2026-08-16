/**
 * AI Mentor Service
 *
 * Provides personalized AI-powered mentoring:
 * - Study plan generation
 * - Performance analysis
 * - Personalized recommendations
 * - doubt resolution
 * - Exam strategy advice
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'
import weakAreaDetectionService from '../analytics/weakAreaDetection.service.js'
import AiGenerationLog from '../../data/models/ai/AiGenerationLog.js'
import { AI_CONFIG, callAIWithFallback } from './aiClient.js'
import AICache from './aiCache.js'

async function getPromptTemplate(name, defaultSystem, defaultUser) {
  try {
    const result = await pool.query(
      'SELECT system_prompt, user_prompt_template FROM prompt_templates WHERE name = $1 LIMIT 1',
      [name]
    )
    if (result.rows.length > 0) {
      return {
        systemPrompt: result.rows[0].system_prompt,
        userPromptTemplate: result.rows[0].user_prompt_template
      }
    }
  } catch (err) {
    console.warn('[AI Prompt] Failed to load prompt from DB, using defaults:', err.message)
  }
  return { systemPrompt: defaultSystem, userPromptTemplate: defaultUser }
}

// Shared AI cache — uses Redis when available, otherwise no-op
const aiCache = new AICache(global.redis)

// Token budget tracking (in-memory; use Redis in production)
const userTokenUsage = new Map()

function checkTokenBudget(userId, tokensRequested) {
  const daily = userTokenUsage.get(userId) || { count: 0, date: new Date().toDateString() }
  if (daily.date !== new Date().toDateString()) {
    daily.count = 0
    daily.date = new Date().toDateString()
  }
  const limit = parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '50000')
  if (daily.count + tokensRequested > limit) {
    return false
  }
  daily.count += tokensRequested
  userTokenUsage.set(userId, daily)
  return true
}

// Sanitize user input to prevent prompt injection
const sanitizeForPrompt = (input) => {
  if (!input || typeof input !== 'string') return ''
  // Remove potential injection patterns
  return input
    .replace(/system\s*:/gi, '[USER]')
    .replace(/ignore\s*(all\s*)?(previous|above|prior)\s*(instructions?|prompts?)/gi, '[USER_INPUT]')
    .substring(0, 2000) // Limit length
}

/**
 * Call AI API for chat completion with cache + fallback.
 */
async function callAI(messages, options = {}) {
  // Check cache first
  const cached = await aiCache.get(messages, options.model || AI_CONFIG.model)
  if (cached) return cached

  // Check token budget before calling API
  const tokensRequested = options.maxTokens || AI_CONFIG.maxTokens
  if (!checkTokenBudget(options.userId || 'anonymous', tokensRequested)) {
    throw { message: 'Daily token budget exceeded. Please try again tomorrow.', latencyMs: 0 }
  }

  try {
    const result = await callAIWithFallback(messages, options)
    // Cache successful response
    await aiCache.set(messages, options.model || AI_CONFIG.model, result)
    return result
  } catch (error) {
    const latencyMs = error.latencyMs || 0
    throw {
      message: error.message,
      latencyMs,
    }
  }
}

const aiMentorService = {
  /**
   * Generate a personalized study plan.
   */
  async generateStudyPlan(userId, options = {}) {
    const weakAreas = await weakAreaDetectionService.getFullAnalysis(userId)

    const promptTemplate = await getPromptTemplate(
      'study_plan',
      'You are an expert exam preparation mentor for Indian competitive exams (SSC, Railway, Banking, etc.). Create a personalized study plan based on the student\'s performance analysis. The plan should be practical, achievable, and focused on improving weak areas. Include daily targets, weekly goals, and specific topics to focus on.',
      `Student Performance Analysis:
- Overall Accuracy: {{overallAccuracy}}%
- Total Questions Attempted: {{totalQuestionsAttempted}}

Weak Topics (sorted by accuracy):
{{weakTopics}}

Subject Performance:
{{subjectPerformance}}

Difficulty Performance:
{{difficultyPerformance}}

Create a {{days}}-day study plan that:
1. Focuses heavily on weak topics (topics with < 40% accuracy)
2. Includes daily practice targets
3. Suggests specific types of questions to practice
4. Includes revision schedules
5. Is realistic and achievable`
    )

    const weakTopicsText = weakAreas.weakTopics.slice(0, 10).map((t, i) =>
      `${i + 1}. ${t.topicName} (${t.subjectName}) - ${t.accuracy}% accuracy, ${t.totalAttempts} attempts`
    ).join('\n')

    const subjectPerformanceText = weakAreas.weakSubjects.map(s =>
      `- ${s.subjectName}: ${s.accuracy}% accuracy`
    ).join('\n')

    const difficultyPerformanceText = weakAreas.difficultyPerformance.map(d =>
      `- ${d.difficulty}: ${d.accuracy}% accuracy`
    ).join('\n')

    const userPrompt = promptTemplate.userPromptTemplate
      .replace('{{overallAccuracy}}', weakAreas.overallAccuracy)
      .replace('{{totalQuestionsAttempted}}', weakAreas.totalQuestionsAttempted)
      .replace('{{weakTopics}}', weakTopicsText)
      .replace('{{subjectPerformance}}', subjectPerformanceText)
      .replace('{{difficultyPerformance}}', difficultyPerformanceText)
      .replace('{{days}}', options.days || 30)

    const aiResult = await callAI([
      { role: 'system', content: promptTemplate.systemPrompt },
      { role: 'user', content: userPrompt },
    ], { userId, model: options.model || 'gpt-4' })

    await AiGenerationLog.logSuccess({
      entityType: 'study_plan',
      entityId: userId,
      prompt: userPrompt.substring(0, 1000),
      model: aiResult.model,
      provider: AI_CONFIG.provider,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      latencyMs: aiResult.latencyMs,
      metadata: {
        days: options.days || 30,
        weakTopicsCount: weakAreas.weakTopics.length,
      },
      createdBy: userId,
    })

    return {
      studyPlan: aiResult.text,
      weakAreas: weakAreas.weakTopics.slice(0, 5),
      model: aiResult.model,
    }
  },

  /**
   * Answer a study doubt.
   */
  async answerDoubt(userId, question, context = {}) {
    // Retrieve GIN tsvector full-text-search context from index
    let contextText = ''
    try {
      const { ragService } = await import('./rag.service.js')
      contextText = await ragService.retrieveContext(question)
    } catch (ragError) {
      console.warn('[RAG] Failed to retrieve context for doubt resolution:', ragError.message)
    }

    const systemPrompt = `You are an expert educator helping students with their exam preparation doubts.
Provide clear, accurate, and helpful answers.
Include relevant concepts, formulas, or shortcuts when applicable.
Keep answers concise but comprehensive.`

    const sanitizedQuestion = sanitizeForPrompt(question)
    const userPrompt = `
${contextText ? `Relevant Course Material Reference:\n${contextText}\n\n` : ''}
Student's Doubt: ${sanitizedQuestion}

${context.topic ? `Topic: ${context.topic}` : ''}
${context.subject ? `Subject: ${context.subject}` : ''}
${context.previousQuestions ? `Recent practice questions: ${context.previousQuestions}` : ''}

Please provide a clear explanation to resolve this doubt.
`

    const aiResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { userId, model: context.model || 'gpt-3.5-turbo' })

    await AiGenerationLog.logSuccess({
      entityType: 'doubt_resolution',
      entityId: userId,
      prompt: userPrompt.substring(0, 1000),
      model: aiResult.model,
      provider: AI_CONFIG.provider,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      latencyMs: aiResult.latencyMs,
      metadata: {
        topic: context.topic,
        subject: context.subject,
        hasRAGContext: !!contextText
      },
      createdBy: userId,
    })

    return {
      answer: aiResult.text,
      model: aiResult.model,
    }
  },

  /**
   * Generate exam strategy advice.
   */
  async generateExamStrategy(userId, examType, options = {}) {
    const weakAreas = await weakAreaDetectionService.getFullAnalysis(userId)

    const systemPrompt = `You are an expert exam strategist for Indian competitive exams.
Analyze the student's performance and provide a strategic approach for the exam.
Include time management tips, question selection strategy, and revision approach.`

    const userPrompt = `
Exam Type: ${examType}
Student's Performance:
- Overall Accuracy: ${weakAreas.overallAccuracy}%
- Strong Areas: ${weakAreas.weakSubjects.filter(s => s.accuracy >= 60).map(s => s.subjectName).join(', ') || 'None identified'}
- Weak Areas: ${weakAreas.weakSubjects.filter(s => s.accuracy < 60).map(s => s.subjectName).join(', ') || 'None identified'}

Difficulty Performance:
${weakAreas.difficultyPerformance.map(d =>
  `- ${d.difficulty}: ${d.accuracy}% accuracy, avg time: ${d.avgTime}s`
).join('\n')}

Provide exam strategy including:
1. Time allocation per section
2. Question selection priority
3. Topics to attempt first
4. Topics to avoid if time is short
5. Revision strategy in last 10 minutes
6. Common pitfalls to avoid
`

    const aiResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { userId, model: options.model || 'gpt-4' })

    await AiGenerationLog.logSuccess({
      entityType: 'exam_strategy',
      entityId: userId,
      prompt: userPrompt.substring(0, 1000),
      model: aiResult.model,
      provider: AI_CONFIG.provider,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      latencyMs: aiResult.latencyMs,
      metadata: {
        examType,
        overallAccuracy: weakAreas.overallAccuracy,
      },
      createdBy: userId,
    })

    return {
      strategy: aiResult.text,
      examType,
      model: aiResult.model,
    }
  },

  /**
   * Get personalized daily tips.
   */
  async getDailyTip(userId) {
    const weakAreas = await weakAreaDetectionService.getWeakTopics(userId, { limit: 3 })

    const systemPrompt = `You are a friendly exam preparation mentor.
Provide a concise, actionable daily tip to help improve the student's preparation.
The tip should be specific and related to their weak areas.`

    const userPrompt = `
Student's weakest topics:
${weakAreas.map((t, i) => `${i + 1}. ${t.topicName} (${t.accuracy}% accuracy)`).join('\n')}

Provide one specific, actionable tip for today that addresses one of these weak areas.
Keep it under 100 words.
`

    const aiResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { userId, model: 'gpt-3.5-turbo' })

    return {
      tip: aiResult.text,
      relatedTopics: weakAreas.map(t => t.topicName),
    }
  },

  async chat(userId, message, conversationId = null) {
    let activeConversationId = conversationId

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (!activeConversationId) {
        // Create new conversation
        const title = message.substring(0, 50).trim() || 'New Chat'
        const convResult = await client.query(
          'INSERT INTO ai_conversations (user_id, title) VALUES ($1, $2) RETURNING id',
          [userId, title]
        )
        activeConversationId = convResult.rows[0].id
      }

      // Fetch history from DB if conversation exists
      const msgsResult = await client.query(
        'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
        [activeConversationId]
      )
      const history = msgsResult.rows

      // Save user message to database
      await client.query(
        'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [activeConversationId, 'user', message]
      )

      await client.query('COMMIT')

      const promptTemplate = await getPromptTemplate(
        'ai_mentor',
        'You are TrstPrep AI Mentor, an expert in Indian competitive exam preparation. You help students with subject doubts, exam strategy, study planning, and motivation. Be friendly, encouraging, and provide practical advice. Keep responses concise but helpful.',
        '{{message}}'
      )

      const messages = [
        { role: 'system', content: promptTemplate.systemPrompt },
        ...history.map(h => ({
          role: h.role,
          content: h.content,
        })),
        { role: 'user', content: sanitizeForPrompt(message) },
      ]

      const aiResult = await callAI(messages, { userId, model: 'gpt-3.5-turbo' })

      // Save assistant response to database
      await pool.query(
        'INSERT INTO ai_messages (conversation_id, role, content, tokens) VALUES ($1, $2, $3, $4)',
        [activeConversationId, 'assistant', aiResult.text, aiResult.tokensInput + aiResult.tokensOutput]
      )

      await AiGenerationLog.logSuccess({
        entityType: 'mentor_chat',
        entityId: activeConversationId,
        prompt: message.substring(0, 500),
        model: aiResult.model,
        provider: AI_CONFIG.provider,
        tokensInput: aiResult.tokensInput,
        tokensOutput: aiResult.tokensOutput,
        latencyMs: aiResult.latencyMs,
        metadata: {
          conversationId: activeConversationId,
          historyLength: history.length,
        },
        createdBy: userId,
      })

      return {
        response: aiResult.text,
        conversationId: activeConversationId,
        model: aiResult.model,
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Socratic Step-by-Step AI Guidance for practice and test questions.
   */
  async getSocraticHint(userId, { questionText, options = [], studentAttempt = '', explanation = '', stepNumber = 1, language = 'en' } = {}) {
    const safeStep = Math.min(Math.max(parseInt(stepNumber) || 1, 1), 3)
    const systemPrompt = `You are an elite Socratic tutor for competitive exams.
Your purpose is to guide the student to discover the answer themselves through structured step-by-step thinking rather than immediately giving the final answer.
- Step 1: Identify the underlying core theorem, definition, or formula required without revealing the arithmetic solution.
- Step 2: Break down the first intermediate deduction or equation setup. If the student made an attempt, gently point out what assumption went wrong.
- Step 3: Provide full structured steps with a closing check-question for the student to verify their final choice.
Format equations clearly using standard LaTeX ($...$ for inline, $$...$$ for block).
Language: ${language === 'hi' ? 'Hindi / Hinglish' : 'English'}. Keep responses encouraging, concise, and pedagogical.`

    const userPrompt = `
Question: ${sanitizeForPrompt(questionText)}
${options && options.length ? `Options:\n${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}` : ''}
${studentAttempt ? `Student's Thought/Attempt: ${sanitizeForPrompt(studentAttempt)}` : ''}
${explanation ? `Reference Solution: ${sanitizeForPrompt(explanation)}` : ''}

Requested Guidance Level: Step ${safeStep} of 3
Provide the Step ${safeStep} Socratic hint now.
`

    const aiResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { userId, model: 'gpt-4o-mini', maxTokens: 800 })

    await AiGenerationLog.logSuccess({
      entityType: 'socratic_hint',
      entityId: userId,
      prompt: userPrompt.substring(0, 500),
      model: aiResult.model,
      provider: AI_CONFIG.provider,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      latencyMs: aiResult.latencyMs,
      metadata: { stepNumber: safeStep, language },
      createdBy: userId,
    })

    return {
      hint: aiResult.text,
      stepNumber: safeStep,
      model: aiResult.model,
    }
  },
}

export default aiMentorService
