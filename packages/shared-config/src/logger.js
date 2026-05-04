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

const isDevelopment = import.meta.env.DEV

// Log levels: 0=error only, 1=warn, 2=info, 3=debug
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}

// Default to debug in development, error only in production
const currentLevel = isDevelopment ? LOG_LEVELS.debug : LOG_LEVELS.error

function shouldLog(level) {
  return currentLevel >= LOG_LEVELS[level]
}



export const logger = {
  debug: (...args) => {
    if (shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(...args)
    }
  },
  info: (...args) => {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.log(...args)
    }
  },
  warn: (...args) => {
    if (shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(...args)
    }
  },
  error: (...args) => {
    if (shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(...args)
    }
  },
  // Alias for logging objects/traces
  log: (...args) => {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.log(...args)
    }
  }
}

export default logger
