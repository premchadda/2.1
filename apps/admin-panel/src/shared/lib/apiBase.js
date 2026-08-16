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
      // Both frontend (3000) and admin panel (3002) use Vite proxy in dev.
      const devPorts = ['3000', '3002']
      if (devPorts.includes(window.location.port)) {
        return ''
      }

      // 3. Fallback for other ports — DEV ONLY (MED-05: never expose the raw
      // backend port in production bundles).
      if (import.meta.env.DEV) {
        const backendPort = import.meta.env.VITE_BACKEND_PORT
          || (import.meta.env.VITE_BACKEND_URL?.match(/:(\d+)/)?.[1])
          || '5001'
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return `${window.location.protocol}//localhost:${backendPort}`
        }
        return `${window.location.protocol}//${window.location.hostname}:${backendPort}`
      }

      // 4. Production without VITE_API_URL: fail hard instead of guessing.
      return ''
    }

    return process.env.VITE_API_URL || process.env.API_URL || '' // SSR fallback
  })()

  if (!url && typeof window !== 'undefined' && !import.meta.env.DEV) {
    console.error('[apiBase] VITE_API_URL is not set for production build')
  }

  return url
})()

/** Convenience: the full API prefix ready for direct concatenation */
export const API_URL = API_BASE_URL
