// Admin API client - exports the apiClient for admin-related API calls
// This module provides an axios-like client for admin operations
import { apiClient } from '../lib/dataService'

// Export the apiClient as default for direct usage (adminApi.get, adminApi.post, etc.)
export default apiClient

// Also export named exports for flexibility
export { apiClient }