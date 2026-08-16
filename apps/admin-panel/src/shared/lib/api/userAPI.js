import { ValidationError } from '@trstprep/shared-config'
import { apiClient } from '../apiClient.js'

export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data) => {
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError('Profile data is required')
    }
    return apiClient.put('/users/profile', data)
  },
  enrollSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.post(`/users/enroll/${seriesId}`)
  },
  unenrollFromSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/users/unenroll/${seriesId}`)
  },
  getEnrolledSeries: () => apiClient.get('/users/enrolled-series'),
  getAttempts: () => apiClient.get('/users/attempts'),
  getAnalytics: () => apiClient.get('/users/analytics'),
  deleteAccount: () => apiClient.delete('/users/profile'),
}

export default userAPI
