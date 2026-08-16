import { apiClient } from './apiClient.js'

export const notificationPrefAPI = {
  subscribe: (data) => apiClient.post('/api/notifications-pref/subscribe', data),
}
