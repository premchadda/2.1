/**
 * API Client - Axios instance with interceptors
 * 
 * Configures axios with:
 * - Base URL from config
 * - httpOnly cookie authentication
 * - CSRF token support
 * - Error interceptors for auth handling
 */

import axios from 'axios'
import { API_BASE_URL } from './apiBase.js'
import { getCsrfToken } from '../providers/AuthContext.jsx'
import { NetworkError, AuthenticationError, ValidationError, NotFoundError, DataError } from './errors.js'

/**
 * Create axios instance with httpOnly cookie support
 */
export const createApiClient = (baseURL = API_BASE_URL) => {
  const apiClient = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true, // Enable cookies for httpOnly token storage
  })

  // Request interceptor - add CSRF token for mutations
  apiClient.interceptors.request.use(
    (config) => {
      const method = config.method?.toUpperCase()
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const csrfToken = getCsrfToken()
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken
        }
      }
      return config
    },
    (error) => Promise.reject(new NetworkError('Request setup failed', error))
  )

  // Response interceptor - handle errors with typed exceptions
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        const { status, data } = error.response
        const message = data?.message || error.message || 'Unknown error'

        switch (status) {
          case 400:
            return Promise.reject(new ValidationError(message, data))
          case 401:
            sessionStorage.removeItem('trstprep_session_meta')
            window.dispatchEvent(new Event('unauthorized'))
            return Promise.reject(new AuthenticationError(message, data))
          case 403:
            return Promise.reject(new AuthenticationError('Access forbidden', data))
          case 404:
            return Promise.reject(new NotFoundError(message, data))
          case 500:
            return Promise.reject(new DataError('Server error', 'SERVER_ERROR', data))
          default:
            return Promise.reject(new DataError(message, `HTTP_${status}`, data))
        }
      } else if (error.request) {
        return Promise.reject(new NetworkError('Network error - please check your connection', error.request))
      } else {
        return Promise.reject(new NetworkError('Request failed', error.message))
      }
    }
  )

  return apiClient
}

export default createApiClient