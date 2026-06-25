/**
 * Lightweight error reporter.
 *
 * In production we forward uncaught errors to a centralised monitoring
 * service. Today only Sentry is supported, and it's loaded lazily so the
 * bundle stays small when no Sentry DSN is configured. If you want to
 * add a different provider (Datadog, Bugsnag, LogRocket) wrap it behind
 * the same `captureError` / `captureMessage` API.
 */

const isProd = import.meta.env.PROD
const dsn    = import.meta.env.VITE_SENTRY_DSN

let sentry = null

async function loadSentry() {
  if (sentry !== null) return sentry
  if (!dsn) { sentry = false; return null }
  try {
    const mod = await import('@sentry/browser')
    sentry = mod
    mod.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION || 'dev',
      tracesSampleRate: 0.1,
    })
    return mod
  } catch {
    // @sentry/browser is optional — silently no-op if not installed
    sentry = false
    return null
  }
}

export function initErrorReporter() {
  if (!isProd || !dsn) return
  // Wire global error handlers as soon as Sentry is loaded
  loadSentry().then((S) => {
    if (!S) return
    window.addEventListener('error', (event) => {
      S.captureException(event.error || event.message)
    })
    window.addEventListener('unhandledrejection', (event) => {
      S.captureException(event.reason)
    })
  })
}

export function captureError(error, context = {}) {
  if (!isProd || !dsn) return
  loadSentry().then((S) => {
    if (S) S.captureException(error, { extra: context })
  })
}

export function captureMessage(message, level = 'info', context = {}) {
  if (!isProd || !dsn) return
  loadSentry().then((S) => {
    if (S) S.captureMessage(message, { level, extra: context })
  })
}
