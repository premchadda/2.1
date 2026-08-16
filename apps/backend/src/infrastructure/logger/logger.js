/**
 * Centralized structured logger for the backend.
 *
 * Uses pino for high-performance structured JSON logging.
 * In production: JSON transport, automatic redaction of sensitive fields.
 * In development: pretty-printed output.
 *
 * Usage:
 *   import logger from './infrastructure/logger/logger.js'
 *   logger.info({ requestId, userId }, 'message')
 *   logger.error({ err: error }, 'failure')
 */

import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  // Redact sensitive fields automatically
  redact: [
    'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
    'authorization', 'apiKey', 'api_key', 'secret', 'jwt', 'jwtSecret',
    'sessionId', 'cookie', 'csrfToken',
    '*.password', '*.token', '*.secret', '*.apiKey',
    'req.headers.authorization', 'req.headers.cookie',
  ],
  // In production, use JSON transport; in dev, pretty-print
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
  base: {
    pid: process.pid,
    service: 'trstprep-backend',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * Create a child logger with request context (requestId, userId).
 * @param {object} context - { requestId, userId, ... }
 * @returns {pino.Logger}
 */
export const createRequestLogger = (context = {}) => logger.child(context)

export default logger
