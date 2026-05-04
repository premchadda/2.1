import { getRedisClient, isRedisReady } from './redisClient.js'

const localCache = new Map()

const LOCAL_CACHE_CLEANUP_MS = 60 * 1000

const cleanupTimer = setInterval(() => {
  const now = Date.now()

  for (const [key, value] of localCache.entries()) {
    if (value.expiresAt <= now) {
      localCache.delete(key)
    }
  }
}, LOCAL_CACHE_CLEANUP_MS)

cleanupTimer.unref()

const toNamespacedKey = (namespace, key) => `${namespace}:${key}`

const parseCachedValue = (value) => {
  if (value == null) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const serializeCachedValue = (value) => {
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value)
}

export const getCache = async (namespace, key) => {
  const cacheKey = toNamespacedKey(namespace, key)

  if (isRedisReady()) {
    const redis = getRedisClient()
    const value = await redis.get(cacheKey)
    return parseCachedValue(value)
  }

  const item = localCache.get(cacheKey)
  if (!item || item.expiresAt <= Date.now()) {
    localCache.delete(cacheKey)
    return null
  }

  return item.value
}

export const setCache = async (namespace, key, value, ttlSeconds = 300) => {
  const cacheKey = toNamespacedKey(namespace, key)

  if (isRedisReady()) {
    const redis = getRedisClient()
    await redis.set(cacheKey, serializeCachedValue(value), 'EX', ttlSeconds)
    return true
  }

  localCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  })
  return true
}

export const deleteCache = async (namespace, key) => {
  const cacheKey = toNamespacedKey(namespace, key)

  if (isRedisReady()) {
    const redis = getRedisClient()
    await redis.del(cacheKey)
    return
  }

  localCache.delete(cacheKey)
}

export const deleteCacheByPrefix = async (namespace, prefix = '') => {
  const namespacedPrefix = toNamespacedKey(namespace, prefix)

  if (isRedisReady()) {
    const redis = getRedisClient()
    const keys = await redis.keys(`${namespacedPrefix}*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    return keys.length
  }

  let deleted = 0
  for (const key of localCache.keys()) {
    if (key.startsWith(namespacedPrefix)) {
      localCache.delete(key)
      deleted += 1
    }
  }
  return deleted
}

export const cacheWithFallback = async (namespace, key, ttlSeconds, resolver) => {
  const cached = await getCache(namespace, key)
  if (cached !== null) {
    return {
      value: cached,
      hit: true
    }
  }

  const value = await resolver()
  await setCache(namespace, key, value, ttlSeconds)
  return {
    value,
    hit: false
  }
}

