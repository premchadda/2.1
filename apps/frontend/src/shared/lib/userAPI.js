import { apiClient, ValidationError } from './apiClient.js'

export const userAPI = {
  getProfile: () => apiClient.get('/api/users/profile'),
  updateProfile: (data) => {
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError('Profile data is required')
    }
    return apiClient.put('/api/users/profile', data)
  },
  enrollSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.post(`/api/users/enroll/${seriesId}`)
  },
  unenrollFromSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/api/users/unenroll/${seriesId}`)
  },
  getEnrolledSeries: () => apiClient.get('/api/users/enrolled-series'),
  getAttempts: () => apiClient.get('/api/users/attempts'),
  getIncompleteAttempts: () => apiClient.get('/api/users/attempts/incomplete'),
  getAnalytics: () => apiClient.get('/api/users/analytics'),
  deleteAccount: () => apiClient.delete('/api/users/profile'),
  getSessions: () => apiClient.get('/api/users/sessions'),
  revokeSession: (sessionId) => apiClient.delete(`/api/users/sessions/${sessionId}`),
  changeEmail: (newEmail) => apiClient.post('/api/users/change-email', { newEmail }),
}
