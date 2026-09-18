/**
 * Embedding Service
 *
 * General-purpose embedding service for semantic search:
 * - Generate embeddings using OpenAI-compatible API
 * - Store and retrieve embeddings from PostgreSQL
 * - Similarity search using cosine distance
 * - Support for multiple content types
 */

import { pool } from "../../infrastructure/database/postgres-helpers.js";
import AiGenerationLog from "../../data/models/ai/AiGenerationLog.js";

const EMBEDDING_CONFIG = {
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION) || 1536,
  batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 20,
  // Unified with vectorSearch.service: AI_API_KEY || OPENROUTER_API_KEY ||
  // OPENAI_API_KEY; baseUrl AI_BASE_URL || openrouter (26).
  apiKey:
    process.env.AI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY,
  baseUrl: process.env.AI_BASE_URL || "https://openrouter.ai/api/v1",
  maxTokensPerChunk: 8000,
};

const estimateTokens = (text) =>
  Math.max(1, Math.ceil(String(text || "").length / 4));

/**
 * Fail closed when the provider returns an error-shape payload, and assert
 * the vector dimension BEFORE any INSERT — pgvector vector(1536) rejects
 * mismatched dims with a raw DB error otherwise.
 */
const assertEmbeddingVector = (vec) => {
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error("Embedding API returned no vector");
  }
  if (vec.length !== EMBEDDING_CONFIG.embeddingDimension) {
    throw new Error(
      `Embedding dimension mismatch: got ${vec.length}, expected ${EMBEDDING_CONFIG.embeddingDimension} (pgvector column; align EMBEDDING_MODEL with EMBEDDING_DIMENSION)`,
    );
  }
  return vec;
};

const TRANSIENT_EMBEDDING_STATUSES = new Set([
  408, 425, 429, 500, 502, 503, 504,
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolved per call (not at module load) so key rotation and late-bound
// test envs take effect without a restart.
const resolveEmbeddingKey = () =>
  EMBEDDING_CONFIG.apiKey ||
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
  const apiKey = resolveEmbeddingKey();
  if (!apiKey) {
    throw new Error(
      "Embedding API key is not configured (set AI_API_KEY or OPENROUTER_API_KEY or OPENAI_API_KEY)",
    );
  }

  const truncatedText = text.substring(0, EMBEDDING_CONFIG.maxTokensPerChunk);

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${EMBEDDING_CONFIG.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_CONFIG.embeddingModel,
          input: truncatedText,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const error = await response.text();
        const err = new Error(
          `Embedding API error: ${response.status} - ${String(error).slice(0, 300)}`,
        );
        err.status = response.status;
        lastError = err;
        if (
          !TRANSIENT_EMBEDDING_STATUSES.has(response.status) ||
          attempt >= retries
        )
          throw err;
        await sleep(response.status === 429 ? 1000 : 500 * (attempt + 1));
        continue;
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        embedding: assertEmbeddingVector(data?.data?.[0]?.embedding),
        tokens: data?.usage?.total_tokens || estimateTokens(truncatedText),
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
      throw {
        message: error.message,
        status: error.status,
        latencyMs,
      };
    }
  }
  const latencyMs = Date.now() - startTime;
  throw {
    message: lastError?.message || "Embedding generation failed",
    status: lastError?.status,
    latencyMs,
  };
}

/**
 * Generate embeddings for multiple texts in batch.
 * Same retry/timeout contract as generateEmbedding (1): { timeoutMs, retries }.
 */
async function generateEmbeddingsBatch(texts, options = {}) {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 30000;
  const retries = options.retries ?? 1;

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    throw new Error("Texts array is required for batch embedding generation");
  }
  const batchApiKey = resolveEmbeddingKey();
  if (!batchApiKey) {
    throw new Error(
      "Embedding API key is not configured (set AI_API_KEY or OPENROUTER_API_KEY or OPENAI_API_KEY)",
    );
  }

  const truncatedTexts = texts.map((text) =>
    (text || "").substring(0, EMBEDDING_CONFIG.maxTokensPerChunk),
  );

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${EMBEDDING_CONFIG.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${batchApiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_CONFIG.embeddingModel,
          input: truncatedTexts,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const error = await response.text();
        const err = new Error(
          `Embedding API error: ${response.status} - ${error}`,
        );
        err.status = response.status;
        lastError = err;
        if (
          !TRANSIENT_EMBEDDING_STATUSES.has(response.status) ||
          attempt >= retries
        )
          throw err;
        await sleep(response.status === 429 ? 1000 : 500 * (attempt + 1));
        continue;
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      if (!Array.isArray(data?.data) || data.data.length === 0) {
        throw new Error("Embedding API returned no vectors");
      }
      return {
        embeddings: data.data.map((d) => assertEmbeddingVector(d?.embedding)),
        tokens:
          data?.usage?.total_tokens ||
          truncatedTexts.reduce((n, t) => n + estimateTokens(t), 0),
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
      throw {
        message: error.message,
        status: error.status,
        latencyMs,
      };
    }
  }
  const latencyMs = Date.now() - startTime;
  throw {
    message: lastError?.message || "Batch embedding generation failed",
    status: lastError?.status,
    latencyMs,
  };
}

/**
 * Build search text from question data.
 */
async function buildQuestionSearchText(questionId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT
        q.id as question_id,
        q.question_text,
        -- options may be a JSONB object {0..3} OR a JSON array ["A","B",..];
        -- cover both shapes so array-shaped options don't embed as empty text.
        COALESCE(
          NULLIF(TRIM(BOTH ' ' FROM
            COALESCE(q.options->>'0', '') || ' ' ||
            COALESCE(q.options->>'1', '') || ' ' ||
            COALESCE(q.options->>'2', '') || ' ' ||
            COALESCE(q.options->>'3', '')
          ), ''),
          (SELECT string_agg(value::text, ' ') FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
          ) AS value)
        , '') as options_text,
        COALESCE(q.explanation, '') as explanation_text,
        COALESCE(t.name, '') as topic_name,
        COALESCE(s.name, '') as subject_name,
        COALESCE(q.difficulty, '') as difficulty
      FROM questions q
      LEFT JOIN subject_topics t ON t.id = q.topic_id
      LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE q.id = $1
    `,
      [questionId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return [
      row.question_text,
      row.options_text,
      row.explanation_text,
      row.topic_name,
      row.subject_name,
      row.difficulty,
    ]
      .filter(Boolean)
      .join(" ");
  } finally {
    client.release();
  }
}

/**
 * Build search text from study material data.
 */
async function buildStudyMaterialSearchText(materialId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT
        sm.id,
        sm.title,
        COALESCE(sm.description, '') as description,
        COALESCE(sm.content, '') as content,
        COALESCE(c.name, '') as chapter_name,
        COALESCE(s.name, '') as subject_name,
        COALESCE(sm.type, '') as type
      FROM study_materials sm
      LEFT JOIN subject_chapters c ON c.id = sm.chapter_id
      LEFT JOIN subjects s ON s.id = sm.subject_id
      WHERE sm.id = $1
    `,
      [materialId],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return [
      row.title,
      row.description,
      row.content,
      row.chapter_name,
      row.subject_name,
      row.type,
    ]
      .filter(Boolean)
      .join(" ");
  } finally {
    client.release();
  }
}

/**
 * Build search text based on content type.
 */
async function buildSearchText(contentType, contentId) {
  switch (contentType) {
    case "question":
      return buildQuestionSearchText(contentId);
    case "study_material":
      return buildStudyMaterialSearchText(contentId);
    default:
      return null;
  }
}

/**
 * Build metadata based on content type.
 */
async function buildMetadata(contentType, contentId) {
  const client = await pool.connect();
  try {
    let result;

    switch (contentType) {
      case "question":
        result = await client.query(
          `
          SELECT
            q.question_text,
            q.difficulty,
            t.name as topic_name,
            s.name as subject_name
          FROM questions q
          LEFT JOIN subject_topics t ON t.id = q.topic_id
          LEFT JOIN subjects s ON s.id = t.subject_id
          WHERE q.id = $1
        `,
          [contentId],
        );
        break;

      case "study_material":
        result = await client.query(
          `
          SELECT
            sm.title,
            sm.type,
            c.name as chapter_name,
            s.name as subject_name
          FROM study_materials sm
          LEFT JOIN subject_chapters c ON c.id = sm.chapter_id
          LEFT JOIN subjects s ON s.id = sm.subject_id
          WHERE sm.id = $1
        `,
          [contentId],
        );
        break;

      default:
        return {};
    }

    if (result.rows.length === 0) return {};
    return result.rows[0];
  } finally {
    client.release();
  }
}

const embeddingService = {
  /**
   * Index content with embedding.
   */
  async indexContent(contentType, contentId, text = null) {
    const startTime = Date.now();

    // Build search text if not provided
    const searchText = text || (await buildSearchText(contentType, contentId));
    if (!searchText) {
      throw new Error(`Content not found: ${contentType}/${contentId}`);
    }

    // Generate embedding
    const embeddingResult = await generateEmbedding(searchText);

    // Assert pgvector dimension before INSERT (vector column rejects mismatches)
    if (
      !Array.isArray(embeddingResult.embedding) ||
      embeddingResult.embedding.length !== EMBEDDING_CONFIG.embeddingDimension
    ) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_CONFIG.embeddingDimension}, got ${Array.isArray(embeddingResult.embedding) ? embeddingResult.embedding.length : "none"}`,
      );
    }

    // Build metadata
    const metadata = await buildMetadata(contentType, contentId);

    const client = await pool.connect();
    try {
      // Upsert embedding
      await client.query(
        `
        INSERT INTO embeddings (content_type, content_id, embedding, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (content_type, content_id)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `,
        [
          contentType,
          contentId,
          JSON.stringify(embeddingResult.embedding),
          JSON.stringify(metadata),
        ],
      );

      // Log success
      await AiGenerationLog.logSuccess({
        entityType: "embedding",
        entityId: contentId,
        model: EMBEDDING_CONFIG.embeddingModel,
        provider: "openai",
        tokensInput: embeddingResult.tokens,
        tokensOutput: 0,
        latencyMs: embeddingResult.latencyMs,
        metadata: {
          contentType,
          textLength: searchText.length,
          dimension: EMBEDDING_CONFIG.embeddingDimension,
        },
      });

      return {
        contentType,
        contentId,
        embeddingGenerated: true,
        latencyMs: embeddingResult.latencyMs,
      };
    } finally {
      client.release();
    }
  },

  /**
   * Index multiple content items in batch.
   */
  async indexBatch(items) {
    const results = {
      total: items.length,
      indexed: 0,
      embeddingGenerated: 0,
      failed: 0,
      errors: [],
    };

    for (const { contentType, contentId, text } of items) {
      try {
        await this.indexContent(contentType, contentId, text);
        results.indexed++;
        results.embeddingGenerated++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          contentType,
          contentId,
          message: error.message || "Indexing failed",
        });
      }
    }

    return results;
  },

  /**
   * Index all unindexed content of a specific type.
   * Pages through the backlog with an id cursor (not a fixed first-100) so
   * repeated runs drain the tail instead of re-scanning the same head.
   * Bounded to maxPages × limit per invocation; failures are logged to
   * ai_generation_logs so a stuck backlog is visible in cost dashboards.
   */
  async indexAllUnindexed(
    contentType,
    limit = 100,
    maxPages = 10,
    afterId = 0,
  ) {
    const aggregate = {
      total: 0,
      indexed: 0,
      embeddingGenerated: 0,
      failed: 0,
      errors: [],
    };
    let lastId = parseInt(afterId) || 0;
    for (let page = 0; page < Math.max(1, maxPages); page++) {
      const items = await this.listUnindexed(contentType, limit, lastId);
      if (items.length === 0) break;
      const batch = await this.indexBatch(items);
      aggregate.total += batch.total;
      aggregate.indexed += batch.indexed;
      aggregate.embeddingGenerated += batch.embeddingGenerated;
      aggregate.failed += batch.failed;
      aggregate.errors.push(...batch.errors);
      lastId = items[items.length - 1].contentId;
      if (items.length < limit) break;
    }
    if (aggregate.failed > 0) {
      try {
        const { default: AiGenerationLog } =
          await import("../../data/models/ai/AiGenerationLog.js");
        await AiGenerationLog.logFailure({
          entityType: "embedding_index_batch",
          prompt: `indexAllUnindexed(${contentType}): ${aggregate.failed}/${aggregate.total} failed`,
          error: aggregate.errors
            .slice(0, 3)
            .map((e) => e.message)
            .join(" | "),
          metadata: {
            contentType,
            failed: aggregate.failed,
            total: aggregate.total,
          },
        }).catch(() => {});
      } catch {
        /* failure logging is best-effort */
      }
    }
    return aggregate;
  },

  /**
   * List one page of unindexed content after a cursor id.
   */
  async listUnindexed(contentType, limit = 100, afterId = 0) {
    const client = await pool.connect();
    try {
      let query;
      const params = [limit, afterId];

      switch (contentType) {
        case "question":
          query = `
            SELECT q.id as content_id
            FROM questions q
            WHERE q.is_active = true
              AND q.id > $2
              AND NOT EXISTS (
                SELECT 1 FROM embeddings e
                WHERE e.content_type = 'question' AND e.content_id = q.id
              )
            ORDER BY q.id ASC
            LIMIT $1
          `;
          break;

        case "study_material":
          query = `
            SELECT sm.id as content_id
            FROM study_materials sm
            WHERE sm.id > $2
              AND NOT EXISTS (
                SELECT 1 FROM embeddings e
                WHERE e.content_type = 'study_material' AND e.content_id = sm.id
              )
            ORDER BY sm.id ASC
            LIMIT $1
          `;
          break;

        default:
          throw new Error(`Unsupported content type: ${contentType}`);
      }

      const result = await client.query(query, params);
      return result.rows.map((row) => ({
        contentType,
        contentId: row.content_id,
      }));
    } finally {
      client.release();
    }
  },

  /**
   * Search for similar content using cosine similarity.
   */
  async searchSimilar(query, contentType = null, options = {}) {
    const startTime = Date.now();

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    if (
      !Array.isArray(queryEmbedding.embedding) ||
      queryEmbedding.embedding.length !== EMBEDDING_CONFIG.embeddingDimension
    ) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_CONFIG.embeddingDimension}, got ${Array.isArray(queryEmbedding.embedding) ? queryEmbedding.embedding.length : "none"}`,
      );
    }

    const client = await pool.connect();
    try {
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.6;

      let sql = `
        SELECT
          e.content_type,
          e.content_id,
          e.metadata,
          e.created_at,
          1 - (e.embedding <=> $1::vector) as similarity
        FROM embeddings e
        WHERE e.embedding IS NOT NULL
          AND 1 - (e.embedding <=> $1::vector) >= $2
      `;
      const params = [JSON.stringify(queryEmbedding.embedding), threshold];
      let paramIndex = 3;

      if (contentType) {
        sql += ` AND e.content_type = $${paramIndex}`;
        params.push(contentType);
        paramIndex++;
      }

      sql += ` ORDER BY e.embedding <=> $1::vector LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(sql, params);

      // Log search
      await AiGenerationLog.logSuccess({
        entityType: "embedding_search",
        prompt: query.substring(0, 500),
        model: EMBEDDING_CONFIG.embeddingModel,
        provider: "openai",
        tokensInput: queryEmbedding.tokens,
        tokensOutput: 0,
        latencyMs: queryEmbedding.latencyMs + (Date.now() - startTime),
        metadata: {
          contentType,
          resultsCount: result.rows.length,
          threshold,
        },
      });

      return result.rows.map((row) => ({
        contentType: row.content_type,
        contentId: row.content_id,
        metadata: row.metadata,
        createdAt: row.created_at,
        similarity: parseFloat(row.similarity),
      }));
    } finally {
      client.release();
    }
  },

  /**
   * Get embedding statistics.
   */
  async getStats() {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT
          content_type,
          COUNT(*) as count,
          MIN(created_at) as earliest,
          MAX(updated_at) as latest
        FROM embeddings
        GROUP BY content_type
        ORDER BY count DESC
      `);

      const total = await client.query(
        "SELECT COUNT(*) as total FROM embeddings",
      );

      return {
        total: parseInt(total.rows[0].total),
        byContentType: result.rows,
      };
    } finally {
      client.release();
    }
  },

  /**
   * Check if pgvector extension is available.
   */
  async checkPgvector() {
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

  /**
   * Delete embedding for specific content.
   */
  async deleteEmbedding(contentType, contentId) {
    const client = await pool.connect();
    try {
      await client.query(
        "DELETE FROM embeddings WHERE content_type = $1 AND content_id = $2",
        [contentType, contentId],
      );
    } finally {
      client.release();
    }
  },

  /**
   * Get embedding for specific content.
   */
  async getEmbedding(contentType, contentId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT id, content_type, content_id, embedding, metadata, created_at, updated_at FROM embeddings WHERE content_type = $1 AND content_id = $2",
        [contentType, contentId],
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  },
};

export default embeddingService;
