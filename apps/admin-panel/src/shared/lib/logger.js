/**
 * Environment-aware logging utility
 * 
 * Filters log output based on environment:
 * - Production: Only errors are logged
 * - Development: All logs (error, warn, log, debug)
 * 
 * Usage:
 *   import { logger } from '../../shared/lib/logger'
 *   logger.error('Critical error:', error)
 *   logger.warn('Deprecation warning')
 *   logger.log('Debug info')
 *   logger.debug('Detailed trace')
 */

export const logger = {
  /**
   * Always log errors (production-safe)
   */
  error: (...args) => {
    console.error(...args)
  },

  /**
   * Warnings - development only
   */
  warn: (...args) => {
    if (import.meta.env.DEV) {
      console.warn(...args)
    }
  },

  /**
   * General logs - development only
   */
  log: (...args) => {
    if (import.meta.env.DEV) {
      console.log(...args)
    }
  },

  /**
   * Debug logs - development only
   */
  debug: (...args) => {
    if (import.meta.env.DEV) {
      console.debug(...args)
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
    const start = performance.now()
    return {
      end: () => {
        const duration = Math.round(performance.now() - start)
        logger.log(`[Perf] ${label}: ${duration}ms`)
      }
    }
  }
}

export default logger
