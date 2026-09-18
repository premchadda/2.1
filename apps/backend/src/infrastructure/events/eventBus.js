/**
 * EventBus - Domain event publisher with queue integration
 *
 * LU-02 FIX: Enhanced user targeting for WebSocket events.
 * All events now include userId extraction for targeted delivery.
 *
 * Usage:
 *   import { emitDomainEvent, eventBus } from './eventBus.js'
 *   await emitDomainEvent('test_submitted', { userId, testId, score })
 */

import { EventEmitter } from "events";
import { addJob, isQueueEnabled, QUEUE_NAMES } from "../queue/queueManager.js";
import logger from "../logger/logger.js";

const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(100);

// Domain events that must reach WebSocket clients pinned to ANY replica.
// emitDomainEvent publishes these remote-only (no local re-trigger); each
// sibling's websocketManager bridge re-emits them on its local bus.
const WS_FANOUT_EVENTS = new Set([
  "test:result_ready",
  "leaderboard:updated",
  "notification:new",
  "series:updated",
  "test_submitted",
]);

const EVENT_QUEUE_MAP = Object.freeze({
  test_started: [
    { queue: QUEUE_NAMES.ANALYTICS, jobName: "analytics.test-started" },
  ],
  test_submitted: [
    { queue: QUEUE_NAMES.ANALYTICS, jobName: "analytics.test-submitted" },
    { queue: QUEUE_NAMES.LEADERBOARD, jobName: "leaderboard.recalculate" },
    { queue: QUEUE_NAMES.RECOMMENDATIONS, jobName: "recommendations.refresh" },
    {
      queue: QUEUE_NAMES.NOTIFICATIONS,
      jobName: "notifications.test-result-ready",
    },
  ],
  question_answered: [
    { queue: QUEUE_NAMES.ANALYTICS, jobName: "analytics.question-answered" },
    {
      queue: QUEUE_NAMES.RECOMMENDATIONS,
      jobName: "recommendations.update-topic-signal",
    },
  ],
  subscription_purchased: [
    {
      queue: QUEUE_NAMES.NOTIFICATIONS,
      jobName: "notifications.subscription-purchased",
    },
    {
      queue: QUEUE_NAMES.RECOMMENDATIONS,
      jobName: "recommendations.plan-upgrade",
    },
  ],
  leaderboard_updated: [
    { queue: QUEUE_NAMES.LEADERBOARD, jobName: "leaderboard.broadcast-update" },
  ],
  notification_sent: [
    { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: "notifications.deliver" },
  ],
});

/**
 * Validate a domain event name + payload before emit/replay.
 * Poll replay path calls this so poison rows fail fast instead of
 * fanning out malformed jobs to every queue.
 */
export const validateDomainEvent = (eventName, payload = {}) => {
  if (!eventName || typeof eventName !== "string") return false;
  // Domain names are bare identifiers (no queue prefix). Queue-prefixed
  // spool rows from older shapes are rejected — caller should unwrap first.
  if (eventName.includes(".")) return false;
  if (payload === null || typeof payload !== "object") return false;
  return true;
};

/**
 * Emit a domain event with automatic queue routing
 *
 * @param {string} eventName - The event name
 * @param {Object} payload - Event payload (should include userId when applicable)
 * @param {Object} opts - Optional overrides (e.g. { jobId } for idempotent replay)
 * @returns {Promise<{queuedJobs: number, queueEnabled: boolean}>}
 */
export const emitDomainEvent = async (eventName, payload = {}, opts = {}) => {
  const envelope = {
    name: eventName,
    payload,
    emittedAt: new Date().toISOString(),
  };

  // Emit synchronously for immediate local listeners
  eventEmitter.emit(eventName, envelope);
  eventEmitter.emit("__all__", envelope);

  // Cross-instance WebSocket fan-out: sibling replicas deliver these to their
  // local sockets via the broker bridge (see websocketManager). Remote-only
  // publish — the local emit above already ran, so no double delivery.
  // Fire-and-forget: broker outage must never fail the user flow.
  if (WS_FANOUT_EVENTS.has(eventName)) {
    import("./messageBroker.js")
      .then(({ messageBroker }) =>
        messageBroker.publishRemote(eventName, payload),
      )
      .catch(() => {});
  }

  if (!isQueueEnabled()) {
    // Queue down: spool ONE outbox row per event (single-row, before the
    // per-target fan-out loop) so poller replay emits the domain event once.
    // Routing through per-target addJob here would write N duplicate rows
    // (one per queue target) for the same event.
    try {
      const { pool } = await import("../database/postgres-helpers.js");
      await pool.query(
        `INSERT INTO outbox_events (event_type, payload, status, retry_count)
         VALUES ($1, $2::jsonb, 'pending', 0)`,
        [eventName, JSON.stringify(payload ?? {})],
      );
      logger.warn(
        `[EventBus] Queue down — event "${eventName}" spooled to outbox_events for replay`,
      );
    } catch (err) {
      logger.error("[EventBus] Outbox spool failed:", err.message);
    }
    return { queuedJobs: 0, queueEnabled: false };
  }

  const queueTargets = EVENT_QUEUE_MAP[eventName] || [];
  let queuedJobs = 0;

  for (const target of queueTargets) {
    try {
      // Idempotent replay: outbox poller passes jobId=`outbox-${row.id}` so
      // BullMQ dedups redeliveries of the same outbox row.
      const jobId = opts?.jobId
        ? String(opts.jobId)
        : `${eventName}-${target.queue}-${payload.userId || "system"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await addJob(target.queue, target.jobName, envelope, {
        // BullMQ custom job IDs cannot contain ":" - use "-" separators
        jobId,
      });
      queuedJobs += 1;
    } catch (err) {
      // Queue outage must never fail the user flow — local listeners already
      // received the event above; degrade to local-emit only.
      logger.warn(
        `[EventBus] addJob failed for ${target.queue}/${target.jobName}: ${err.message}`,
      );
    }
  }

  return {
    queuedJobs,
    queueEnabled: isQueueEnabled(),
  };
};

/**
 * Emit a user-targeted event for WebSocket delivery
 *
 * LU-02 FIX: Provides explicit userId extraction for targeted WebSocket delivery.
 * WebSocket handlers should use this to route messages to specific user rooms.
 *
 * @param {string} eventName - Event name
 * @param {Object} data - Event data
 * @param {string|number} userId - Target user ID (optional, falls back to payload.userId)
 * @returns {Object} Event envelope with userId
 */
export const emitUserEvent = (eventName, data = {}, userId = null) => {
  const userIdResolved = userId || data?.userId || data?.payload?.userId;
  const envelope = {
    name: eventName,
    payload: { ...data, userId: userIdResolved },
    targetUser: userIdResolved,
    emittedAt: new Date().toISOString(),
  };

  eventEmitter.emit(eventName, envelope);
  eventEmitter.emit("user:event", envelope);

  return envelope;
};

/**
 * Emit a broadcast event (goes to all connected clients)
 *
 * @param {string} eventName - Event name
 * @param {Object} data - Event data
 */
export const emitBroadcastEvent = (eventName, data = {}) => {
  const envelope = {
    name: eventName,
    payload: data,
    isBroadcast: true,
    emittedAt: new Date().toISOString(),
  };

  eventEmitter.emit(eventName, envelope);
  eventEmitter.emit("broadcast", envelope);

  return envelope;
};

/**
 * Subscribe to domain events
 *
 * @param {string} eventName - Event to subscribe to
 * @param {Function} handler - Event handler
 * @returns {Function} Cleanup function to unsubscribe
 */
export const onDomainEvent = (eventName, handler) => {
  eventEmitter.on(eventName, handler);
  return () => eventEmitter.off(eventName, handler);
};

// Re-export raw EventEmitter for direct access
export const eventBus = eventEmitter;
export const getEventQueueMap = () => EVENT_QUEUE_MAP;
