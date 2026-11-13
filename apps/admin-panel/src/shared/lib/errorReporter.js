/**
 * Lightweight error reporter.
 *
 * In production we forward uncaught errors to a centralised monitoring
 * service. Today only Sentry is supported, and it's loaded lazily so the
 * bundle stays small when no Sentry DSN is configured. If you want to
 * add a different provider (Datadog, Bugsnag, LogRocket) wrap it behind
 * the same `captureError` / `captureMessage` API.
 *
 * @sentry/browser is intentionally optional. The /* @vite-ignore */
 * comment prevents Vite/Rollup from failing the build when the package
 * is not installed. The try/catch handles the runtime absence case.
 */

const isProd = import.meta.env.PROD;
const dsn = import.meta.env.VITE_SENTRY_DSN;

let sentry = null;

async function loadSentry() {
  if (sentry !== null) return sentry;
  if (!dsn) {
    sentry = false;
    return null;
  }
  try {
    // @vite-ignore — package is optional; do not fail the build if missing
    const mod = await import(/* @vite-ignore */ "@sentry/browser");
    sentry = mod;
    mod.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION || "dev",
      tracesSampleRate: 0.1,
    });
    return mod;
  } catch {
    // @sentry/browser is optional — silently no-op if not installed
    sentry = false;
    return null;
  }
}

const SENSITIVE_KEY_RE =
  /authorization|cookie|set-cookie|^token$|refresh[_-]?token|csrf|x-csrf/i;

function stripSensitive(value, seen = new Set()) {
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => stripSensitive(v, seen));
  const out = { ...value };
  for (const key of Object.keys(out)) {
    if (SENSITIVE_KEY_RE.test(key)) out[key] = "[REDACTED]";
    else if (typeof out[key] === "string" && /Bearer\s+\S+/.test(out[key])) {
      out[key] = out[key].replace(/Bearer\s+\S+/g, "Bearer [REDACTED]");
    } else out[key] = stripSensitive(out[key], seen);
  }
  return out;
}

export function initErrorReporter() {
  if (!isProd || !dsn) return;
  // Wire global error handlers as soon as Sentry is loaded
  loadSentry().then((S) => {
    if (!S) return;
    window.addEventListener("error", (event) => {
      S.captureException(event.error || event.message);
    });
    window.addEventListener("unhandledrejection", (event) => {
      S.captureException(event.reason);
    });
  });
}

export function captureError(error, context = {}) {
  if (!isProd || !dsn) return;
  const safeContext = stripSensitive(context);
  loadSentry().then((S) => {
    if (S) S.captureException(error, { extra: safeContext });
  });
}

export function captureMessage(message, level = "info", context = {}) {
  if (!isProd || !dsn) return;
  const safeContext = stripSensitive(context);
  loadSentry().then((S) => {
    if (S) S.captureMessage(message, { level, extra: safeContext });
  });
}
