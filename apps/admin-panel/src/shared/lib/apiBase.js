/**
 * Centralized API base URL resolver.
 *
 * Priority:
 *  1. VITE_API_URL environment variable (set in .env / production build)
 *  2. Same-host dynamic resolution — useful for LAN access from other devices
 *
 * Usage:
 *   import { API_BASE_URL } from '@/shared/lib/apiBase'
 *   fetch(`${API_BASE_URL}/api/some-endpoint`)
 */
export const API_BASE_URL = (() => {
  const url = (() => {
    // 1. Explicit env var wins
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL
    }

    if (typeof window !== 'undefined') {
      // 2. In development (Vite), use relative paths to leverage the proxy.
      if (window.location.port === '3000') {
        return ''
      }

      // 3. Fallback for other ports (unlikely in this dev setup)
      let resolvedUrl
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        resolvedUrl = `${window.location.protocol}//localhost:${import.meta.env.VITE_BACKEND_PORT || ''}`
      } else {
        resolvedUrl = `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || ''}`
      }
      return resolvedUrl
    }

    return process.env.VITE_API_URL || process.env.API_URL || '' // SSR fallback
  })()
  
  return url
})()

/** Convenience: the full API prefix ready for direct concatenation */
export const API_URL = API_BASE_URL
