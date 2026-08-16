import { apiClient, ValidationError } from './apiClient.js'

export const studyAPI = {
  getAll: () => apiClient.get('/api/study'),

  getBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/api/study/${slug}`)
  },

  getById: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/api/study/${slugOrId}`)
  },

  getChaptersBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/api/study/${slug}/chapters`)
  },

  getChapters: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/api/study/${slugOrId}/chapters`)
  },

  getResource: (slug) => {
    if (!slug) throw new ValidationError('Resource slug is required')
    return apiClient.get(`/api/study/${slug}`)
  },
}
