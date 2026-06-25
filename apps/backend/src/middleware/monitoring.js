/**
 * Monitoring Middleware with Redis-backed persistent metrics
 * Provides request logging, metrics collection, and health tracking
 * 
 * Falls back to in-memory storage when Redis is unavailable.
 */

import { isRedisReady, getRedisClient } from '../infrastructure/cache/redisClient.js'

// In-memory fallback metrics storage
const memoryMetrics = {
  requests: {
    total: 0,
    byMethod: {},
    byPath: {},
    byStatus: {},
    errors: 0
  },
  responseTimes: [],
  activeConnections: 0,
  startTime: Date.now()
}

// Redis key prefixes
const REDIS_KEYS = {
  REQUESTS_TOTAL: 'metrics:requests:total',
  REQUESTS_BY_METHOD: 'metrics:requests:method:',
  REQUESTS_BY_PATH: 'metrics:requests:path:',
  REQUESTS_BY_STATUS: 'metrics:requests:status:',
  REQUESTS_ERRORS: 'metrics:requests:errors',
  RESPONSE_TIMES: 'metrics:response:times',
  START_TIME: 'metrics:start:time',
}

// Response time samples to keep in Redis (last 1000)
const MAX_RESPONSE_SAMPLES = 1000

/**
 * Get Redis client if available
 */
const getRedis = () => {
  if (isRedisReady()) {
    return getRedisClient()
  }
  return null
}

/**
 * Increment a Redis counter
 */
const incrementRedisCounter = async (key, amount = 1) => {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.incrby(key, amount)
  } catch (err) {
    // Silent fail for metrics - don't break the request
  }
}

/**
 * Record response time in Redis (sliding window of last 1000)
 */
const recordResponseTime = async (duration) => {
  const redis = getRedis()
  if (!redis) {
    // In-memory fallback
    memoryMetrics.responseTimes.push(duration)
    if (memoryMetrics.responseTimes.length > MAX_RESPONSE_SAMPLES) {
      memoryMetrics.responseTimes.shift()
    }
    return
  }
  try {
    const timestamp = Date.now()
    await redis.zadd('metrics:response:times', timestamp, `${timestamp}:${duration}`)
    // Trim to keep only last MAX_RESPONSE_SAMPLES entries
    await redis.zremrangebyrank('metrics:response:times', 0, -(MAX_RESPONSE_SAMPLES + 1))
  } catch (err) {
    // Silent fail
  }
}

/**
 * Request monitoring middleware
 */
export const monitoringMiddleware = (req, res, next) => {
  const traceId = req.traceId
  const startTime = Date.now()
  
  // Track active connections
  memoryMetrics.activeConnections++
  
  // Track request
  memoryMetrics.requests.total++
  
  // Track by method
  const method = req.method
  memoryMetrics.requests.byMethod[method] = (memoryMetrics.requests.byMethod[method] || 0) + 1
  
  // Track by path (simplified - remove query params and IDs)
  const path = req.path.replace(/\/[a-f0-9-]+/gi, '/:id').replace(/\/\d+/g, '/:id')
  memoryMetrics.requests.byPath[path] = (memoryMetrics.requests.byPath[path] || 0) + 1
  
  // Async Redis updates (fire and forget)
  const redisUpdates = [
    incrementRedisCounter(REDIS_KEYS.REQUESTS_TOTAL),
    incrementRedisCounter(`${REDIS_KEYS.REQUESTS_BY_METHOD}${method}`),
    incrementRedisCounter(`${REDIS_KEYS.REQUESTS_BY_PATH}${path}`),
  ]
  
  // Hook into response finish
  res.on('finish', async () => {
    const duration = Date.now() - startTime
    if (traceId) res.setHeader('x-trace-id', traceId)
    
    // Track response time
    recordResponseTime(duration)
    
    // Track by status code
    const status = res.statusCode
    memoryMetrics.requests.byStatus[status] = (memoryMetrics.requests.byStatus[status] || 0) + 1
    
    // Track errors
    if (status >= 400) {
      memoryMetrics.requests.errors++
      incrementRedisCounter(REDIS_KEYS.REQUESTS_ERRORS)
    }
    
    // Track status in Redis
    incrementRedisCounter(`${REDIS_KEYS.REQUESTS_BY_STATUS}${status}`)
    
    // Decrease active connections
    memoryMetrics.activeConnections--
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`[SLOW REQUEST] ${method} ${req.path} - ${duration}ms - ${status}`)
    }
  })
  
  next()
}

/**
 * Get current metrics from Redis (with in-memory fallback)
 */
export const getMetrics = async () => {
  const redis = getRedis()
  
  // Always include in-memory metrics for real-time accuracy
  const responseTimes = memoryMetrics.responseTimes
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0
  
  const sortedTimes = [...responseTimes].sort((a, b) => a - b)
  const p95 = sortedTimes.length > 0
    ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
    : 0
  
  const baseMetrics = {
    uptime: Date.now() - memoryMetrics.startTime,
    requests: {
      ...memoryMetrics.requests,
      rps: memoryMetrics.requests.total / ((Date.now() - memoryMetrics.startTime) / 1000)
    },
    performance: {
      avgResponseTime: Math.round(avgResponseTime),
      p95ResponseTime: Math.round(p95),
      samples: responseTimes.length
    },
    connections: {
      active: memoryMetrics.activeConnections
    },
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  }
  
  // Try to merge Redis metrics if available
  if (redis) {
    try {
      const [
        redisTotal,
        redisErrors,
      ] = await Promise.all([
        redis.get(REDIS_KEYS.REQUESTS_TOTAL).catch(() => null),
        redis.get(REDIS_KEYS.REQUESTS_ERRORS).catch(() => null),
      ])
      
      if (redisTotal) {
        baseMetrics.requests.redisTotal = parseInt(redisTotal)
      }
      if (redisErrors) {
        baseMetrics.requests.redisErrors = parseInt(redisErrors)
      }
      baseMetrics.redis = { connected: true }
    } catch (err) {
      baseMetrics.redis = { connected: false, error: err.message }
    }
  } else {
    baseMetrics.redis = { connected: false, fallback: 'in-memory' }
  }
  
  return baseMetrics
}

/**
 * Metrics endpoint handler
 */
export const metricsHandler = async (req, res) => {
  const metrics = await getMetrics()
  res.json(metrics)
}

/**
 * Error tracking middleware
 */
export const errorTrackingMiddleware = (err, req, res, next) => {
  // Log error
  console.error('[ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  })
  
  // Track error metrics
  memoryMetrics.requests.errors++
  incrementRedisCounter(REDIS_KEYS.REQUESTS_ERRORS)
  
  next(err)
}

export default {
  monitoringMiddleware,
  getMetrics,
  metricsHandler,
  errorTrackingMiddleware
}
