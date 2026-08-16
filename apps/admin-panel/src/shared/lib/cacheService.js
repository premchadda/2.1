class CacheService {
  constructor() {
    this.cache = new Map()
    this.cacheTimeouts = new Map()
    this.defaultTTL = 30000 // 30 seconds
    this.longTTL = 300000 // 5 minutes for less frequently changing data
  }

  // Generate cache key
  generateKey(endpoint, params = {}) {
    const paramStr = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&')
    return `${endpoint}?${paramStr}`
  }

  // Set item in cache with TTL
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    })
    
    // Clear existing timeout
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key))
    }
    
    // Set new timeout to auto-expire
    const timeoutId = setTimeout(() => {
      this.cache.delete(key)
      this.cacheTimeouts.delete(key)
    }, ttl)
    
    this.cacheTimeouts.set(key, timeoutId)
  }

  // Get item from cache if valid
  get(key) {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expiresAt) {
      // Expired, remove it
      this.cache.delete(key)
      if (this.cacheTimeouts.has(key)) {
        clearTimeout(this.cacheTimeouts.get(key))
        this.cacheTimeouts.delete(key)
      }
      return null
    }
    
    return item.data
  }

  // Check if key exists and is valid
  has(key) {
    return this.get(key) !== null
  }

  // Clear specific cache entry
  delete(key) {
    this.cache.delete(key)
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key))
      this.cacheTimeouts.delete(key)
    }
  }

  // Clear all cache
  clear() {
    this.cache.clear()
    this.cacheTimeouts.forEach(timeoutId => clearTimeout(timeoutId))
    this.cacheTimeouts.clear()
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

export { CacheService }
export default CacheService
