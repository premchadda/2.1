import { apiClient, ValidationError } from './apiClient.js'

export const testsAPI = {
  getAll: () => apiClient.get('/api/tests'),
  getById: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.get(`/api/tests/${id}`)
  },
  getByTag: (tag) => {
    if (!tag) throw new ValidationError('Tag is required')
    return apiClient.get(`/api/tests/tag/${tag}`)
  },
  getBySeriesId: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/api/tests/series/${seriesId}`)
  },
  getQuestions: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/api/tests/${testId}/questions`)
  },
  startAttempt: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.post(`/api/tests/${testId}/start`)
  },
  submitAttempt: (testId, data) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!data || !Array.isArray(data.answers)) {
      throw new ValidationError('Answers array is required')
    }
    return apiClient.put(`/api/tests/${testId}/submit`, data)
  },
  getResult: (testId, attemptId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!attemptId) throw new ValidationError('Attempt ID is required')
    return apiClient.get(`/api/tests/${testId}/result/${attemptId}`)
  },
  attempt: {
    start: (testId, seriesId) => {
      if (!testId) throw new ValidationError('Test ID is required')
      // Canonical start endpoint is POST /api/tests/:testId/start (was /api/attempt/start — deprecated).
      return apiClient.post(`/api/tests/${testId}/start`, { testSeriesId: seriesId })
    },
    pause: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/api/attempt/pause', { attemptId, ...data })
    },
    resume: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/api/attempt/resume', { attemptId })
    },
    saveProgress: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/api/attempt/save-progress', { attemptId, ...data })
    },
    getState: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/api/attempt/${attemptId}/state`)
    },
    logEvent: (attemptId, eventType, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      if (!eventType) throw new ValidationError('Event type is required')
      return apiClient.post(`/api/attempt/${attemptId}/event`, { eventType, ...data })
    },
    getAnalytics: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/api/attempt/${attemptId}/analytics`)
    }
  },
  create: (data) => {
    if (!data.title) {
      throw new ValidationError('title is required')
    }
    if (!data.testSeriesId && !data.seriesId) {
      throw new ValidationError('testSeriesId is required')
    }
    return apiClient.post('/api/admin/tests', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.put(`/api/admin/tests/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.delete(`/api/admin/tests/${id}`)
  },
}
