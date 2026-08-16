import { ValidationError } from '@trstprep/shared-config'
import { apiClient } from '../apiClient.js'

export const seriesAPI = {
  // Uses public endpoint which now includes calculated test counts
  getAll: () => apiClient.get('/series'),
  getById: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/series/${id}`)
  },
  create: (data) => {
    if (!data.title || !data.category) {
      throw new ValidationError('Title and category are required')
    }
    return apiClient.post('/admin/test-series', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.put(`/admin/test-series/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/admin/test-series/${id}`)
  },
  getByCategory: (category) => {
    if (!category) throw new ValidationError('Category is required')
    return apiClient.get(`/series/category/${category}`)
  },
  getTests: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/series/${seriesId}/tests`)
  },
}

export default seriesAPI
