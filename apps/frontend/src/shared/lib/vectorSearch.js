import { apiClient } from './apiClient.js'

/**
 * Vector Search API
 *
 * Frontend utility for semantic search using vector embeddings:
 * - Search for similar content
 * - Index content for search
 * - Get indexing statistics
 */

export const vectorSearchAPI = {
  /**
   * Search for similar content using semantic search.
   * @param {string} query - Search query text
   * @param {string} contentType - Optional: filter by content type (question, study_material, etc.)
   * @param {object} options - Optional: { limit, threshold }
   * @returns {Promise<Array>} Array of similar content items
   */
  searchSimilar: (query, contentType = null, options = {}) => {
    return apiClient.post('/api/embeddings/search', {
      query,
      contentType,
      ...options,
    }).then(r => r.data?.data)
  },

  /**
   * Index content for semantic search (admin only).
   * @param {string} contentType - Type of content (question, study_material, etc.)
   * @param {number} contentId - ID of the content to index
   * @param {string} text - Optional: custom text to index (if not provided, will be built from content)
   * @returns {Promise<object>} Indexing result
   */
  indexContent: (contentType, contentId, text = null) => {
    return apiClient.post('/api/embeddings/index', {
      contentType,
      contentId,
      text,
    }).then(r => r.data?.data)
  },

  /**
   * Index multiple content items in batch (admin only).
   * @param {Array} items - Array of { contentType, contentId, text? }
   * @returns {Promise<object>} Batch indexing result
   */
  indexBatch: (items) => {
    return apiClient.post('/api/embeddings/index/batch', { items })
      .then(r => r.data?.data)
  },

  /**
   * Index all unindexed content of a specific type (admin only).
   * @param {string} contentType - Type of content to index
   * @param {number} limit - Maximum number of items to index
   * @returns {Promise<object>} Indexing result
   */
  indexAllUnindexed: (contentType, limit = 100) => {
    return apiClient.post('/api/embeddings/index/all-unindexed', {
      contentType,
      limit,
    }).then(r => r.data?.data)
  },

  /**
   * Get embedding statistics (admin only).
   * @returns {Promise<object>} Statistics including total count and counts by content type
   */
  getStats: () => {
    return apiClient.get('/api/embeddings/stats')
      .then(r => r.data?.data)
  },

  /**
   * Get embedding for specific content (admin only).
   * @param {string} contentType - Type of content
   * @param {number} contentId - ID of the content
   * @returns {Promise<object|null>} Embedding data or null
   */
  getEmbedding: (contentType, contentId) => {
    return apiClient.get(`/api/embeddings/${contentType}/${contentId}`)
      .then(r => r.data?.data)
  },

  /**
   * Delete embedding for specific content (admin only).
   * @param {string} contentType - Type of content
   * @param {number} contentId - ID of the content
   * @returns {Promise<void>}
   */
  deleteEmbedding: (contentType, contentId) => {
    return apiClient.delete(`/api/embeddings/${contentType}/${contentId}`)
      .then(r => r.data)
  },

  /**
   * Search for similar questions using the existing vector search endpoint.
   * @param {string} query - Search query text
   * @param {object} options - Optional: { difficulty, topicId, subject, limit, threshold }
   * @returns {Promise<Array>} Array of similar questions
   */
  semanticSearch: (query, options = {}) => {
    return apiClient.post('/api/search/vector/semantic', {
      query,
      ...options,
    }).then(r => r.data?.data)
  },

  /**
   * Find questions similar to a specific question.
   * @param {number} questionId - ID of the question to find similar items for
   * @param {object} options - Optional: { limit, threshold }
   * @returns {Promise<Array>} Array of similar questions
   */
  findSimilarQuestions: (questionId, options = {}) => {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit)
    if (options.threshold) params.append('threshold', options.threshold)

    return apiClient.get(`/api/search/vector/similar/${questionId}?${params.toString()}`)
      .then(r => r.data?.data)
  },
}

export default vectorSearchAPI
