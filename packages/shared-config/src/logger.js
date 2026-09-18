/**
 * Logger Utility
 *
 * Provides environment-aware logging that can be silenced in production.
 * In development, logs to console. In production, logs can be collected and sent to monitoring service.
 *
 * Usage:
 *   import { logger } from '@trstprep/shared-config'
 *   logger.info('Message')
 *   logger.warn('Warning')
 *   logger.error('Error', error)
 */

// Node-safe isDevelopment check: import.meta is syntax that may be unavailable in Node/CommonJS.
// Use try/catch and typeof guards to avoid ReferenceError when `import.meta` is undefined.
const isDevelopment = (() => {
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      typeof import.meta.env.DEV !== "undefined"
    ) {
      return Boolean(import.meta.env.DEV);
    }
  } catch {
    // import.meta not available — fall through to process.env check
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env.NODE_ENV !== "production";
  }
  return false;
})();

// Log levels: 0=error only, 1=warn, 2=info, 3=debug
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Default to debug in development, error only in production.
// PROD HYGIENE: console leakage is gated by LOG_LEVEL filtering — in production
// currentLevel === LOG_LEVELS.error, so debug/info/warn/log are no-ops and do not
// emit to console. Only explicit `logger.error` reaches console in prod.
const currentLevel = isDevelopment ? LOG_LEVELS.debug : LOG_LEVELS.error;

// Sensitive keys redacted before any console emission. Covers PII (phone,
// mobile, otp, email, full_name, avatar_url, aadhaar, pan), payment/crypto
// material (razorpay, pgcrypto, DB_ENCRYPTION_KEY, PGCRYPTO_KEY), and generic
// credential carriers (token, secret, password, authorization, jwt) so bearer
// tokens never leak via logger.error in production.
const REDACT_KEY_PATTERN =
  /phone|mobile|otp|email|full_name|avatar_url|aadhaar|pan|razorpay|pgcrypto|db_encryption_key|pgcrypto_key|token|secret|password|authorization|jwt|refresh/i;
const REDACTED = "[REDACTED]";
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/=]+/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function redactValue(value, depth = 0) {
  if (depth > 6) return REDACTED;
  if (typeof value === "string") {
    let out = value
      .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
      .replace(JWT_PATTERN, REDACTED);
    // Inline `key: value` / `key=value` pairs for sensitive keys inside strings
    out = out.replace(
      /("?(?:phone|mobile|otp|email|full_name|avatar_url|aadhaar|pan|razorpay|pgcrypto|DB_ENCRYPTION_KEY|PGCRYPTO_KEY|token|secret|password|authorization|jwt)[^:=]*["']?\s*[:=]\s*)(["']?)([^"',}\s&;]+)\2/gi,
      `$1$2${REDACTED}$2`,
    );
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, depth + 1));
  }
  if (value && typeof value === "object") {
    if (value instanceof Error) {
      const redacted = new Error(redactValue(value.message, depth + 1));
      redacted.name = value.name;
      if (value.stack) redacted.stack = redactValue(value.stack, depth + 1);
      return redacted;
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT_KEY_PATTERN.test(k)
        ? REDACTED
        : redactValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

const redactArgs = (args) => args.map((a) => redactValue(a));

function shouldLog(level) {
  return currentLevel >= LOG_LEVELS[level];
}

export const logger = {
  debug: (...args) => {
    if (shouldLog("debug")) {
      console.debug(...redactArgs(args));
    }
  },
  info: (...args) => {
    if (shouldLog("info")) {
      console.log(...redactArgs(args));
    }
  },
  warn: (...args) => {
    if (shouldLog("warn")) {
      console.warn(...redactArgs(args));
    }
  },
  error: (...args) => {
    if (shouldLog("error")) {
      console.error(...redactArgs(args));
    }
  },
  // Alias for logging objects/traces
  log: (...args) => {
    if (shouldLog("info")) {
      console.log(...redactArgs(args));
    }
  },
};

export default logger;
