import { Queue, Worker } from "bullmq";
import {
  getRedisClient,
  getRedisStatus,
  isRedisReady,
} from "../cache/redisClient.js";
import logger from "../logger/logger.js";

export const QUEUE_NAMES = Object.freeze({
  ANALYTICS: "analytics",
  LEADERBOARD: "leaderboard",
  NOTIFICATIONS: "notifications",
  RECOMMENDATIONS: "recommendations",
  DEAD_LETTER: "dead-letter",
  EVENTS: "events",
});

const DEFAULT_JOB_OPTIONS = Object.freeze({
  attempts: parseInt(process.env.QUEUE_JOB_ATTEMPTS || "3", 10),
  backoff: {
    type: "exponential",
    delay: parseInt(process.env.QUEUE_JOB_BACKOFF_DELAY || "5000", 10),
  },
  removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE || "200", 10),
  removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || "500", 10),
});

const queueMap = new Map();
const workerMap = new Map();
let queueEnabled = false;

export const initQueues = () => {
  if (queueMap.size > 0) {
    return queueEnabled;
  }

  if (!isRedisReady()) {
    queueEnabled = false;
    if (getRedisStatus().enabled) {
      logger.warn("[Queue] Redis unavailable. Background queues are disabled.");
    }
    return false;
  }

  const connection = getRedisClient();
  const queueNames = Object.values(QUEUE_NAMES);

  for (const queueName of queueNames) {
    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    queueMap.set(queueName, queue);
  }

  queueEnabled = true;
  logger.info(`[Queue] Initialized ${queueNames.length} queues`);
  return true;
};

export const isQueueEnabled = () => queueEnabled;

export const getQueue = (queueName) => queueMap.get(queueName);

export const addJob = async (
  queueName,
  jobName,
  payload = {},
  options = {},
) => {
  if (!queueEnabled) {
    return null;
  }

  const queue = queueMap.get(queueName);
  if (!queue) {
    throw new Error(`Queue "${queueName}" is not initialized`);
  }

  return queue.add(jobName, payload, options);
};

export const getQueueStatus = async () => {
  if (!queueEnabled) {
    return {
      enabled: false,
      queues: {},
    };
  }

  try {
    const queueEntries = Array.from(queueMap.entries());
    const queuePromises = queueEntries.map(async ([name, queue]) => {
      try {
        const counts = await Promise.race([
          queue.getJobCounts(
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Queue status timeout")), 500),
          ),
        ]);
        return [name, counts];
      } catch {
        return [
          name,
          { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
        ];
      }
    });

    const results = await Promise.all(queuePromises);
    return {
      enabled: true,
      queues: Object.fromEntries(results),
    };
  } catch {
    return {
      enabled: true,
      queues: {},
    };
  }
};

export const startWorkers = (handlersByQueue = {}, concurrencyByQueue = {}) => {
  if (!isRedisReady()) {
    throw new Error("Cannot start workers because Redis is not ready");
  }

  const connection = getRedisClient();
  const queueNames = Object.values(QUEUE_NAMES);

  for (const queueName of queueNames) {
    const handler = handlersByQueue[queueName];
    if (typeof handler !== "function") {
      continue;
    }

    if (workerMap.has(queueName)) {
      continue;
    }

    const worker = new Worker(queueName, async (job) => handler(job), {
      connection,
      concurrency: concurrencyByQueue[queueName] || 5,
    });

    worker.on("completed", (job) => {
      logger.info(
        `[Worker][${queueName}] Completed job ${job.id} (${job.name})`,
      );
    });

    worker.on("failed", async (job, error) => {
      const jobId = job?.id || "unknown";
      const attemptsMade = job?.attemptsMade || 0;
      const maxAttempts = job?.opts?.attempts || DEFAULT_JOB_OPTIONS.attempts;

      logger.error(
        `[Worker][${queueName}] Job ${jobId} failed:`,
        error.message,
      );

      if (attemptsMade >= maxAttempts) {
        logger.warn(
          `[Worker][${queueName}] Job ${jobId} exhausted ${maxAttempts} attempts — moving to dead letter queue`,
        );
        try {
          // Log to PostgreSQL dead_letter_jobs table
          const { pool } = await import("../database/postgres-helpers.js");
          await pool.query(
            `INSERT INTO dead_letter_jobs (queue_name, job_id, job_name, payload, error_message, error_stack)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              queueName,
              String(jobId),
              job?.name || "unknown",
              JSON.stringify(job?.data || {}),
              error.message,
              error.stack,
            ],
          );

          // Existing fallback/Redis DLQ queue mechanism
          const dlq = new Queue(`${queueName}:dead-letter`, { connection });
          await dlq.add("failed-job", {
            originalQueue: queueName,
            jobId,
            jobName: job.name,
            data: job.data,
            failedReason: error.message,
            attemptsMade,
            failedAt: new Date().toISOString(),
          });
          await dlq.close();
        } catch (dlqError) {
          logger.error(
            `[Worker][${queueName}] Failed to write to DLQ:`,
            dlqError.message,
          );
        }
      }
    });

    workerMap.set(queueName, worker);
  }

  return workerMap;
};

export const closeQueueResources = async () => {
  for (const worker of workerMap.values()) {
    await worker.close();
  }
  workerMap.clear();

  for (const queue of queueMap.values()) {
    await queue.close();
  }
  queueMap.clear();

  queueEnabled = false;
};

export const getDeadLetterJobs = async (queueName) => {
  if (!isRedisReady()) return [];
  const connection = getRedisClient();
  const dlq = new Queue(`${queueName}:dead-letter`, { connection });
  try {
    const jobs = await dlq.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
    ]);
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      failedReason: job.failedReason,
    }));
  } finally {
    await dlq.close();
  }
};

export const retryDeadLetterJob = async (queueName, jobId) => {
  if (!isRedisReady()) return false;
  const connection = getRedisClient();
  const dlq = new Queue(`${queueName}:dead-letter`, { connection });
  try {
    const job = await dlq.getJob(jobId);
    if (!job) return false;
    const targetQueue = queueMap.get(queueName);
    if (!targetQueue) return false;
    await targetQueue.add(job.name, job.data, {
      attempts: DEFAULT_JOB_OPTIONS.attempts,
    });
    await job.remove();
    return true;
  } finally {
    await dlq.close();
  }
};
