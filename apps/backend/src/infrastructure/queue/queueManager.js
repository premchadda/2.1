import { Queue, Worker } from 'bullmq'
import { getRedisClient, getRedisStatus, isRedisReady } from '../cache/redisClient.js'

export const QUEUE_NAMES = Object.freeze({
  ANALYTICS: 'analytics',
  LEADERBOARD: 'leaderboard',
  NOTIFICATIONS: 'notifications',
  RECOMMENDATIONS: 'recommendations'
})

const DEFAULT_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000
  },
  removeOnComplete: 200,
  removeOnFail: 500
})

const queueMap = new Map()
const workerMap = new Map()
let queueEnabled = false

export const initQueues = () => {
  if (queueMap.size > 0) {
    return queueEnabled
  }

  if (!isRedisReady()) {
    queueEnabled = false
    if (getRedisStatus().enabled) {
      console.warn('[Queue] Redis unavailable. Background queues are disabled.')
    }
    return false
  }

  const connection = getRedisClient()
  const queueNames = Object.values(QUEUE_NAMES)

  for (const queueName of queueNames) {
    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    })
    queueMap.set(queueName, queue)
  }

  queueEnabled = true
  console.log(`[Queue] Initialized ${queueNames.length} queues`)
  return true
}

export const isQueueEnabled = () => queueEnabled

export const getQueue = (queueName) => queueMap.get(queueName)

export const addJob = async (queueName, jobName, payload = {}, options = {}) => {
  if (!queueEnabled) {
    return null
  }

  const queue = queueMap.get(queueName)
  if (!queue) {
    throw new Error(`Queue "${queueName}" is not initialized`)
  }

  return queue.add(jobName, payload, options)
}

export const getQueueStatus = async () => {
  if (!queueEnabled) {
    return {
      enabled: false,
      queues: {}
    }
  }

  const queues = {}
  for (const [name, queue] of queueMap.entries()) {
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
    queues[name] = counts
  }

  return {
    enabled: true,
    queues
  }
}

export const startWorkers = (handlersByQueue = {}, concurrencyByQueue = {}) => {
  if (!isRedisReady()) {
    throw new Error('Cannot start workers because Redis is not ready')
  }

  const connection = getRedisClient()
  const queueNames = Object.values(QUEUE_NAMES)

  for (const queueName of queueNames) {
    const handler = handlersByQueue[queueName]
    if (typeof handler !== 'function') {
      continue
    }

    if (workerMap.has(queueName)) {
      continue
    }

    const worker = new Worker(
      queueName,
      async (job) => handler(job),
      {
        connection,
        concurrency: concurrencyByQueue[queueName] || 5
      }
    )

    worker.on('completed', (job) => {
      console.log(`[Worker][${queueName}] Completed job ${job.id} (${job.name})`)
    })

    worker.on('failed', (job, error) => {
      console.error(`[Worker][${queueName}] Job ${job?.id || 'unknown'} failed:`, error.message)
    })

    workerMap.set(queueName, worker)
  }

  return workerMap
}

export const closeQueueResources = async () => {
  for (const worker of workerMap.values()) {
    await worker.close()
  }
  workerMap.clear()

  for (const queue of queueMap.values()) {
    await queue.close()
  }
  queueMap.clear()

  queueEnabled = false
}
