/**
 * Environment-aware logging utility
 *
 * Filters log output based on environment:
 * - Production: Only errors are logged
 * - Development: All logs (error, warn, log, debug)
 *
 * Security: error() redacts bearer tokens / Authorization headers before
 * printing — never log secrets/tokens. Values matching /Bearer\s+\S+/ or
 * authorization-like keys are masked.
 *
 * Usage:
 *   import { logger } from '../../shared/lib/logger'
 *   logger.error('Critical error:', error)
 *   logger.warn('Deprecation warning')
 *   logger.log('Debug info')
 *   logger.debug('Detailed trace')
 */

const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/=]+/g;
const SENSITIVE_KEY_RE = /authorization|refresh[_-]?token|^token$/i;

function redactValue(value, seen = new Set()) {
  if (typeof value === "string") {
    return value.replace(BEARER_RE, "Bearer [REDACTED]");
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(v, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return value;
    seen.add(value);
    if (value instanceof Error) return value;
    const out = { ...value };
    for (const key of Object.keys(out)) {
      if (SENSITIVE_KEY_RE.test(key)) out[key] = "[REDACTED]";
      else out[key] = redactValue(out[key], seen);
    }
    return out;
  }
  return value;
}

export const logger = {
  /**
   * Always log errors (production-safe)
   */
  error: (...args) => {
    console.error(...args.map((a) => redactValue(a)));
  },

  /**
   * Warnings - development only
   */
  warn: (...args) => {
    if (import.meta.env.DEV) {
      console.warn(...args);
    }
  },

  /**
   * General logs - development only
   */
  log: (...args) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },

  /**
   * Debug logs - development only
   */
  debug: (...args) => {
    if (import.meta.env.DEV) {
      console.debug(...args);
    }
  },

  /**
   * Performance timing utility
   * Usage:
   *   const timer = logger.timer('operation-name')
   *   // ... do work ...
   *   timer.end() // Logs: "[Perf] operation-name: 123ms"
   */
  timer: (label) => {
    const start = performance.now();
    return {
      end: () => {
        const duration = Math.round(performance.now() - start);
        logger.log(`[Perf] ${label}: ${duration}ms`);
      },
    };
  },
};

export default logger;
