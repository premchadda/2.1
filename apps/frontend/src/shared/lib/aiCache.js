/**
 * AI Response Cache - localStorage-based with LRU eviction
 * Stores AI mentor responses for faster repeat queries.
 */

const CACHE_PREFIX = 'trstprep_ai_cache_'
const MAX_ENTRIES = 100
const DEFAULT_TTL = 60 * 60 * 1000 // 1 hour

function getAllKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(CACHE_PREFIX)) {
      keys.push(k)
    }
  }
  return keys
}

function getAccessOrder() {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + '__access_order')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setAccessOrder(order) {
  try {
    localStorage.setItem(CACHE_PREFIX + '__access_order', JSON.stringify(order))
  } catch { /* quota exceeded, ignore */ }
}

function touchKey(key) {
  let order = getAccessOrder()
  order = order.filter((k) => k !== key)
  order.push(key)
  if (order.length > MAX_ENTRIES) {
    const removed = order.splice(0, order.length - MAX_ENTRIES)
    removed.forEach((k) => {
      try { localStorage.removeItem(k) } catch { /* ignore */ }
    })
  }
  setAccessOrder(order)
}

function evictIfNeeded() {
  const keys = getAllKeys().filter((k) => !k.endsWith('__access_order'))
  if (keys.length < MAX_ENTRIES) return

  const order = getAccessOrder()
  const toRemove = order.splice(0, keys.length - MAX_ENTRIES + 1)
  toRemove.forEach((k) => {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  })
  setAccessOrder(order)
}

function hashKey(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

/**
 * Retrieve a cached AI response by key.
 * Returns the cached value or null if expired/missing.
 */
export function getCachedResponse(key) {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + hashKey(key))
    if (!stored) return null

    const entry = JSON.parse(stored)
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + hashKey(key))
      return null
    }

    touchKey(CACHE_PREFIX + hashKey(key))
    return entry.value
  } catch {
    return null
  }
}

/**
 * Store an AI response in cache.
 * @param {string} key   - cache key (usually the prompt or query)
 * @param {*}      value - response data to store
 * @param {number} ttlMs - time-to-live in ms (default 1 hour)
 */
export function setCachedResponse(key, value, ttlMs = DEFAULT_TTL) {
  try {
    evictIfNeeded()
    const entry = { value, expiresAt: Date.now() + ttlMs, createdAt: Date.now() }
    localStorage.setItem(CACHE_PREFIX + hashKey(key), JSON.stringify(entry))
    touchKey(CACHE_PREFIX + hashKey(key))
  } catch { /* quota exceeded, silently fail */ }
}

/**
 * Invalidate cache entries whose key matches a regex pattern.
 * @param {string|RegExp} pattern - keys to remove
 */
export function invalidateCache(pattern) {
  const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern
  const keys = getAllKeys().filter((k) => k !== CACHE_PREFIX + '__access_order')
  keys.forEach((k) => {
    const raw = localStorage.getItem(k)
    if (!raw) return
    try {
      const entry = JSON.parse(raw)
      const _originalKey = Object.keys(entry).length ? k : k
      if (re.test(k) || re.test(raw)) {
        localStorage.removeItem(k)
      }
    } catch { /* ignore */ }
  })
  const order = getAccessOrder().filter((k) => {
    try { return localStorage.getItem(k) !== null } catch { return false }
  })
  setAccessOrder(order)
}

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  const keys = getAllKeys().filter((k) => !k.endsWith('__access_order'))
  let totalSize = 0
  let validCount = 0
  let expiredCount = 0

  keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(k)
      if (!raw) return
      totalSize += raw.length
      const entry = JSON.parse(raw)
      if (Date.now() > entry.expiresAt) expiredCount++
      else validCount++
    } catch { /* ignore */ }
  })

  return {
    totalEntries: keys.length,
    validEntries: validCount,
    expiredEntries: expiredCount,
    totalSizeBytes: totalSize,
    maxEntries: MAX_ENTRIES,
    defaultTtlMs: DEFAULT_TTL,
  }
}
