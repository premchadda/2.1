/**
 * Logger Utility
 *
 * Provides environment-aware logging that can be silenced in production.
 * In development, logs to console. In production, logs can be collected and sent to monitoring service.
 */

// Node-safe isDevelopment: import.meta may be undefined in Node/SSR builds
const isDevelopment: boolean = (() => {
  try {
    // @ts-ignore - import.meta is Vite-specific and may not exist in Node
    if (
      typeof import.meta !== "undefined" &&
      (import.meta as any).env &&
      typeof (import.meta as any).env.DEV !== "undefined"
    ) {
      return Boolean((import.meta as any).env.DEV);
    }
  } catch {
    // ignore
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env.NODE_ENV !== "production";
  }
  return false;
})();

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * PROD HYGIENE: LOG_LEVEL filtering prevents console leakage in production.
 * In prod, currentLevel === ERROR so debug/info/warn/log are no-ops.
 */
const currentLevel: LogLevel = isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;

function shouldLog(level: LogLevel): boolean {
  return currentLevel >= level;
}

export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  log: (...args: any[]) => void;
}

const logger: Logger = {
  debug: (...args: any[]): void => {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(...args);
    }
  },

  info: (...args: any[]): void => {
    if (shouldLog(LogLevel.INFO)) {
      console.log(...args);
    }
  },

  warn: (...args: any[]): void => {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(...args);
    }
  },

  error: (...args: any[]): void => {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(...args);
    }
  },

  log: (...args: any[]): void => {
    if (shouldLog(LogLevel.INFO)) {
      console.log(...args);
    }
  },
};

export { logger };
