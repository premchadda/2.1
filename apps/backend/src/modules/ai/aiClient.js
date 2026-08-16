/**
 * Shared AI Client
 *
 * Centralized AI API client with:
 * - Primary + fallback provider support
 * - Streaming support
 * - Configurable via environment variables
 */

const AI_CONFIG = {
  baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY,
  model: process.env.AI_MODEL || 'gpt-4',
  provider: process.env.AI_PROVIDER || 'openrouter',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
}

const FALLBACK_CONFIG = {
  baseUrl: process.env.AI_FALLBACK_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.AI_FALLBACK_API_KEY,
  model: process.env.AI_FALLBACK_MODEL || 'gpt-3.5-turbo',
  provider: process.env.AI_FALLBACK_PROVIDER || 'openai',
}

const HEADERS = {
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://trstprep.com',
  'X-Title': 'TrstPrep AI',
}

function isContentToxic(text) {
  if (!text || typeof text !== 'string') return false
  const toxicPatterns = [
    /\b(fuck|bitch|asshole|idiot|stupid)\b/i,
    /system\s*prompt/i, 
    /ignore\s*(all\s*)?(previous|above|prior)\s*(instructions?|prompts?)/i,
    /reveal\s*(your\s*)?system\s*instructions/i
  ]
  return toxicPatterns.some(pattern => pattern.test(text))
}

async function callAI(messages, options = {}) {
  // Input moderation check
  for (const msg of messages) {
    if (isContentToxic(msg.content)) {
      throw new Error('Input content failed moderation policies')
    }
  }

  const startTime = Date.now()
  const config = { ...AI_CONFIG, ...options }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: options.stream || false,
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  if (options.stream) {
    return response
  }

  const data = await response.json()
  const latencyMs = Date.now() - startTime
  const text = data.choices[0]?.message?.content || ''

  // Output moderation check
  if (isContentToxic(text)) {
    throw new Error('Output content failed moderation policies')
  }

  return {
    text,
    model: data.model,
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0,
    latencyMs,
  }
}

async function callAIStream(messages, options = {}) {
  // Moderation check before streaming
  for (const msg of messages) {
    if (isContentToxic(msg.content)) {
      throw new Error('Input content failed moderation policies')
    }
  }
  return callAI(messages, { ...options, stream: true })
}

async function callAIWithFallback(messages, options = {}) {
  try {
    return await callAI(messages, options)
  } catch (primaryError) {
    if (primaryError.message?.includes('moderation')) {
      throw primaryError
    }
    console.warn('Primary AI provider failed, trying fallback:', primaryError.message)
    try {
      return await callAI(messages, {
        ...options,
        ...FALLBACK_CONFIG,
        provider: FALLBACK_CONFIG.provider,
      })
    } catch (fallbackError) {
      if (fallbackError.message?.includes('moderation')) {
        throw fallbackError
      }
      throw new Error('AI service unavailable')
    }
  }
}

async function generateEmbedding(text, options = {}) {
  const config = { ...AI_CONFIG, ...options }
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: options.model || 'text-embedding-3-small'
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.data[0]?.embedding || []
}

export { AI_CONFIG, FALLBACK_CONFIG, callAI, callAIStream, callAIWithFallback, generateEmbedding, isContentToxic }
