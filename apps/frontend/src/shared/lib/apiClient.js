import axios from 'axios'
import { API_BASE_URL } from './apiBase.js'
import {
  createApiClient,
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError
} from '@trstprep/shared-config'

const apiUrl = (API_BASE_URL || '').replace(/\/api\/?$/, '')

// Tracks whether the user currently has an active session. The global 401
// redirect should only fire when a real session expired — NOT when an
// anonymous visitor browses public pages and a data GET returns 401.
let sessionActive = false
export const setSessionActive = (value) => { sessionActive = value }

// The shared factory wires up CSRF, error mapping, and 401/419 refresh. We
// supply the browser-only behavior (notify auth provider on fatal auth failure)
// via the onAuthFailure hook so the factory stays framework-agnostic.
const onAuthFailure = () => {
  const wasActive = sessionActive
  sessionActive = false
  if (wasActive && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('unauthorized'))
  }
}

export const apiClient = createApiClient({
  baseURL: apiUrl,
  // Cold database connections (first request after idle/restart) can take
  // ~15s. A shorter timeout surfaces as a network error and falsely logs the
  // user out, so keep this comfortably above observed cold-start latency.
  timeout: 30000,
  authEndpoints: ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/me'],
  refreshUrl: '/api/auth/refresh',
  authUrlMatch: 'includes',
  captureCsrfOnError: true,
  onAuthFailure
})

export {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError
}

// ============================================================
// In-flight GET deduplication
// Collapses identical concurrent GET requests into a single network call, so
// multiple components mounting at once (e.g. /api/auth/me, /api/test-categories)
// don't each trigger a separate round-trip. The shared promise resolves for all
// callers with the same response (read-only GETs are safe to share).
//
// Bypassed when the caller passes an AbortSignal (a shared abort would cancel
// other subscribers) or explicitly opts out with `{ dedup: false }`.
// ============================================================
const inFlightGets = new Map()

const buildGetKey = (url, config = {}) => {
  const params = config.params ? JSON.stringify(config.params) : ''
  return `${url}?${params}`
}

const originalGet = apiClient.get.bind(apiClient)
apiClient.get = (url, config = {}) => {
  if (config.signal || config.dedup === false) {
    return originalGet(url, config)
  }

  const key = buildGetKey(url, config)
  const existing = inFlightGets.get(key)
  if (existing) return existing

  const promise = originalGet(url, config).finally(() => {
    inFlightGets.delete(key)
  })
  inFlightGets.set(key, promise)
  return promise
}

export const fetchFromAPI = async (endpoint, options = {}) => {
  try {
    const config = {
      url: endpoint,
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    }

    if (options.body) {
      try {
        config.data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      } catch  {
        config.data = options.body
      }
      delete config.body
    }

    const response = await apiClient(config)
    return response.data
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error)
    if (error.response?.data) {
      return error.response.data
    }
    throw error
  }
}

export const api = apiClient
export const isCancel = axios.isCancel
