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
  // 1. Explicit env var wins — must be set for production/staging builds.
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  if (typeof window !== 'undefined') {
    // 2. In development (Vite), use a relative path so the dev server proxy
    //    (configured in vite.config) routes /api to the backend. This avoids
    //    guessing host/port, which was fragile (M34).
    const devPorts = ['3000', '3002']
    if (devPorts.includes(window.location.port)) {
      return ''
    }

    // 3. Production without an explicit VITE_API_URL: same-origin (the API is
    //    served from the same host via nginx). No port guessing.
    return ''
  }

  // SSR / build-time fallback — strictly env based.
  if (process.env.VITE_API_URL || process.env.API_URL) {
    return process.env.VITE_API_URL || process.env.API_URL
  }

  console.error('API Base URL not defined (set VITE_API_URL).')
  return ''
})()

/** Convenience: the full API prefix ready for direct concatenation */
export const API_URL = API_BASE_URL
