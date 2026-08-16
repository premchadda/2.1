import { ValidationError } from '@trstprep/shared-config'
import { apiClient } from '../apiClient.js'

export const testsAPI = {
  getAll: () => apiClient.get('/admin/tests'), // Admin endpoint
  getById: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.get(`/tests/${id}`)
  },
  getByTag: (tag) => {
    if (!tag) throw new ValidationError('Tag is required')
    return apiClient.get(`/tests/tag/${tag}`)
  },
  getBySeriesId: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/tests/series/${seriesId}`)
  },
  getQuestions: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/tests/${testId}/questions`)
  },
  startAttempt: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.post(`/tests/${testId}/start`)
  },
  submitAttempt: (testId, data) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!data || !Array.isArray(data.answers)) {
      throw new ValidationError('Answers array is required')
    }
    return apiClient.put(`/tests/${testId}/submit`, data)
  },
  getResult: (testId, attemptId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!attemptId) throw new ValidationError('Attempt ID is required')
    return apiClient.get(`/tests/${testId}/result/${attemptId}`)
  },
  // Attempt management - pause/resume/save-progress
  attempt: {
    start: (testId, seriesId) => {
      if (!testId) throw new ValidationError('Test ID is required')
      // Canonical start endpoint is POST /tests/:testId/start (was /attempt/start — deprecated).
      return apiClient.post(`/tests/${testId}/start`, { testSeriesId: seriesId })
    },
    pause: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/attempt/pause', { attemptId, ...data })
    },
    resume: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/attempt/resume', { attemptId })
    },
    saveProgress: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/attempt/save-progress', { attemptId, ...data })
    },
    getState: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/attempt/${attemptId}/state`)
    },
    logEvent: (attemptId, eventType, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      if (!eventType) throw new ValidationError('Event type is required')
      return apiClient.post(`/attempt/${attemptId}/event`, { eventType, ...data })
    },
    getAnalytics: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/attempt/${attemptId}/analytics`)
    }
  },
  create: (data) => {
    if (!data.title) {
      throw new ValidationError('title is required')
    }
    if (!data.testSeriesId && !data.seriesId) {
      throw new ValidationError('testSeriesId is required')
    }
    return apiClient.post('/admin/tests', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.put(`/admin/tests/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.delete(`/admin/tests/${id}`)
  },
}

export default testsAPI
