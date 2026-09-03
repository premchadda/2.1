import Redis from "ioredis";
import logger from "../logger/logger.js";

const DEFAULT_REDIS_PORT = 6379;

let redisClient = null;
let redisStatus = {
  enabled: false,
  connected: false,
  message: "Redis is not configured",
  lastError: null,
};

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
};

const redisTimeout = () =>
  Math.min(parseInteger(process.env.REDIS_CONNECT_TIMEOUT_MS, 4000), 10000);
const redisCommandTimeout = () =>
  Math.min(parseInteger(process.env.REDIS_COMMAND_TIMEOUT_MS, 2500), 10000);
const redisRetries = () =>
  Math.min(parseInteger(process.env.REDIS_MAX_RETRIES_PER_REQUEST, 1), 3);

let consecutiveTimeouts = 0;
let circuitOpenUntil = 0;

export const recordRedisFailure = () => {
  consecutiveTimeouts++;
  if (consecutiveTimeouts >= 3 && Date.now() > circuitOpenUntil) {
    circuitOpenUntil = Date.now() + 30_000;
    logger.warn(
      "[Redis] Circuit breaker tripped: Redis is timing out. Pausing remote Redis calls for 30s to preserve fast response times.",
    );
  }
};

export const recordRedisSuccess = () => {
  consecutiveTimeouts = 0;
};

export const isRedisReady = () => {
  if (Date.now() < circuitOpenUntil) return false;
  return Boolean(redisClient && redisClient.status === "ready");
};

export const isRedisHealthy = isRedisReady;

const clientOptions = () => ({
  lazyConnect: true,
  connectTimeout: redisTimeout(),
  commandTimeout: redisCommandTimeout(),
  maxRetriesPerRequest: redisRetries(),
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 250, 2000),
});

const resolveRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    return {
      enabled: true,
      connection: redisUrl,
    };
  }

  const host = process.env.REDIS_HOST;
  if (!host) {
    return {
      enabled: false,
      connection: null,
    };
  }

  return {
    enabled: true,
    connection: {
      host,
      port: parseInteger(process.env.REDIS_PORT, DEFAULT_REDIS_PORT),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInteger(process.env.REDIS_DB, 0),
    },
  };
};

const buildClient = (connection) => {
  // Detect TLS requirement:
  // - `rediss://` URL scheme → TLS
  // - REDIS_TLS=true env var → TLS (for host-based config)
  const needsTls =
    (typeof connection === "string" && connection.startsWith("rediss://")) ||
    process.env.REDIS_TLS === "true";
  const tlsOptions = needsTls
    ? {
        tls: {
          rejectUnauthorized:
            process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false",
        },
      }
    : {};

  if (typeof connection === "string") {
    return new Redis(connection, {
      ...clientOptions(),
      ...tlsOptions,
    });
  }

  return new Redis({
    ...connection,
    ...clientOptions(),
    ...tlsOptions,
  });
};

export const initRedis = async () => {
  if (redisClient) {
    return redisClient;
  }

  const config = resolveRedisConfig();
  if (!config.enabled) {
    redisStatus = {
      enabled: false,
      connected: false,
      message: "Redis not configured. Using in-memory cache.",
      lastError: null,
    };
    return null;
  }

  try {
    redisClient = buildClient(config.connection);

    redisClient.on("error", (error) => {
      recordRedisFailure();
      redisStatus = {
        ...redisStatus,
        connected: false,
        message: "Redis connection error",
        lastError: error.message,
      };
      logger.error("[Redis] Connection error:", error.message);
    });

    redisClient.on("ready", () => {
      recordRedisSuccess();
      redisStatus = {
        ...redisStatus,
        connected: true,
        message: "Redis connected",
        lastError: null,
      };
      logger.info("[Redis] Connected and ready");
    });

    redisClient.on("end", () => {
      redisStatus = {
        ...redisStatus,
        connected: false,
        message: "Redis connection closed",
      };
      logger.warn("[Redis] Connection closed");
    });

    await redisClient.connect();
    await redisClient.ping();

    redisStatus = {
      enabled: true,
      connected: true,
      message: "Redis connected",
      lastError: null,
    };

    return redisClient;
  } catch (error) {
    redisStatus = {
      enabled: true,
      connected: false,
      message: "Redis unavailable. Using in-memory cache.",
      lastError: error.message,
    };
    logger.warn("[Redis] Initialization failed:", error.message);

    if (redisClient) {
      // M13: remove listeners before disconnecting so failed-connection retries
      // do not accumulate orphaned 'error'/'end' handlers on the old client.
      try {
        redisClient.removeAllListeners();
      } catch {
        /* ignore */
      }
      try {
        redisClient.disconnect();
      } catch {
        /* ignore */
      }
      redisClient = null;
    }
    return null;
  }
};

export const getRedisClient = () => redisClient;

export const getRedisStatus = () => ({
  ...redisStatus,
  state: redisClient?.status || "not_initialized",
});

export const closeRedis = async () => {
  if (!redisClient) {
    return;
  }

  try {
    // Race quit() against a 5-second timeout — if Redis is unresponsive,
    // the QUIT command could hang indefinitely, blocking gracefulShutdown.
    await Promise.race([
      redisClient.quit(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis quit timeout")), 5000),
      ),
    ]);
  } catch (error) {
    logger.warn(
      "[Redis] Graceful quit failed, forcing disconnect:",
      error.message,
    );
    redisClient.disconnect();
  } finally {
    redisClient = null;
    redisStatus = {
      ...redisStatus,
      connected: false,
      message: "Redis client closed",
    };
  }
};
