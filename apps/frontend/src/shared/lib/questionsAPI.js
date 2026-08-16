import { apiClient, ValidationError } from './apiClient.js'

export const questionsAPI = {
  getAll: () => apiClient.get('/api/admin/questions'),
  getByTestId: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/api/questions/test/${testId}`)
  },
  create: (data) => {
    const required = ['text', 'options', 'correct', 'testId']
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`${field} is required`)
      }
    }
    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new ValidationError('At least 2 options are required')
    }
    if (data.correct < 0 || data.correct >= data.options.length) {
      throw new ValidationError('Invalid correct answer index')
    }
    return apiClient.post('/api/admin/questions', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.put(`/api/admin/questions/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.delete(`/api/admin/questions/${id}`)
  },
  bulkUpload: (data) => {
    if (!data || !Array.isArray(data.questions)) {
      throw new ValidationError('Questions array is required')
    }
    if (data.questions.length === 0) {
      throw new ValidationError('At least one question is required')
    }
    return apiClient.post('/api/admin/questions/bulk', data)
  },
}
