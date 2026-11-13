/**
 * Lightweight error reporter.
 *
 * In production we forward uncaught errors to a centralised monitoring
 * service. Today only Sentry is supported. The actual @sentry/browser
 * package is not bundled until it is added as a dependency and the
 * lockfile is updated. Until then this module is a safe no-op.
 *
 * To activate Sentry later:
 *   1. pnpm --filter trstprep-admin add @sentry/browser
 *   2. Restore the dynamic import in loadSentry()
 *   3. Call initErrorReporter() from main.jsx
 *   4. Set VITE_SENTRY_DSN in the environment
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
  // @sentry/browser is not installed — keep this a pure no-op so the
  // production build never tries to resolve the package.
  // Re-enable the dynamic import once the dependency + lockfile are in place.
  sentry = false;
  return null;
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
