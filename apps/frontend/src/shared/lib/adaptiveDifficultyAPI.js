import { apiClient } from './apiClient.js'

export const adaptiveDifficultyAPI = {
  /**
   * Get the current adaptive difficulty for a topic.
   * @param {number} topicId
   * @returns {Promise<{score, level, totalAttempts, recentAccuracy}>}
   */
  getDifficulty: (topicId) =>
    topicId == null
      ? Promise.resolve(null)
      : apiClient.get(`/api/adaptive-difficulty/${topicId}`).then(r => r.data?.data),

  /**
   * Submit a single performance event.
   * @param {{ topicId: number, correct: boolean, timeSpent?: number }} payload
   * @returns {Promise<{score, level, totalAttempts, recentAccuracy}>}
   */
  submitPerformance: (payload) =>
    apiClient.post('/api/adaptive-difficulty/submit', payload).then(r => r.data?.data),

  /**
   * Batch-fetch difficulties for multiple topics.
   * @param {number[]} topicIds
   * @returns {Promise<Array<{score, level, totalAttempts, recentAccuracy}>>}
   */
  getBatchDifficulties: (topicIds) => {
    const ids = (Array.isArray(topicIds) ? topicIds : []).filter(
      (id) => id != null,
    );
    if (ids.length === 0) return Promise.resolve([]);
    return apiClient
      .post('/api/adaptive-difficulty/batch', { topicIds: ids })
      .then(r => r.data?.data);
  },

  /**
   * Reset difficulty for a topic back to neutral.
   * @param {number} topicId
   * @returns {Promise<{score, level, totalAttempts, recentAccuracy}>}
   */
  resetDifficulty: (topicId) =>
    topicId == null
      ? Promise.resolve(null)
      : apiClient.post(`/api/adaptive-difficulty/reset/${topicId}`).then(r => r.data?.data),
}
