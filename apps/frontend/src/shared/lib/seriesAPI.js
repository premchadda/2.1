import { apiClient, ValidationError } from './apiClient.js'

export const seriesAPI = {
  getAll: () => apiClient.get('/api/series'),
  getById: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/api/series/${id}`)
  },
  create: (data) => {
    if (!data.title || !data.category) {
      throw new ValidationError('Title and category are required')
    }
    return apiClient.post('/api/admin/test-series', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.put(`/api/admin/test-series/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/api/admin/test-series/${id}`)
  },
  getByCategory: (category) => {
    if (!category) throw new ValidationError('Category is required')
    return apiClient.get(`/api/series/category/${category}`)
  },
  getTests: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/api/series/${seriesId}/tests`)
  },
}
