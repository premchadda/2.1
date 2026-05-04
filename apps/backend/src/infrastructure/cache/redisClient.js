import Redis from 'ioredis'

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
  if (typeof connection === 'string') {
    return new Redis(connection, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    })
  }

  return new Redis({
    ...connection,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: true
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
      console.error('[Redis] Connection error:', error.message)
    })

    redisClient.on('ready', () => {
      redisStatus = {
        ...redisStatus,
        connected: true,
        message: 'Redis connected',
        lastError: null
      }
      console.log('[Redis] Connected and ready')
    })

    redisClient.on('end', () => {
      redisStatus = {
        ...redisStatus,
        connected: false,
        message: 'Redis connection closed'
      }
      console.warn('[Redis] Connection closed')
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
    console.warn('[Redis] Initialization failed:', error.message)

    if (redisClient) {
      redisClient.disconnect()
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
    await redisClient.quit()
  } catch (error) {
    console.warn('[Redis] Graceful quit failed, forcing disconnect:', error.message)
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
