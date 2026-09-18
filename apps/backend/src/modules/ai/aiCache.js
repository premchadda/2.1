/**
 * AI Response Cache
 *
 * Caches AI responses using Redis to reduce API costs and latency.
 * Falls back gracefully when Redis is unavailable.
 */

import crypto from "crypto";

class AICache {
  constructor(redis, ttl = 3600 * 24) {
    this.redis = redis;
    this.ttl = ttl;
    this.prefix = "ai:cache:";
  }

  generateKey(messages, model, templateVersion = "") {
    const content = JSON.stringify({
      messages,
      model,
      templateVersion: templateVersion || "",
    });
    return (
      this.prefix + crypto.createHash("sha256").update(content).digest("hex")
    );
  }

  async get(messages, model, ...rest) {
    if (!this.redis) return null;
    try {
      const key = this.generateKey(messages, model, ...rest);
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  async set(messages, model, response, ...rest) {
    if (!this.redis) return;
    try {
      const key = this.generateKey(messages, model, ...rest);
      await this.redis.setex(key, this.ttl, JSON.stringify(response));
    } catch {
      // Silently fail — cache miss is acceptable
    }
  }
}

export default AICache;
