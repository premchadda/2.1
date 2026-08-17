import { lazy } from 'react'

/**
 * Resilient dynamic component loader with automatic retries and reload fallback.
 *
 * Solves:
 * 1. "Failed to fetch dynamically imported module" during dev server reloads or network drops.
 * 2. Stale chunk hash 404s after new production deployments.
 * 3. React.lazy permanently caching a rejected promise.
 *
 * The one-time reload guard is only ever cleared on a SUCCESSFUL load. Previously
 * the guard key was removed before throwing, so on a persistent chunk failure
 * every page load re-armed the reload — the "test interface keeps refreshing"
 * loop (combined with the RouteErrorBoundary's Reload Page button).
 *
 * @param {() => Promise<{ default: React.ComponentType<any> }>} componentImport
 * @param {number} retries
 * @param {number} interval
 */

// Paths that must NEVER trigger an automatic page reload — reloading here would
// kill an in-progress test attempt. Covers new-style (/:seriesSlug/tests/:testId)
// AND legacy (/test/:seriesId/:testId, /test-result/..., /test-review/...)
// routes; the legacy prefix was previously missed by the regex.
const TEST_PATH_RE = /(\/tests\/|\/live-tests\/|\/pyp\/.*\/test|\/test\/|\/test-result\/|\/test-review\/)/i

const reloadKeyFor = (path) => `chunk_reload_${path}`

const hasReloaded = (path) => {
  try {
    return window.sessionStorage.getItem(reloadKeyFor(path)) === 'true'
  } catch {
    // Storage unavailable (private mode, blocked cookies…) — never auto-reload.
    return true
  }
}

const markReloaded = (path) => {
  try {
    window.sessionStorage.setItem(reloadKeyFor(path), 'true')
  } catch {
    // Ignore — the reload still runs once for this page load.
  }
}

const clearReloadGuard = () => {
  try {
    window.sessionStorage.removeItem(reloadKeyFor(window.location.pathname || ''))
  } catch {
    // Ignore
  }
}

export function lazyWithRetry(componentImport, retries = 2, interval = 1000) {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const mod = await componentImport()
        // Load succeeded — clear the guard so a future (transient) failure can
        // still get its one-time recovery reload.
        clearReloadGuard()
        return mod
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

        // All retries exhausted and it's a dynamic import failure in the browser:
        // - Test pages: NEVER reload (would disrupt an active attempt). Throw so
        //   the route error boundary shows its retryable error UI instead.
        // - Other pages: one-time auto-reload per path per session to recover
        //   from stale chunk hashes after a deployment. The guard is only cleared
        //   on success, so a persistent failure can never loop reloads.
        if (typeof window !== 'undefined' && isDynamicImportError) {
          const path = window.location.pathname || ''
          const isTestPath = TEST_PATH_RE.test(path)
          if (!isTestPath && !hasReloaded(path)) {
            markReloaded(path)
            window.location.reload()
            return new Promise(() => {}) // Suspend until browser reloads
          }
        }

        throw error
      }
    }
  })
}

export default lazyWithRetry
