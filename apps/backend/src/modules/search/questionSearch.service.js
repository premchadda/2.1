import QuestionSearchIndex from '../../data/models/search/QuestionSearchIndex.js'

const questionSearchService = {
  async list(query = {}) {
    return QuestionSearchIndex.find(query)
  },

  async getById(id) {
    return QuestionSearchIndex.findById(id)
  },

  async getByQuestionId(questionId) {
    return QuestionSearchIndex.findByQuestionId(questionId)
  },

  async searchByText(queryText, options = {}) {
    if (!queryText || queryText.trim().length === 0) {
      throw new Error('Search query is required')
    }
    return QuestionSearchIndex.searchByText(queryText, options)
  },

  async searchByEmbedding(embedding, options = {}) {
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Valid embedding array is required')
    }
    return QuestionSearchIndex.searchByEmbedding(embedding, options)
  },

  async searchByKeywords(keywords, options = {}) {
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw new Error('Keywords array is required')
    }
    return QuestionSearchIndex.searchByKeywords(keywords, options)
  },

  async indexQuestion(questionId) {
    return QuestionSearchIndex.upsertFromQuestion(questionId)
  },

  async bulkIndex(limit = 50) {
    return QuestionSearchIndex.bulkIndexUnindexed(limit)
  },

  async removeFromIndex(questionId) {
    return QuestionSearchIndex.deleteByQuestionId(questionId)
  },

  async getUnindexedCount() {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM questions q
        WHERE q.is_active = true
          AND NOT EXISTS (SELECT 1 FROM question_search_index qsi WHERE qsi.question_id = q.id)
      `)
      return parseInt(result.rows[0].count)
    } finally {
      client.release()
    }
  },

  async getIndexStats() {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
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
  },

  async count(query = {}) {
    return QuestionSearchIndex.count(query)
  }
}

export default questionSearchService
