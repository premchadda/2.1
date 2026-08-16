import { apiClient } from './apiClient.js'

export const aiAPI = {
  getStudyPlan: () => apiClient.post('/api/ai/mentor/study-plan').then(r => r.data?.data),
  askDoubt: (data) => apiClient.post('/api/ai/mentor/doubt', data).then(r => r.data?.data),
  getExamStrategy: (data) => apiClient.post('/api/ai/mentor/exam-strategy', data).then(r => r.data?.data),
  getDailyTip: () => apiClient.get('/api/ai/mentor/daily-tip').then(r => r.data?.data),
  chat: (data) => apiClient.post('/api/ai/mentor/chat', data).then(r => r.data?.data),
  getRevisionPlan: () => apiClient.post('/api/smart-revision/generate-plan').then(r => r.data?.data),
  getDueRevisions: () => apiClient.get('/api/smart-revision/due').then(r => r.data?.data),
  completeRevision: (questionId, remembered = true) => apiClient.post('/api/smart-revision/complete', { questionId, remembered }).then(r => r.data?.data),
  getRevisionStats: () => apiClient.get('/api/smart-revision/stats').then(r => r.data?.data),
  getSocraticHint: (data) => apiClient.post('/api/ai/mentor/socratic-hint', data).then(r => r.data?.data),
}
