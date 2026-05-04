/**
 * Centralized API base URL resolver.
 * HIGH-03 FIX: All hostnames now come from environment variables
 * No hardcoded localhost values in production path
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
    // 1. Explicit env var wins - should be set for all environments
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL
    }

    if (typeof window !== 'undefined') {
      // 2. In development (Vite), use relative paths to leverage the proxy.
      if (window.location.port === '3000') {
        return '' 
      }

      // 3. Fallback: use same hostname with backend port from env or default
      const backendPort = import.meta.env.VITE_BACKEND_PORT || '5001'
      return `${window.location.protocol}//${window.location.hostname}:${backendPort}`
    }

    // SSR fallback - strictly env based
    const ssrHost = process.env.VITE_API_URL || process.env.API_URL
    if (ssrHost) return ssrHost
    
    // Throw error or handle properly if no environment provided and not in browser
    console.error('API Base URL not defined in environment.')
    return ''
  })()
  
  return url
})()

/** Convenience: the full API prefix ready for direct concatenation */
export const API_URL = API_BASE_URL
