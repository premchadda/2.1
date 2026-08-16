import dotenv from 'dotenv'
import { closeRedis, getRedisStatus, initRedis, isRedisReady } from '../infrastructure/cache/redisClient.js'
import { closeQueueResources, startWorkers } from '../infrastructure/queue/queueManager.js'
import { handlersByQueue } from './jobHandlers.js'
import logger from '../infrastructure/logger/logger.js'

dotenv.config()

const queueConcurrency = {
  analytics: Number.parseInt(process.env.WORKER_ANALYTICS_CONCURRENCY || '4', 10),
  leaderboard: Number.parseInt(process.env.WORKER_LEADERBOARD_CONCURRENCY || '2', 10),
  notifications: Number.parseInt(process.env.WORKER_NOTIFICATIONS_CONCURRENCY || '5', 10),
  recommendations: Number.parseInt(process.env.WORKER_RECOMMENDATIONS_CONCURRENCY || '2', 10)
}

const start = async () => {
  try {
    // Initialize Redis first (required for BullMQ queues + Socket.IO adapter).
    await initRedis()
    if (!isRedisReady()) {
      const status = getRedisStatus()
      throw new Error(`Redis is required for worker mode. Status: ${status.message}`)
    }

    // Initialize the database pool — the worker process previously did NOT
    // connect to Postgres, so any job that touched the DB (analytics, leaderboard,
    // notifications, recommendations) would crash the worker.
    try {
      const { pool } = await import('../infrastructure/database/postgres-helpers.js')
      // Warm the pool with a simple query to fail fast if DB is unreachable.
      await pool.query('SELECT 1')
      logger.info('[Worker] Database connection established')
    } catch (dbErr) {
      logger.error('[Worker] Database connection failed — jobs touching the DB will fail:', dbErr.message)
      // Don't exit — some jobs (notifications via Redis only) may still work.
    }

    startWorkers(handlersByQueue, queueConcurrency)
    logger.info('[Worker] Worker service started successfully')
  } catch (error) {
    logger.error('[Worker] Startup failed:', error.message)
    process.exit(1)
  }
}

const shutdown = async (signal) => {
  logger.info(`[Worker] ${signal} received. Shutting down...`)
  try {
    await closeQueueResources()
    await closeRedis()
    logger.info('[Worker] Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error('[Worker] Shutdown error:', error.message)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Uncaught exception / unhandled rejection handlers — mirror the main app.
// Without these, an unhandled error in a job handler crashes the worker silently.
process.on('uncaughtException', (err) => {
  logger.error('[Worker] Uncaught exception:', err.message, { stack: err.stack })
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  logger.error('[Worker] Unhandled rejection:', reason)
  shutdown('unhandledRejection')
})

start()
