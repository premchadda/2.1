import { lazy } from 'react'

/**
 * Resilient dynamic component loader with automatic retries and reload fallback.
 *
 * Solves:
 * 1. "Failed to fetch dynamically imported module" during dev server reloads or network drops.
 * 2. Stale chunk hash 404s after new production deployments.
 * 3. React.lazy permanently caching a rejected promise.
 *
 * @param {() => Promise<{ default: React.ComponentType<any> }>} componentImport
 * @param {number} retries
 * @param {number} interval
 */
export function lazyWithRetry(componentImport, retries = 2, interval = 1000) {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await componentImport()
      } catch (error) {
        const errorMsg = error?.message || ''
        const isDynamicImportError =
          error?.name === 'TypeError' ||
          /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
            errorMsg
          )

        // If it's a transient network or module fetch error and we still have attempts left:
        if (attempt < retries && isDynamicImportError) {
          await new Promise((resolve) => setTimeout(resolve, interval * Math.pow(1.5, attempt)))
          continue
        }

        // If all retries failed and it's a dynamic import failure in the browser,
        // perform a one-time force reload for regular pages, but NEVER disrupt an active test session.
        if (typeof window !== 'undefined' && isDynamicImportError) {
          const path = window.location.pathname || ''
          const isTestPath = /\/tests\/|\/live-tests\/|\/pyp\/.*\/test/i.test(path)
          if (!isTestPath) {
            const reloadKey = `chunk_reload_${path}`
            const hasReloaded = window.sessionStorage.getItem(reloadKey)
            if (!hasReloaded) {
              window.sessionStorage.setItem(reloadKey, 'true')
              window.location.reload()
              return new Promise(() => {}) // Suspend until browser reloads
            }
            window.sessionStorage.removeItem(reloadKey)
          }
        }

        throw error
      }
    }
  })
}

export default lazyWithRetry
