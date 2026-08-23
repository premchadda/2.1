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

import pino from "pino";
import logBuffer from "./logBuffer.js";

const isProduction = process.env.NODE_ENV === "production";

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  // Redact sensitive fields automatically
  redact: [
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "apiKey",
    "api_key",
    "secret",
    "jwt",
    "jwtSecret",
    "sessionId",
    "cookie",
    "csrfToken",
    "*.password",
    "*.token",
    "*.secret",
    "*.apiKey",
    "req.headers.authorization",
    "req.headers.cookie",
  ],
  // In production, use JSON transport; in dev, pretty-print
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
  base: {
    pid: process.pid,
    service: "trstprep-backend",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Proxy pinoInstance so logBuffer captures all structured log calls
const createLogProxy = (instance) => {
  return new Proxy(instance, {
    get(target, prop) {
      const orig = target[prop];
      if (
        typeof orig === "function" &&
        ["info", "warn", "error", "debug", "trace", "fatal"].includes(prop)
      ) {
        return function (...args) {
          try {
            let msg = "";
            let details = null;
            if (typeof args[0] === "object" && args[0] !== null) {
              details = args[0];
              msg =
                args.slice(1).join(" ") ||
                details.err?.message ||
                details.message ||
                "";
            } else {
              msg = args.join(" ");
            }
            logBuffer.push({
              level:
                prop === "fatal" ? "error" : prop === "trace" ? "debug" : prop,
              source: "pino",
              message: msg,
              details: details,
            });
          } catch {
            // intentionally empty - log buffer push should not break logging
          }
          return orig.apply(target, args);
        };
      }
      return orig;
    },
  });
};

const logger = createLogProxy(pinoInstance);

/**
 * Create a child logger with request context (requestId, userId).
 * @param {object} context - { requestId, userId, ... }
 * @returns {pino.Logger}
 */
export const createRequestLogger = (context = {}) =>
  createLogProxy(pinoInstance.child(context));

export default logger;
