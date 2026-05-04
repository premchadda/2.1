/**
 * Basic Monitoring Middleware
 * Provides request logging, metrics collection, and health tracking
 */

// In-memory metrics storage
// NOTE (MED-02): These metrics reset on each cold start in serverless environments (e.g., Vercel).
// For persistent metrics, migrate to Redis (ioredis is already a dependency).
const metrics = {
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

/**
 * Request monitoring middleware
 */
export const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now()
  
  // Track active connections
  metrics.activeConnections++
  
  // Track request
  metrics.requests.total++
  
  // Track by method
  const method = req.method
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1
  
  // Track by path (simplified - remove query params)
  const path = req.path.replace(/\/[a-f0-9-]+/gi, '/:id')
  metrics.requests.byPath[path] = (metrics.requests.byPath[path] || 0) + 1
  
  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime
    
    // Track response time
    metrics.responseTimes.push(duration)
    // Keep only last 1000 response times
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift()
    }
    
    // Track by status code
    const status = res.statusCode
    metrics.requests.byStatus[status] = (metrics.requests.byStatus[status] || 0) + 1
    
    // Track errors
    if (status >= 400) {
      metrics.requests.errors++
    }
    
    // Decrease active connections
    metrics.activeConnections--
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`[SLOW REQUEST] ${method} ${req.path} - ${duration}ms - ${status}`)
    }
  })
  
  next()
}

/**
 * Get current metrics
 */
export const getMetrics = () => {
  const responseTimes = metrics.responseTimes
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0
  
  const p95 = responseTimes.length > 0
    ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
    : 0
  
  return {
    uptime: Date.now() - metrics.startTime,
    requests: {
      ...metrics.requests,
      rps: metrics.requests.total / ((Date.now() - metrics.startTime) / 1000)
    },
    performance: {
      avgResponseTime: Math.round(avgResponseTime),
      p95ResponseTime: Math.round(p95),
      samples: responseTimes.length
    },
    connections: {
      active: metrics.activeConnections
    },
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  }
}

/**
 * Metrics endpoint handler
 */
export const metricsHandler = (req, res) => {
  res.json(getMetrics())
}

/**
 * Error tracking middleware
 */
export const errorTrackingMiddleware = (err, req, res, next) => {
  // Log error
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  })
  
  // Track error metrics
  metrics.requests.errors++
  
  next(err)
}

export default {
  monitoringMiddleware,
  getMetrics,
  metricsHandler,
  errorTrackingMiddleware
}