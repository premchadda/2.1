import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

class QuestionSearchIndex {
  static collection = 'question_search_index'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findByQuestionId(questionId) {
    return dbHelpers.findOne(this.collection, { questionId })
  }

  static async findUnindexed(limit = 100, afterId = null) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const params = [limit]
      let cursor = ''
      if (afterId != null) {
        params.push(afterId)
        cursor = ' AND id > $2'
      }
      const result = await client.query(
        `SELECT id, question_id, search_text, keywords, difficulty, topic_id, subtopic_id, subject, question_type, language, embedding, is_indexed, last_indexed_at, created_at, updated_at FROM question_search_index WHERE is_indexed = false${cursor} ORDER BY id ASC LIMIT $1`,
        params
      )
      return result.rows
    } finally {
      client.release()
    }
  }

  // Full-text dictionaries to try in order. 'english' first (stemming for
  // English queries), then 'simple' (no stemming — Hindi/Hinglish recall),
  // then 'hindi' when the dictionary exists (guarded: missing dict errors
  // fall through to the next instead of 500ing the search).
  static ftsDictionaries = ['english', 'simple', 'hindi']

  static async searchByText(queryText, options = {}) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const { difficulty, topicId, subject, language, limit = 20, offset = 0 } = options
      const filters = []
      const filterParams = []
      if (difficulty) {
        filterParams.push(difficulty)
        filters.push(` AND qsi.difficulty = $${filterParams.length + 1}`)
      }
      if (topicId) {
        filterParams.push(topicId)
        filters.push(` AND qsi.topic_id = $${filterParams.length + 1}`)
      }
      if (subject) {
        filterParams.push(subject)
        filters.push(` AND qsi.subject = $${filterParams.length + 1}`)
      }
      if (language) {
        filterParams.push(language)
        filters.push(` AND qsi.language = $${filterParams.length + 1}`)
      }
      const filterSql = filters.join('')

      // Try dictionaries in order; return the first non-empty hit set.
      // Unknown-dictionary errors (e.g. no 'hindi' stemmer installed) are
      // swallowed per-dict so search degrades instead of 500ing.
      let lastError = null
      for (const dict of QuestionSearchIndex.ftsDictionaries) {
        let sql = `
          SELECT qsi.*, q.question_text, q.difficulty as q_difficulty,
                 ts_rank(to_tsvector('${dict}', COALESCE(qsi.search_text, '')), plainto_tsquery('${dict}', $1)) as rank
          FROM question_search_index qsi
          JOIN questions q ON q.id = qsi.question_id
          WHERE to_tsvector('${dict}', COALESCE(qsi.search_text, '')) @@ plainto_tsquery('${dict}', $1)
            AND q.is_active = true
        `
        const params = [queryText, ...filterParams]
        // Filter placeholders are already 2-based ($1 is the query text).
        sql += filterSql
        const limitIdx = params.length + 1
        sql += ` ORDER BY rank DESC, qsi.id ASC LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`
        params.push(limit, offset)
        try {
          const result = await client.query(sql, params)
          if (result.rows.length > 0) return result.rows
        } catch (dictErr) {
          lastError = dictErr
        }
      }
      // All dicts empty (or errored) — return empty set, not an error.
      if (lastError && lastError.code && !['42883', '22023'].includes(String(lastError.code))) {
        throw lastError
      }
      return []
    } finally {
      client.release()
    }
  }

  static async searchByEmbedding(embedding, options = {}) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const { difficulty, topicId, subject, language, limit = 20, threshold = 0.8 } = options
      let sql = `
        SELECT qsi.*, q.question_text,
               1 - (qsi.embedding <=> $1::vector) as similarity
        FROM question_search_index qsi
        JOIN questions q ON q.id = qsi.question_id
        WHERE qsi.embedding IS NOT NULL
          AND 1 - (qsi.embedding <=> $1::vector) >= $2
          AND q.is_active = true
      `
      const params = [JSON.stringify(embedding), threshold]
      let paramIndex = 3

      if (difficulty) {
        sql += ` AND qsi.difficulty = $${paramIndex}`
        params.push(difficulty)
        paramIndex++
      }
      if (topicId) {
        sql += ` AND qsi.topic_id = $${paramIndex}`
        params.push(topicId)
        paramIndex++
      }
      if (subject) {
        sql += ` AND qsi.subject = $${paramIndex}`
        params.push(subject)
        paramIndex++
      }
      if (language) {
        sql += ` AND qsi.language = $${paramIndex}`
        params.push(language)
        paramIndex++
      }

      sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`
      params.push(limit)

      const result = await client.query(sql, params)
      return result.rows
    } finally {
      client.release()
    }
  }

  static async searchByKeywords(keywords, options = {}) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const { difficulty, topicId, limit = 20 } = options
      let sql = `
        SELECT qsi.*, q.question_text
        FROM question_search_index qsi
        JOIN questions q ON q.id = qsi.question_id
        WHERE qsi.keywords && $1
          AND q.is_active = true
      `
      const params = [keywords]
      let paramIndex = 2

      if (difficulty) {
        sql += ` AND qsi.difficulty = $${paramIndex}`
        params.push(difficulty)
        paramIndex++
      }
      if (topicId) {
        sql += ` AND qsi.topic_id = $${paramIndex}`
        params.push(topicId)
        paramIndex++
      }

      sql += ` ORDER BY qsi.id ASC LIMIT $${paramIndex}`
      params.push(limit)

      const result = await client.query(sql, params)
      return result.rows
    } finally {
      client.release()
    }
  }

  static async create(data) {
    const now = new Date()
    const payload = {
      questionId: data.questionId,
      searchText: data.searchText || null,
      keywords: data.keywords || [],
      difficulty: data.difficulty || null,
      topicId: data.topicId || null,
      subtopicId: data.subtopicId || null,
      subject: data.subject || null,
      questionType: data.questionType || null,
      language: data.language || 'en',
      embedding: data.embedding || null,
      isIndexed: data.embedding ? true : false,
      lastIndexedAt: data.embedding ? now : null,
      createdAt: now,
      updatedAt: now
    }
    return dbHelpers.insertOne(this.collection, payload)
  }

  static async updateById(id, data) {
    const update = { ...data, updatedAt: new Date() }
    return dbHelpers.updateById(this.collection, id, update)
  }

  static async setEmbedding(questionId, embedding) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    // Fail closed: never persist a missing/mismatched vector (pgvector would
    // throw a raw DB error, or worse, store a degraded row as indexed).
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('setEmbedding: empty embedding vector')
    }
    const expected = parseInt(process.env.EMBEDDING_DIMENSION) || 1536
    if (embedding.length !== expected) {
      throw new Error(
        `setEmbedding: dimension mismatch (got ${embedding.length}, expected ${expected})`
      )
    }
    const client = await pool.connect()
    try {
      await client.query(
        `UPDATE question_search_index
         SET embedding = $1, is_indexed = true, last_indexed_at = NOW(), updated_at = NOW()
         WHERE question_id = $2`,
        [JSON.stringify(embedding), questionId]
      )
    } finally {
      client.release()
    }
  }

  static async buildSearchText(questionId) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
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
      `, [questionId])

      if (result.rows.length === 0) return null
      const row = result.rows[0]
      return [
        row.question_text,
        row.options_text,
        row.explanation_text,
        row.topic_name,
        row.subject_name,
        row.difficulty
      ].filter(Boolean).join(' ')
    } finally {
      client.release()
    }
  }

  static async extractKeywords(searchText) {
    if (!searchText) return []
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
      'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
      'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
      'and', 'but', 'or', 'if', 'while', 'that', 'this', 'these', 'those',
      'what', 'which', 'who', 'whom'
    ])
    return searchText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 50)
  }

  static async upsertFromQuestion(questionId) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const searchText = await this.buildSearchText(questionId)
      if (!searchText) return null

      const keywords = await this.extractKeywords(searchText)

      const result = await client.query(`
        INSERT INTO question_search_index (question_id, search_text, keywords, difficulty, topic_id, subtopic_id, subject, question_type, language, is_indexed, created_at, updated_at)
        SELECT
          q.id,
          $2,
          $3,
          q.difficulty,
          q.topic_id,
          q.subtopic_id,
          s.name,
          q.question_type,
          COALESCE(q.language, 'en'),
          false,
          NOW(),
          NOW()
        FROM questions q
        LEFT JOIN subject_topics t ON t.id = q.topic_id
        LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE q.id = $1
        ON CONFLICT (question_id) DO UPDATE SET
          search_text = EXCLUDED.search_text,
          keywords = EXCLUDED.keywords,
          difficulty = EXCLUDED.difficulty,
          topic_id = EXCLUDED.topic_id,
          subtopic_id = EXCLUDED.subtopic_id,
          subject = EXCLUDED.subject,
          question_type = EXCLUDED.question_type,
          language = EXCLUDED.language,
          -- Preserve an existing embedding state on re-upsert: resetting
          -- is_indexed=false here would orphan the stored vector and force a
          -- needless re-embed on every question edit.
          is_indexed = question_search_index.is_indexed,
          updated_at = NOW()
        RETURNING *
      `, [questionId, searchText, keywords])

      return result.rows[0]
    } finally {
      client.release()
    }
  }

  static async bulkIndexUnindexed(limit = 50) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
        INSERT INTO question_search_index (question_id, search_text, keywords, difficulty, topic_id, subtopic_id, subject, question_type, language, is_indexed, created_at, updated_at)
        SELECT
          q.id,
          COALESCE(q.question_text, '') || ' ' ||
          COALESCE(q.options->>'0', '') || ' ' ||
          COALESCE(q.options->>'1', '') || ' ' ||
          COALESCE(q.options->>'2', '') || ' ' ||
          COALESCE(q.options->>'3', '') || ' ' ||
          COALESCE(q.explanation, '') || ' ' ||
          COALESCE(t.name, '') || ' ' ||
          COALESCE(s.name, ''),
          ARRAY_REMOVE(ARRAY_REMOVE(ARRAY_REMOVE(ARRAY_REMOVE(
            REGEXP_SPLIT_TO_ARRAY(LOWER(
              COALESCE(q.question_text, '') || ' ' ||
              COALESCE(q.options->>'0', '') || ' ' ||
              COALESCE(q.options->>'1', '') || ' ' ||
              COALESCE(q.options->>'2', '') || ' ' ||
              COALESCE(q.options->>'3', '') || ' ' ||
              COALESCE(q.explanation, '') || ' ' ||
              COALESCE(t.name, '') || ' ' ||
              COALESCE(s.name, '')
            ), E'\\s+'), '', NULL), NULL, NULL), ''),
          q.difficulty,
          q.topic_id,
          q.subtopic_id,
          COALESCE(s.name, ''),
          q.question_type,
          COALESCE(q.language, 'en'),
          false,
          NOW(),
          NOW()
        FROM questions q
        LEFT JOIN subject_topics t ON t.id = q.topic_id
        LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE q.is_active = true
          AND NOT EXISTS (SELECT 1 FROM question_search_index qsi WHERE qsi.question_id = q.id)
        LIMIT $1
        ON CONFLICT (question_id) DO NOTHING
      `, [limit])
      return result.rowCount
    } finally {
      client.release()
    }
  }

  static async deleteByQuestionId(questionId) {
    return dbHelpers.deleteByQuery(this.collection, { questionId })
  }

  static async getIndexStats() {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT
          COUNT(*) as total_indexed,
          COUNT(CASE WHEN is_indexed = true THEN 1 END) as with_embeddings,
          COUNT(CASE WHEN is_indexed = false THEN 1 END) as pending_embedding,
          COUNT(DISTINCT topic_id) as topics_covered,
          COUNT(DISTINCT subject) as subjects_covered
        FROM question_search_index
      `)
      return result.rows[0]
    } finally {
      client.release()
    }
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }
}

export default QuestionSearchIndex
