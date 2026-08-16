import { apiClient } from './apiClient.js'

export const practiceAPI = {
  getTree: () => apiClient.get('/api/practice/tree').then(r => r.data?.data),
  getSubjects: () => apiClient.get('/api/practice/subjects').then(r => r.data?.data?.subjects),
  getTopicStats: (topicId) => apiClient.get(`/api/practice/topics/${topicId}/stats`).then(r => r.data?.data),
  getChapterTopics: (chapterId) => apiClient.get(`/api/practice/chapters/${chapterId}/topics`).then(r => r.data?.data),

  startSession: (payload) => apiClient.post('/api/practice/sessions', payload).then(r => r.data?.data),
  getActiveSession: () => apiClient.get('/api/practice/sessions/active').then(r => r.data?.data),
  getSession: (id) => apiClient.get(`/api/practice/sessions/${id}`).then(r => r.data?.data),
  patchSession: (id, patch) => apiClient.patch(`/api/practice/sessions/${id}`, patch).then(r => r.data),
  completeSession: (id, summary) => apiClient.post(`/api/practice/sessions/${id}/complete`, summary).then(r => r.data?.data),

  getQuestion: (sessionId, idx) => apiClient.get(`/api/practice/sessions/${sessionId}/questions/${idx}`).then(r => r.data?.data),
  checkAnswer: (sessionId, idx, payload) => apiClient.post(`/api/practice/sessions/${sessionId}/questions/${idx}/check`, payload).then(r => r.data?.data),
  skipQuestion: (sessionId, idx, payload) => apiClient.post(`/api/practice/sessions/${sessionId}/questions/${idx}/skip`, payload).then(r => r.data),

  getBookmarks: (page = 1, limit = 20) => apiClient.get(`/api/practice/bookmarks?page=${page}&limit=${limit}`).then(r => r.data),
  getBookmarksCount: () => apiClient.get('/api/practice/bookmarks/count').then(r => r.data?.data),
  addBookmark: (questionId) => apiClient.post(`/api/practice/bookmarks/${questionId}`).then(r => r.data),
  removeBookmark: (questionId) => apiClient.delete(`/api/practice/bookmarks/${questionId}`).then(r => r.data),

  getMistakes: (page = 1, limit = 20) => apiClient.get(`/api/practice/mistakes?page=${page}&limit=${limit}`).then(r => r.data),
  getMistakesCount: () => apiClient.get('/api/practice/mistakes/count').then(r => r.data?.data),

  getDashboard: () => apiClient.get('/api/practice/dashboard').then(r => r.data?.data),

  reportQuestion: (questionId, payload) => apiClient.post(`/api/practice/questions/${questionId}/report`, payload).then(r => r.data),

  // Practice Engine Redesign Additions
  getFundamentalCategories: () => apiClient.get('/api/practice/fundamentals/categories').then(r => r.data?.data),
  getFundamentalDrill: (category, count = 10) => apiClient.get(`/api/practice/fundamentals/drill?category=${category}&count=${count}`).then(r => r.data?.data),
  submitFundamentalDrill: (payload) => apiClient.post('/api/practice/fundamentals/submit', payload).then(r => r.data),

  getExplanations: (questionId) => apiClient.get(`/api/practice/questions/${questionId}/explanations`).then(r => r.data?.data),
  getApproaches: (questionId) => apiClient.get(`/api/practice/questions/${questionId}/approaches`).then(r => r.data?.data),
  submitApproach: (questionId, payload) => apiClient.post(`/api/practice/questions/${questionId}/approaches`, payload).then(r => r.data?.data),
  upvoteApproach: (questionId, approachId) => apiClient.post(`/api/practice/questions/${questionId}/approaches/${approachId}/upvote`).then(r => r.data),

  getSimilarQuestions: (questionId) => apiClient.get(`/api/practice/questions/${questionId}/similar`).then(r => r.data?.data),
  saveToVault: (payload) => apiClient.post('/api/practice/vault/save', payload).then(r => r.data?.data),
  getVaultItems: () => apiClient.get('/api/practice/vault/items').then(r => r.data?.data),
  askAiTutor: (payload) => apiClient.post('/api/practice/ai/tutor', payload).then(r => r.data?.data),
}
