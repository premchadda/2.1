import axios from 'axios'
import { getCsrfToken, clearCsrfToken } from '@trstprep/shared-config'
import { API_BASE_URL } from '../shared/lib/apiBase.js'

// DX-01: Centralized API client with auth token injection,
// 401 auto-retry, and 5xx exponential backoff.

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

export const api = axios.create({
  baseURL: API_BASE_URL || 'http://localhost:5001',
  withCredentials: true,
  timeout: 30000,
})

// Request interceptor: attach auth token + CSRF token for mutating requests.
api.interceptors.request.use((config) => {
  const csrfToken = getCsrfToken()
  if (csrfToken && ['post', 'put', 'delete', 'patch'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  // Attach JWT if stored (for pages that set it directly)
  const authToken = localStorage.getItem('token')
  if (authToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${authToken}`
  }

  return config
})

// Response interceptor: 401 auto-retry + 5xx exponential backoff.
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config
    if (!config) return Promise.reject(err)

    // --- 401 Handling: Attempt token refresh once ---
    if (err.response?.status === 401 && !config._retried401) {
      config._retried401 = true
      try {
        // Attempt refresh via cookie-based session
        await axios.post(
          `${api.defaults.baseURL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        )
        // Retry the original request
        return api(config)
      } catch (refreshErr) {
        // Refresh failed — clear local state, let the caller handle 401
        clearCsrfToken()
        localStorage.removeItem('token')
        return Promise.reject(err)
      }
    }

    // --- 5xx Handling: Retry with exponential backoff ---
    if (err.response?.status >= 500) {
      config._retryCount = config._retryCount || 0
      if (config._retryCount < MAX_RETRIES) {
        config._retryCount++
        const delay = RETRY_DELAY_MS * Math.pow(2, config._retryCount - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return api(config)
      }
    }

    return Promise.reject(err)
  },
)

export default api
