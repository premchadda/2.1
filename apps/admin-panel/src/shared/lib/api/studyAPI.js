import { ValidationError } from '@trstprep/shared-config'
import { apiClient } from '../apiClient.js'

// NOTE: Public study routes use SLUG-based routing, not ID-based
// - GET /study - Get all study materials
// - GET /study/:slug - Get study material by slug
// - GET /study/:slug/chapters - Get chapters by slug
// Admin routes use ID-based routing (see adminAPI.studyMaterials)
export const studyAPI = {
  // Get all study materials (public)
  getAll: () => apiClient.get('/study'),
  
  // Get study material by SLUG (public endpoint uses slug, not ID)
  getBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/study/${slug}`)
  },
  
  // Alias for backward compatibility - accepts either slug or id
  // WARNING: This calls the slug-based endpoint, so pass slug not ID
  getById: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/study/${slugOrId}`)
  },
  
  // Get chapters for a study material by SLUG
  getChaptersBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/study/${slug}/chapters`)
  },
  
  // Alias for backward compatibility - accepts either slug or id
  // WARNING: This calls the slug-based endpoint, so pass slug not ID
  getChapters: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/study/${slugOrId}/chapters`)
  },
  
  // Get a specific resource (alias for getBySlug)
  getResource: (slug) => {
    if (!slug) throw new ValidationError('Resource slug is required')
    return apiClient.get(`/study/${slug}`)
  },
}

export default studyAPI
