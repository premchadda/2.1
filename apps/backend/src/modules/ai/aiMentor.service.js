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

const AI_CONFIG = {
  model: process.env.AI_MODEL || 'gpt-4',
  provider: process.env.AI_PROVIDER || 'openrouter',
  apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY,
  baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
}

/**
 * Call AI API for chat completion.
 */
async function callAI(messages, options = {}) {
  const startTime = Date.now()

  try {
    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'HTTP-Referer': 'https://trstprep.com',
        'X-Title': 'TrstPrep AI Mentor',
      },
      body: JSON.stringify({
        model: options.model || AI_CONFIG.model,
        messages,
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

const aiMentorService = {
  /**
   * Generate a personalized study plan.
   */
  async generateStudyPlan(userId, options = {}) {
    const weakAreas = await weakAreaDetectionService.getFullAnalysis(userId)

    const systemPrompt = `You are an expert exam preparation mentor for Indian competitive exams (SSC, Railway, Banking, etc.).
Create a personalized study plan based on the student's performance analysis.
The plan should be practical, achievable, and focused on improving weak areas.
Include daily targets, weekly goals, and specific topics to focus on.`

    const userPrompt = `
Student Performance Analysis:
- Overall Accuracy: ${weakAreas.overallAccuracy}%
- Total Questions Attempted: ${weakAreas.totalQuestionsAttempted}

Weak Topics (sorted by accuracy):
${weakAreas.weakTopics.slice(0, 10).map((t, i) =>
  `${i + 1}. ${t.topicName} (${t.subjectName}) - ${t.accuracy}% accuracy, ${t.totalAttempts} attempts`
).join('\n')}

Subject Performance:
${weakAreas.weakSubjects.map(s =>
  `- ${s.subjectName}: ${s.accuracy}% accuracy`
).join('\n')}

Difficulty Performance:
${weakAreas.difficultyPerformance.map(d =>
  `- ${d.difficulty}: ${d.accuracy}% accuracy`
).join('\n')}

Create a ${options.days || 30}-day study plan that:
1. Focuses heavily on weak topics (topics with < 40% accuracy)
2. Includes daily practice targets
3. Suggests specific types of questions to practice
4. Includes revision schedules
5. Is realistic and achievable
`

    const aiResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

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
    const systemPrompt = `You are an expert educator helping students with their exam preparation doubts.
Provide clear, accurate, and helpful answers.
Include relevant concepts, formulas, or shortcuts when applicable.
Keep answers concise but comprehensive.`

    const userPrompt = `
Student's Doubt: ${question}

${context.topic ? `Topic: ${context.topic}` : ''}
${context.subject ? `Subject: ${context.subject}` : ''}
${context.previousQuestions ? `Recent practice questions: ${context.previousQuestions}` : ''}

Please provide a clear explanation to resolve this doubt.
`

    const aiResult = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

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
    ])

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
    ])

    return {
      tip: aiResult.text,
      relatedTopics: weakAreas.map(t => t.topicName),
    }
  },

  /**
   * Chat with AI mentor.
   */
  async chat(userId, message, history = []) {
    const systemPrompt = `You are TrstPrep AI Mentor, an expert in Indian competitive exam preparation.
You help students with:
- Subject doubts and concepts
- Exam strategy and time management
- Study planning and motivation
- Previous year question analysis

Be friendly, encouraging, and provide practical advice.
Keep responses concise but helpful.
If you don't know something, say so honestly.`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ]

    const aiResult = await callAI(messages)

    await AiGenerationLog.logSuccess({
      entityType: 'mentor_chat',
      entityId: userId,
      prompt: message.substring(0, 500),
      model: aiResult.model,
      provider: AI_CONFIG.provider,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      latencyMs: aiResult.latencyMs,
      metadata: {
        historyLength: history.length,
      },
      createdBy: userId,
    })

    return {
      response: aiResult.text,
      model: aiResult.model,
    }
  },
}

export default aiMentorService
