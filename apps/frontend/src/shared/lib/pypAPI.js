import { apiClient } from './apiClient.js'

export const pypAPI = {
  getCategories: () => apiClient.get('/api/pyps/categories').then(r => r.data?.data),
  getCategoryExams: (catSlug) => apiClient.get(`/api/pyps/categories/${catSlug}/exams`).then(r => r.data?.data),
  getExamPapers: (examSlug, params = {}) => {
    const query = new URLSearchParams()
    if (params.year && params.year !== 'all') query.set('year', params.year)
    if (params.tier && params.tier !== 'all') query.set('tier', params.tier)
    if (params.page) query.set('page', params.page)
    if (params.limit) query.set('limit', params.limit)
    return apiClient.get(`/api/pyps/exams/${examSlug}?${query.toString()}`).then(r => r.data?.data)
  },
  getExamInsights: (examSlug) => apiClient.get(`/api/pyps/exams/${examSlug}/insights`).then(r => r.data?.data),
}

export const getPypCategories = async () => {
  const response = await apiClient.get('/api/pyps/categories')
  return response.data
}

export const getPypCategoryExams = async (catSlug) => {
  const response = await apiClient.get(`/api/pyps/categories/${catSlug}/exams`)
  return response.data
}

export const getPypExamPapers = async (examSlug, params = {}) => {
  const query = new URLSearchParams()
  if (params.year && params.year !== 'all') query.set('year', params.year)
  if (params.tier && params.tier !== 'all') query.set('tier', params.tier)
  if (params.page) query.set('page', params.page)
  if (params.limit) query.set('limit', params.limit)
  const response = await apiClient.get(`/api/pyps/exams/${examSlug}?${query.toString()}`)
  return response.data
}

export const getPypExamInsights = async (examSlug) => {
  const response = await apiClient.get(`/api/pyps/exams/${examSlug}/insights`)
  return response.data
}
