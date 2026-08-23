class CacheService {
  constructor({ maxSize = 200 } = {}) {
    this.cache = new Map();
    this.cacheTimeouts = new Map();
    this.defaultTTL = 30000; // 30 seconds
    this.longTTL = 300000; // 5 minutes for less frequently changing data
    this.maxSize = maxSize;
  }

  // Generate cache key - safe encoding, no [object Object]
  generateKey(endpoint, params = {}) {
    const keys = Object.keys(params || {}).sort();
    if (!keys.length) return String(endpoint);
    const paramStr = keys
      .map((k) => {
        const v = params[k];
        if (v == null) return null;
        const val = typeof v === "object" ? JSON.stringify(v) : String(v);
        return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
      })
      .filter(Boolean)
      .join("&");
    return paramStr ? `${endpoint}?${paramStr}` : String(endpoint);
  }

  // Set item in cache with TTL + LRU eviction
  set(key, data, ttl = this.defaultTTL) {
    // LRU eviction if over maxSize
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.delete(oldestKey);
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });

    // Clear existing timeout
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key));
    }

    // Set new timeout to auto-expire
    const timeoutId = setTimeout(() => {
      this.cache.delete(key);
      this.cacheTimeouts.delete(key);
    }, ttl);

    this.cacheTimeouts.set(key, timeoutId);
  }

  // Get item from cache if valid - true LRU: move to end on access
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      // Expired, remove it
      this.cache.delete(key);
      if (this.cacheTimeouts.has(key)) {
        clearTimeout(this.cacheTimeouts.get(key));
        this.cacheTimeouts.delete(key);
      }
      return null;
    }
    // Move to end for LRU
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.data;
  }

  // Check if key exists and is valid - distinguishes cached null vs miss
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  // Clear specific cache entry
  delete(key) {
    this.cache.delete(key);
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key));
      this.cacheTimeouts.delete(key);
    }
  }

  // Clear all cache
  clear() {
    this.cache.clear();
    this.cacheTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.cacheTimeouts.clear();
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export { CacheService };
export default CacheService;
