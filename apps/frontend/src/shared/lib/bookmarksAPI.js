import { apiClient } from './apiClient.js'

export const bookmarksAPI = {
  getAll: (page = 1, limit = 20) => apiClient.get(`/api/bookmarks?page=${page}&limit=${limit}`).then(r => r.data),
  getCount: () => apiClient.get('/api/bookmarks/count').then(r => r.data?.data),
  add: (data) => apiClient.post('/api/bookmarks', data).then(r => r.data),
  remove: (id) => apiClient.delete(`/api/bookmarks/${id}`).then(r => r.data),
  update: (id, data) => apiClient.put(`/api/bookmarks/${id}`, data).then(r => r.data),
  toggle: (data) => apiClient.post('/api/bookmarks/toggle', data).then(r => r.data),
  check: (itemType, itemId) => apiClient.get(`/api/bookmarks/check/${itemType}/${itemId}`).then(r => r.data),
}
