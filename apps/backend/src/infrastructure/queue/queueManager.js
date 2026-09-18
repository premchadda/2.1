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

  const baseConnection = getRedisClient();
  const queueNames = Object.values(QUEUE_NAMES);

  for (const queueName of queueNames) {
    // BullMQ requires separate connections per Queue/Worker (docs: "Don't share connections")
    const connection = baseConnection.duplicate();
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
    // Fallback: persist to outbox_events so the job is not silently dropped
    // when Redis is down; the outbox poller replays it via the event bus.
    // Replay shape: event_type is the DOMAIN event name only (never
    // "queue.job"), payload is the event payload. The envelope passed from
    // emitDomainEvent is { name, payload, emittedAt } — unwrap it so the
    // poller can call emitDomainEvent(event_type, payload) directly.
    try {
      const { pool } = await import("../database/postgres-helpers.js");
      const isEnvelope =
        payload &&
        typeof payload === "object" &&
        typeof payload.name === "string" &&
        "payload" in payload;
      const eventType = isEnvelope ? payload.name : `${queueName}.${jobName}`;
      const eventPayload = isEnvelope ? payload.payload : payload;
      await pool.query(
        `INSERT INTO outbox_events (event_type, payload, status, retry_count)
         VALUES ($1, $2::jsonb, 'pending', 0)`,
        [eventType, JSON.stringify(eventPayload ?? {})],
      );
      logger.warn(
        `[Queue] Redis down — job "${jobName}" spooled to outbox_events for replay`,
      );
    } catch (err) {
      logger.error("[Queue] Outbox fallback failed:", err.message);
    }
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
        const jobCountsPromise = queue
          .getJobCounts("waiting", "active", "completed", "failed", "delayed")
          .catch(() => null);
        const counts = await Promise.race([
          jobCountsPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Queue status timeout")), 500),
          ),
        ]);
        return [name, counts];
      } catch {
        // Unknown during brown-out — null, not zeros (zeros would lie).
        return [name, null];
      }
    });

    const results = await Promise.all(queuePromises);
    const degraded = results.some(([, counts]) => counts === null);
    return {
      enabled: true,
      // degraded:true when any queue timed out — counts stay null (unknown),
      // never zeros, so health dashboards can't mistake a brown-out for idle.
      degraded,
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

  const baseConnection = getRedisClient();
  const queueNames = Object.values(QUEUE_NAMES);

  for (const queueName of queueNames) {
    const handler = handlersByQueue[queueName];
    if (typeof handler !== "function") {
      continue;
    }

    if (workerMap.has(queueName)) {
      continue;
    }

    // BullMQ requires separate connections per Worker
    const connection = baseConnection.duplicate();
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
        // BullMQ requires separate connections per Queue — never reuse the worker connection
        const dlqConnection = connection.duplicate
          ? connection.duplicate()
          : getRedisClient().duplicate();
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

          // Canonical DLQ only: all exhausted jobs route to the single
          // "dead-letter" queue (QUEUE_NAMES.DEAD_LETTER). No per-queue
          // "<queue>:dead-letter" throwaway queues — they fragment ops and
          // the retry tooling only watches the canonical queue.
          const dlq = new Queue(QUEUE_NAMES.DEAD_LETTER, { connection: dlqConnection });
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
  // Bounded closes: an unresponsive broker must delay shutdown, never hang it.
  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((resolve) =>
        setTimeout(() => {
          logger.warn(`[Queue] close timed out after ${ms}ms: ${label}`);
          resolve(false);
        }, ms),
      ),
    ]);
  for (const [name, worker] of workerMap.entries()) {
    await withTimeout(worker.close(), 5000, `worker:${name}`);
  }
  workerMap.clear();

  for (const [name, queue] of queueMap.entries()) {
    await withTimeout(queue.close(), 5000, `queue:${name}`);
  }
  queueMap.clear();

  queueEnabled = false;
};

export const getDeadLetterJobs = async (queueName) => {
  if (!isRedisReady()) return [];
  const connection = getRedisClient().duplicate();
  // Canonical DLQ: filter by originalQueue == queueName when a specific
  // queue's dead letters are requested.
  const dlq = new Queue(QUEUE_NAMES.DEAD_LETTER, { connection });
  try {
    const jobs = await dlq.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
    ]);
    const filtered = queueName
      ? jobs.filter((job) => (job.data?.originalQueue || job.data?.queue) === queueName)
      : jobs;
    return filtered.map((job) => ({
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
  const connection = getRedisClient().duplicate();
  const dlq = new Queue(QUEUE_NAMES.DEAD_LETTER, { connection });
  try {
    const job = await dlq.getJob(jobId);
    if (!job) return false;
    // Canonical DLQ stores originalQueue in job data; fall back to it when
    // the caller retries without specifying the target queue.
    const targetName = queueName || job.data?.originalQueue;
    const targetQueue = queueMap.get(targetName);
    if (!targetQueue) return false;
    // Preserve the original job's retry/backoff/delay options (repeat is
    // intentionally dropped — re-adding a repeatable schedule would fork it).
    const { repeat: _droppedRepeat, ...restOpts } = job.opts || {};
    // Unwrap the canonical DLQ envelope: the stored job is a wrapper
    // ({ originalQueue, jobName, data, ... }) — re-add the INNER payload
    // under its ORIGINAL job name so the target worker dispatches correctly.
    const originalName = job.data?.jobName || job.name;
    const originalData =
      job.data && "data" in job.data ? job.data.data : job.data;
    await targetQueue.add(originalName, originalData, {
      attempts: restOpts.attempts ?? DEFAULT_JOB_OPTIONS.attempts,
      backoff: restOpts.backoff ?? DEFAULT_JOB_OPTIONS.backoff,
      ...(restOpts.delay !== undefined ? { delay: restOpts.delay } : {}),
    });
    await job.remove();
    return true;
  } finally {
    await dlq.close();
  }
};
