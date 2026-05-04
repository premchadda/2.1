/**
 * Cache Service - Intelligent caching with TTL and auto-expiration
 * 
 * Provides in-memory caching with configurable TTL (time-to-live)
 * for API responses and other data.
 */

class CacheService {
  constructor() {
    this.cache = new Map()
    this.cacheTimeouts = new Map()
    this.defaultTTL = 30000 // 30 seconds
    this.longTTL = 300000 // 5 minutes for less frequently changing data
  }

  /**
   * Generate cache key from endpoint and params
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {string} Cache key
   */
  generateKey(endpoint, params = {}) {
    const paramStr = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&')
    return `${endpoint}?${paramStr}`
  }

  /**
   * Set item in cache with TTL
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
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

  /**
   * Get item from cache if valid (not expired)
   * @param {string} key - Cache key
   * @returns {*} Cached data or null
   */
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

  /**
   * Check if key exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null
  }

  /**
   * Clear specific cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key)
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key))
      this.cacheTimeouts.delete(key)
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear()
    this.cacheTimeouts.forEach(timeoutId => clearTimeout(timeoutId))
    this.cacheTimeouts.clear()
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

export const cache = new CacheService()
export default cache