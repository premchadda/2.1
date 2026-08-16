/**
 * AI Response Cache
 *
 * Caches AI responses using Redis to reduce API costs and latency.
 * Falls back gracefully when Redis is unavailable.
 */

import crypto from 'crypto'

class AICache {
  constructor(redis, ttl = 3600 * 24) {
    this.redis = redis
    this.ttl = ttl
    this.prefix = 'ai:cache:'
  }

  generateKey(messages, model) {
    const content = JSON.stringify({ messages, model })
    return this.prefix + crypto.createHash('sha256').update(content).digest('hex')
  }

  async get(messages, model) {
    if (!this.redis) return null
    try {
      const key = this.generateKey(messages, model)
      const cached = await this.redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  }

  async set(messages, model, response) {
    if (!this.redis) return
    try {
      const key = this.generateKey(messages, model)
      await this.redis.setex(key, this.ttl, JSON.stringify(response))
    } catch {
      // Silently fail — cache miss is acceptable
    }
  }
}

export default AICache
