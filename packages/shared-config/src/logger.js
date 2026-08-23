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

function shouldLog(level) {
  return currentLevel >= LOG_LEVELS[level];
}

export const logger = {
  debug: (...args) => {
    if (shouldLog("debug")) {
      console.debug(...args);
    }
  },
  info: (...args) => {
    if (shouldLog("info")) {
      console.log(...args);
    }
  },
  warn: (...args) => {
    if (shouldLog("warn")) {
      console.warn(...args);
    }
  },
  error: (...args) => {
    if (shouldLog("error")) {
      console.error(...args);
    }
  },
  // Alias for logging objects/traces
  log: (...args) => {
    if (shouldLog("info")) {
      console.log(...args);
    }
  },
};

export default logger;
