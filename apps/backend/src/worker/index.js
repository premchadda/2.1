import dotenv from 'dotenv'
import { closeRedis, getRedisStatus, initRedis, isRedisReady } from '../infrastructure/cache/redisClient.js'
import { closeQueueResources, startWorkers } from '../infrastructure/queue/queueManager.js'
import { handlersByQueue } from './jobHandlers.js'

dotenv.config()

const queueConcurrency = {
  analytics: Number.parseInt(process.env.WORKER_ANALYTICS_CONCURRENCY || '4', 10),
  leaderboard: Number.parseInt(process.env.WORKER_LEADERBOARD_CONCURRENCY || '2', 10),
  notifications: Number.parseInt(process.env.WORKER_NOTIFICATIONS_CONCURRENCY || '5', 10),
  recommendations: Number.parseInt(process.env.WORKER_RECOMMENDATIONS_CONCURRENCY || '2', 10)
}

const start = async () => {
  try {
    await initRedis()

    if (!isRedisReady()) {
      const status = getRedisStatus()
      throw new Error(`Redis is required for worker mode. Status: ${status.message}`)
    }

    startWorkers(handlersByQueue, queueConcurrency)
    console.log('[Worker] Worker service started successfully')
  } catch (error) {
    console.error('[Worker] Startup failed:', error.message)
    process.exit(1)
  }
}

const shutdown = async (signal) => {
  console.log(`[Worker] ${signal} received. Shutting down...`)
  try {
    await closeQueueResources()
    await closeRedis()
    console.log('[Worker] Shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('[Worker] Shutdown error:', error.message)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start()

