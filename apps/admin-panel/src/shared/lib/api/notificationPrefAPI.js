// Notification preference endpoints.
// Backend: apps/backend/src/api/routes/notificationsPref.js (mounted at /api/notifications-pref)
import { apiClient } from '../apiClient.js'

export const notificationPrefAPI = {
  subscribe: (data) => apiClient.post('/notifications-pref/subscribe', data),
}

export default notificationPrefAPI