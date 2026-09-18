/**
 * Shared AI Client
 *
 * Centralized AI API client with:
 * - Primary + fallback provider support
 * - Streaming support
 * - Configurable via environment variables
 */

const AI_CONFIG = {
  baseUrl: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY,
  model: process.env.AI_MODEL || "gpt-4",
  provider: process.env.AI_PROVIDER || "openrouter",
  maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
};

const FALLBACK_CONFIG = {
  baseUrl: process.env.AI_FALLBACK_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.AI_FALLBACK_API_KEY,
  model: process.env.AI_FALLBACK_MODEL || "gpt-3.5-turbo",
  provider: process.env.AI_FALLBACK_PROVIDER || "openai",
};

const HEADERS = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://trstprep.com",
  "X-Title": "TrstPrep AI",
};

function isContentToxic(text) {
  if (!text || typeof text !== "string") return false;
  const toxicPatterns = [
    /\b(fuck|bitch|asshole|idiot|stupid)\b/i,
    /system\s*prompt/i,
    /ignore\s*(all\s*)?(previous|above|prior)\s*(instructions?|prompts?)/i,
    /reveal\s*(your\s*)?system\s*instructions/i,
    // Common jailbreak markers (input side; output side still scanned too).
    /\b(dan\s*mode|developer\s*mode|jailbreak|do\s*anything\s*now)\b/i,
    /you\s*are\s*now\s*(dan|unfiltered|unrestricted)/i,
    /pretend\s*(you\s*are|to\s*be)\s*(dan|evil|unfiltered)/i,
    /base64\s*(decode|-)?.{0,20}(instruction|prompt|system)/i,
    // Hindi/Hinglish equivalents of "ignore previous instructions".
    /pichhle\s*(nirdesh|sabhi\s*nirdesh)/i,
    /sabhi\s*pichhle\s*nirdesh/i,
  ];
  return toxicPatterns.some((pattern) => pattern.test(text));
}

const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function postChatCompletions(
  url,
  apiKey,
  body,
  { timeoutMs = 30000, retries = 1 } = {},
) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: { ...HEADERS, Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (networkErr) {
      // Network/timeout errors are transient — retry once, then throw.
      lastError = new Error(
        `AI request failed: ${networkErr?.message || networkErr}`,
      );
      lastError.status = 0;
      if (attempt < retries) await sleep(500 * (attempt + 1));
      continue;
    }
    if (response.ok) return response;
    const errBody = await response.text().catch(() => "");
    const err = new Error(
      `AI API error: ${response.status}${errBody ? ` - ${errBody.slice(0, 500)}` : ""}`,
    );
    err.status = response.status;
    lastError = err;
    if (!TRANSIENT_STATUSES.has(response.status) || attempt >= retries)
      throw err;
    const backoff = response.status === 429 ? 1000 : 500 * (attempt + 1);
    await sleep(backoff);
  }
  throw lastError;
}

async function callAI(messages, options = {}) {
  // Input moderation check
  for (const msg of messages) {
    if (isContentToxic(msg.content)) {
      throw new Error("Input content failed moderation policies");
    }
  }

  const startTime = Date.now();
  const config = { ...AI_CONFIG, ...options };

  if (!config.apiKey) {
    throw new Error(
      "AI API key is not configured (set AI_API_KEY or OPENROUTER_API_KEY)",
    );
  }

  const response = await postChatCompletions(config.baseUrl, config.apiKey, {
    model: config.model,
    messages,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream: options.stream || false,
  });

  if (options.stream) {
    return response;
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  // Fail closed on provider error-shapes: some OpenRouter models omit
  // choices/usage on errors — an empty/whitespace-only string must not count
  // as success (it would log zero tokens and never consume budget).
  const choice = data?.choices?.[0];
  if (
    !choice?.message ||
    typeof choice.message.content !== "string" ||
    !choice.message.content.trim()
  ) {
    const err = new Error(
      `AI API returned no content (model: ${data?.model || config.model})`,
    );
    err.status = 502;
    throw err;
  }
  const text = choice.message.content;

  // Output moderation check
  if (isContentToxic(text)) {
    throw new Error("Output content failed moderation policies");
  }

  return {
    text,
    model: data.model,
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0,
    latencyMs,
  };
}

async function callAIStream(messages, options = {}) {
  // Moderation check before streaming
  for (const msg of messages) {
    if (isContentToxic(msg.content)) {
      throw new Error("Input content failed moderation policies");
    }
  }
  return callAI(messages, { ...options, stream: true });
}

async function callAIWithFallback(messages, options = {}) {
  try {
    return await callAI(messages, options);
  } catch (primaryError) {
    if (primaryError.message?.includes("moderation")) {
      throw primaryError;
    }
    // No fallback credentials → the "fallback" would be a guaranteed
    // `Bearer undefined` failure. Fail fast with both statuses preserved.
    if (!FALLBACK_CONFIG.apiKey) {
      console.warn(
        "Primary AI provider failed, no fallback key configured:",
        primaryError.message,
      );
      const err = new Error(
        `AI service unavailable (primary: ${primaryError.status || "error"} ${primaryError.message})`,
      );
      err.status = primaryError.status || 503;
      err.primaryError = primaryError.message;
      throw err;
    }
    // Equality guard: a fallback identical to the primary (same URL+model+key)
    // would just replay the same failure and double spend/latency — fail fast
    // with the primary error text preserved.
    try {
      const sameUrl =
        (FALLBACK_CONFIG.baseUrl || "") === (AI_CONFIG.baseUrl || "");
      const sameModel =
        (FALLBACK_CONFIG.model || "") ===
        (options.model || AI_CONFIG.model || "");
      const sameKey =
        (FALLBACK_CONFIG.apiKey || "") ===
        (options.apiKey || AI_CONFIG.apiKey || "");
      if (sameUrl && sameModel && sameKey) {
        const err = new Error(
          `AI service unavailable (primary: ${primaryError.status || "error"} ${primaryError.message})`,
        );
        err.status = primaryError.status || 503;
        err.primaryError = primaryError.message;
        throw err;
      }
    } catch (guardErr) {
      if (guardErr?.primaryError) throw guardErr;
      // fall through to fallback attempt when the guard itself errors
    }
    console.warn(
      "Primary AI provider failed, trying fallback:",
      primaryError.message,
    );
    try {
      return await callAI(messages, {
        ...options,
        ...FALLBACK_CONFIG,
        provider: FALLBACK_CONFIG.provider,
      });
    } catch (fallbackError) {
      if (fallbackError.message?.includes("moderation")) {
        throw fallbackError;
      }
      const err = new Error(
        `AI service unavailable (primary: ${primaryError.status || "?"} ${primaryError.message} | fallback: ${fallbackError.status || "?"} ${fallbackError.message})`,
      );
      err.status = fallbackError.status || primaryError.status || 503;
      err.primaryStatus = primaryError.status || null;
      err.fallbackStatus = fallbackError.status || null;
      throw err;
    }
  }
}

async function generateEmbedding(text, options = {}) {
  const config = { ...AI_CONFIG, ...options };
  if (!config.apiKey) {
    throw new Error(
      "AI API key is not configured (set AI_API_KEY or OPENROUTER_API_KEY)",
    );
  }
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      ...HEADERS,
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: options.model || "text-embedding-3-small",
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Embedding API error: ${response.status}${errBody ? ` - ${errBody.slice(0, 500)}` : ""}`,
    );
  }

  const data = await response.json();
  // Fail closed on provider error-shapes (missing data[0] is an error
  // payload, not an empty embedding) — callers must not persist [].
  const embedding = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(
      `Embedding API returned no vector (model: ${options.model || "text-embedding-3-small"})`,
    );
  }
  return embedding;
}

export {
  AI_CONFIG,
  FALLBACK_CONFIG,
  callAI,
  callAIStream,
  callAIWithFallback,
  generateEmbedding,
  isContentToxic,
};
