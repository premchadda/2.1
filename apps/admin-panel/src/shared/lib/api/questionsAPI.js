import { ValidationError } from '@trstprep/shared-config'
import { apiClient } from '../apiClient.js'

export const questionsAPI = {
  getAll: async ({ page = 1, limit = 50, search, testId, category, seriesId } = {}) => {
    const params = { limit, page, offset: (page - 1) * limit }
    if (search) params.search = search
    if (testId) {
      params.testId = testId
      params.test_id = testId
    }
    if (category) params.category = category
    if (seriesId) params.seriesId = seriesId
    const res = await apiClient.get('/admin/questions', { params })
    return res
  },
  getByTestId: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/questions/test/${testId}`)
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
    return apiClient.post('/admin/questions', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.put(`/admin/questions/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.delete(`/admin/questions/${id}`)
  },
  bulkUpload: (data) => {
    if (!data || !Array.isArray(data.questions)) {
      throw new ValidationError('Questions array is required')
    }
    if (data.questions.length === 0) {
      throw new ValidationError('At least one question is required')
    }
    return apiClient.post('/admin/questions/bulk', data)
  },
}

export default questionsAPI
