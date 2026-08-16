import Redis from 'ioredis'
import logger from '../logger/logger.js'

const DEFAULT_REDIS_PORT = 6379

let redisClient = null
let redisStatus = {
  enabled: false,
  connected: false,
  message: 'Redis is not configured',
  lastError: null
}

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const resolveRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    return {
      enabled: true,
      connection: redisUrl
    }
  }

  const host = process.env.REDIS_HOST
  if (!host) {
    return {
      enabled: false,
      connection: null
    }
  }

  return {
    enabled: true,
    connection: {
      host,
      port: parseInteger(process.env.REDIS_PORT, DEFAULT_REDIS_PORT),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInteger(process.env.REDIS_DB, 0)
    }
  }
}

const buildClient = (connection) => {
  // Detect TLS requirement:
  // - `rediss://` URL scheme → TLS
  // - REDIS_TLS=true env var → TLS (for host-based config)
  const needsTls = (typeof connection === 'string' && connection.startsWith('rediss://'))
    || process.env.REDIS_TLS === 'true'
  const tlsOptions = needsTls ? { tls: { rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false' } } : {}

  if (typeof connection === 'string') {
    return new Redis(connection, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      ...tlsOptions,
    })
  }

  return new Redis({
    ...connection,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    ...tlsOptions,
  })
}

export const initRedis = async () => {
  if (redisClient) {
    return redisClient
  }

  const config = resolveRedisConfig()
  if (!config.enabled) {
    redisStatus = {
      enabled: false,
      connected: false,
      message: 'Redis not configured. Using in-memory cache.',
      lastError: null
    }
    return null
  }

  try {
    redisClient = buildClient(config.connection)

    redisClient.on('error', (error) => {
      redisStatus = {
        ...redisStatus,
        connected: false,
        message: 'Redis connection error',
        lastError: error.message
      }
      logger.error('[Redis] Connection error:', error.message)
    })

    redisClient.on('ready', () => {
      redisStatus = {
        ...redisStatus,
        connected: true,
        message: 'Redis connected',
        lastError: null
      }
      logger.info('[Redis] Connected and ready')
    })

    redisClient.on('end', () => {
      redisStatus = {
        ...redisStatus,
        connected: false,
        message: 'Redis connection closed'
      }
      logger.warn('[Redis] Connection closed')
    })

    await redisClient.connect()
    await redisClient.ping()

    redisStatus = {
      enabled: true,
      connected: true,
      message: 'Redis connected',
      lastError: null
    }

    return redisClient
  } catch (error) {
    redisStatus = {
      enabled: true,
      connected: false,
      message: 'Redis unavailable. Using in-memory cache.',
      lastError: error.message
    }
    logger.warn('[Redis] Initialization failed:', error.message)

    if (redisClient) {
      // M13: remove listeners before disconnecting so failed-connection retries
      // do not accumulate orphaned 'error'/'end' handlers on the old client.
      try {
        redisClient.removeAllListeners()
      } catch { /* ignore */ }
      try {
        redisClient.disconnect()
      } catch { /* ignore */ }
      redisClient = null
    }
    return null
  }
}

export const getRedisClient = () => redisClient

export const isRedisReady = () => Boolean(redisClient && redisClient.status === 'ready')

export const getRedisStatus = () => ({
  ...redisStatus,
  state: redisClient?.status || 'not_initialized'
})

export const closeRedis = async () => {
  if (!redisClient) {
    return
  }

  try {
    // Race quit() against a 5-second timeout — if Redis is unresponsive,
    // the QUIT command could hang indefinitely, blocking gracefulShutdown.
    await Promise.race([
      redisClient.quit(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis quit timeout')), 5000)),
    ])
  } catch (error) {
    logger.warn('[Redis] Graceful quit failed, forcing disconnect:', error.message)
    redisClient.disconnect()
  } finally {
    redisClient = null
    redisStatus = {
      ...redisStatus,
      connected: false,
      message: 'Redis client closed'
    }
  }
}
