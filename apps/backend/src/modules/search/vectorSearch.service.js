/**
 * Vector Search Service
 *
 * Provides semantic search using vector embeddings:
 * - Generate embeddings for questions
 * - Similar question search
 * - Topic-based recommendations
 * - Search indexing management
 */

import { pool } from "../../infrastructure/database/postgres-helpers.js";
import QuestionSearchIndex from "../../data/models/search/QuestionSearchIndex.js";
import AiGenerationLog from "../../data/models/ai/AiGenerationLog.js";
import logger from "../../infrastructure/logger/logger.js";

const VECTOR_CONFIG = {
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION) || 1536,
  batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 20,
  // Unified with embeddingService: AI_API_KEY || OPENROUTER_API_KEY ||
  // OPENAI_API_KEY; baseUrl AI_BASE_URL || openrouter (26).
  apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  baseUrl: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
};

/**
 * Fail closed on provider error-shapes and assert vector dimension BEFORE
 * any INSERT (pgvector rejects mismatched dims with a raw DB error).
 */
const assertEmbeddingVector = (vec) => {
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error("Embedding API returned no vector");
  }
  if (vec.length !== VECTOR_CONFIG.embeddingDimension) {
    throw new Error(
      `Embedding dimension mismatch: got ${vec.length}, expected ${VECTOR_CONFIG.embeddingDimension} (pgvector column; align EMBEDDING_MODEL with EMBEDDING_DIMENSION)`,
    );
  }
  return vec;
};

const TRANSIENT_EMBEDDING_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolved per call (not at module load) so key rotation and late-bound
// test envs take effect without a restart. Unified with embeddingService (26).
const resolveVectorKey = () =>
  VECTOR_CONFIG.apiKey ||
  process.env.AI_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.OPENAI_API_KEY;

/**
 * Generate embedding for text using OpenAI-compatible API.
 * Retry/timeout mirrors postChatCompletions (aiClient.js): 30s timeout,
 * 1 retry, extended backoff on 429. Accepts { timeoutMs, retries } passthrough (1).
 */
async function generateEmbedding(text, options = {}) {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 30000;
  const retries = options.retries ?? 1;

  if (!text || typeof text !== "string") {
    throw new Error("Text is required for embedding generation");
  }
  const apiKey = resolveVectorKey();
  if (!apiKey) {
    throw new Error(
      "Embedding API key is not configured (set AI_API_KEY or OPENROUTER_API_KEY or OPENAI_API_KEY)",
    );
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${VECTOR_CONFIG.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: VECTOR_CONFIG.embeddingModel,
          input: text.substring(0, 8000),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response || !response.ok) {
        const errBody = response ? await response.text().catch(() => "") : "";
        const status = response?.status || 500;
        const err = new Error(
          `Embedding API error: ${status}${errBody ? ` - ${String(errBody).slice(0, 300)}` : ""}`,
        );
        err.status = status;
        lastError = err;
        if (!TRANSIENT_EMBEDDING_STATUSES.has(status) || attempt >= retries) throw err;
        await sleep(status === 429 ? 1000 : 500 * (attempt + 1));
        continue;
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        embedding: assertEmbeddingVector(data?.data?.[0]?.embedding),
        // Zero-token fallback mirrors embeddingService: chars/4 estimate (17).
        tokens:
          data?.usage?.total_tokens ||
          Math.max(1, Math.ceil(String(text || "").length / 4)),
        latencyMs,
      };
    } catch (error) {
      const isNetwork = !error?.status || error.status === 0;
      lastError = error;
      if (isNetwork && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      const latencyMs = Date.now() - startTime;
      const err = new Error(error.message || "Embedding generation failed");
      err.latencyMs = latencyMs;
      err.status = error.status;
      throw err;
    }
  }
  const latencyMs = Date.now() - startTime;
  const err = new Error(lastError?.message || "Embedding generation failed");
  err.latencyMs = latencyMs;
  err.status = lastError?.status;
  throw err;
}

const vectorSearchService = {
  /**
   * Index a single question.
   */
  async indexQuestion(questionId) {
    const entry = await QuestionSearchIndex.upsertFromQuestion(questionId);
    if (!entry) return null;

    // Build text for embedding
    const searchText = await QuestionSearchIndex.buildSearchText(questionId);
    if (!searchText) return entry;

    try {
      const result = await generateEmbedding(searchText);

      await QuestionSearchIndex.setEmbedding(questionId, result.embedding);

      await AiGenerationLog.logSuccess({
        entityType: "embedding",
        entityId: questionId,
        model: VECTOR_CONFIG.embeddingModel,
        provider: "openai",
        tokensInput: result.tokens || Math.max(1, Math.ceil(searchText.length / 4)),
        tokensOutput: 0,
        latencyMs: result.latencyMs,
        metadata: {
          textLength: searchText.length,
          dimension: VECTOR_CONFIG.embeddingDimension,
        },
      });

      return {
        ...entry,
        embeddingGenerated: true,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      logger.error(
        { err: error, questionId },
        `Failed to generate embedding for question ${questionId}`,
      );
      // Log the failure so the backlog is visible (the row stays
      // is_indexed=false for retry — but silent rows never drain).
      try {
        await AiGenerationLog.logFailure({
          entityType: "vector_index",
          entityId: questionId,
          model: VECTOR_CONFIG.embeddingModel,
          provider: "openai",
          errorMessage: error?.message || "Embedding generation failed",
          metadata: { latencyMs: error?.latencyMs || 0 },
        });
      } catch {
        /* failure logging is best-effort */
      }
      return entry;
    }
  },

  /**
   * Index multiple questions in batch.
   */
  async indexBatch(questionIds) {
    const results = {
      total: questionIds.length,
      indexed: 0,
      embeddingGenerated: 0,
      failed: 0,
      errors: [],
    };

    for (const questionId of questionIds) {
      try {
        const entry = await this.indexQuestion(questionId);
        results.indexed++;
        if (entry?.embeddingGenerated) {
          results.embeddingGenerated++;
        } else {
          // Row upserted but the embedding call failed (logged in
          // indexQuestion) — surface it as failed so the backlog is visible.
          results.failed++;
          results.errors.push({
            questionId,
            message: "Embedding generation failed",
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          questionId,
          message: error.message || "Indexing failed",
        });
      }
    }

    return results;
  },

  /**
   * Index all unindexed questions (cursor-paginated by id so repeat runs
   * drain the tail instead of re-scanning the same head page).
   * Accepts afterId/maxPages passthrough from the route (15); bounded to
   * maxPages × limit per invocation.
   */
  async indexAllUnindexed(limit = 100, afterId = null, maxPages = 10) {
    const aggregate = {
      total: 0,
      indexed: 0,
      embeddingGenerated: 0,
      failed: 0,
      errors: [],
    };
    let cursor = afterId;
    const pages = Math.max(1, parseInt(maxPages) || 10);
    for (let page = 0; page < pages; page++) {
      const unindexed = await QuestionSearchIndex.findUnindexed(limit, cursor);
      if (!unindexed || unindexed.length === 0) break;
      const questionIds = unindexed.map((entry) => entry.question_id);
      const batch = await this.indexBatch(questionIds);
      aggregate.total += batch.total;
      aggregate.indexed += batch.indexed;
      aggregate.embeddingGenerated += batch.embeddingGenerated;
      aggregate.failed += batch.failed;
      aggregate.errors.push(...batch.errors);
      cursor = unindexed[unindexed.length - 1]?.question_id ?? cursor;
      if (unindexed.length < limit) break;
    }
    return aggregate;
  },

  /**
   * Search for similar questions using vector similarity.
   */
  async findSimilar(questionId, options = {}) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      // Get the embedding for the query question
      const questionEntry = await client.query(
        `SELECT embedding FROM question_search_index WHERE question_id = $1`,
        [questionId],
      );

      if (questionEntry.rows.length === 0 || !questionEntry.rows[0].embedding) {
        throw new Error("Question not indexed or embedding not generated");
      }

      const embedding = questionEntry.rows[0].embedding;
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.7;

      const result = await client.query(
        `
        SELECT
          qsi.question_id,
          q.question_text,
          q.difficulty,
          q.options,
          1 - (qsi.embedding <=> $1::vector) as similarity
        FROM question_search_index qsi
        JOIN questions q ON q.id = qsi.question_id
        WHERE qsi.question_id != $2
          AND qsi.embedding IS NOT NULL
          AND 1 - (qsi.embedding <=> $1::vector) >= $3
          AND q.is_active = true
        ORDER BY qsi.embedding <=> $1::vector
        LIMIT $4
      `,
        [JSON.stringify(embedding), questionId, threshold, limit],
      );

      return result.rows.map((row) => ({
        questionId: row.question_id,
        questionText: row.question_text,
        difficulty: row.difficulty,
        options: row.options,
        similarity: parseFloat(row.similarity),
      }));
    } finally {
      client.release();
    }
  },

  /**
   * Semantic search using text query.
   */
  async semanticSearch(queryText, options = {}) {
    const startTime = Date.now();

    try {
      // Generate embedding for query
      const queryEmbedding = await generateEmbedding(queryText);

      const { pool } =
        await import("../../infrastructure/database/postgres-helpers.js");
      const client = await pool.connect();

      try {
        const limit = options.limit || 20;
        const threshold = options.threshold || 0.6;

        let sql = `
          SELECT
            qsi.question_id,
            q.question_text,
            q.difficulty,
            q.options,
            t.name as topic_name,
            s.name as subject_name,
            1 - (qsi.embedding <=> $1::vector) as similarity
          FROM question_search_index qsi
          JOIN questions q ON q.id = qsi.question_id
          LEFT JOIN subject_topics t ON t.id = q.topic_id
          LEFT JOIN subjects s ON s.id = t.subject_id
          WHERE qsi.embedding IS NOT NULL
            AND 1 - (qsi.embedding <=> $1::vector) >= $2
            AND q.is_active = true
        `;
        const params = [JSON.stringify(queryEmbedding.embedding), threshold];
        let paramIndex = 3;

        if (options.difficulty) {
          sql += ` AND q.difficulty = $${paramIndex}`;
          params.push(options.difficulty);
          paramIndex++;
        }

        if (options.topicId) {
          sql += ` AND q.topic_id = $${paramIndex}`;
          params.push(options.topicId);
          paramIndex++;
        }

        if (options.subject) {
          sql += ` AND s.name ILIKE $${paramIndex}`;
          params.push(`%${options.subject}%`);
          paramIndex++;
        }

        sql += ` ORDER BY qsi.embedding <=> $1::vector LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await client.query(sql, params);

        await AiGenerationLog.logSuccess({
          entityType: "semantic_search",
          prompt: queryText.substring(0, 500),
          model: VECTOR_CONFIG.embeddingModel,
          provider: "openai",
          tokensInput: queryEmbedding.tokens,
          tokensOutput: 0,
          latencyMs: queryEmbedding.latencyMs + (Date.now() - startTime),
          metadata: {
            resultsCount: result.rows.length,
            threshold,
          },
        });

        return result.rows.map((row) => ({
          questionId: row.question_id,
          questionText: row.question_text,
          difficulty: row.difficulty,
          options: row.options,
          topicName: row.topic_name,
          subjectName: row.subject_name,
          similarity: parseFloat(row.similarity),
        }));
      } finally {
        client.release();
      }
    } catch (error) {
      await AiGenerationLog.logFailure({
        entityType: "semantic_search",
        prompt: queryText.substring(0, 500),
        model: VECTOR_CONFIG.embeddingModel,
        provider: "openai",
        errorMessage: error.message,
        latencyMs: Date.now() - startTime,
      });
      throw error;
    }
  },

  /**
   * Get questions similar to a text description.
   */
  async findByDescription(description, options = {}) {
    return this.semanticSearch(description, options);
  },

  /**
   * Get search index statistics.
   */
  async getStats() {
    return QuestionSearchIndex.getIndexStats();
  },

  /**
   * Check if pgvector extension is available.
   */
  async checkPgvector() {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as has_pgvector
      `);
      return result.rows[0].has_pgvector;
    } finally {
      client.release();
    }
  },
};

export default vectorSearchService;
