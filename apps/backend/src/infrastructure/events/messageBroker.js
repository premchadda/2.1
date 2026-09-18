import Redis from "ioredis";
import { getRedisClient, isRedisReady } from "../cache/redisClient.js";
import { addJob, isQueueEnabled, QUEUE_NAMES } from "../queue/queueManager.js";
import logger from "../logger/logger.js";

class MessageBroker {
  constructor() {
    this.subscribers = new Map();
    this.subscriberClient = null;
    this.publisherClient = null;
    this.channel = "trstprep:events";
    this.initialized = false;
    // Unique per process (INSTANCE_ID is shared by a scaled service replica set
    // only when explicitly configured — default includes pid+random suffix so
    // self-published messages can be recognized on loopback).
    this.instanceId =
      process.env.INSTANCE_ID ||
      `backend-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Initialize Redis subscriber and publisher clients
   */
  async init() {
    if (this.initialized) return;

    if (!isRedisReady()) {
      logger.warn(
        "[MessageBroker] Redis not ready. Running in local in-memory mode.",
      );
      return;
    }

    try {
      this.publisherClient = getRedisClient();

      // Clone connection options from publisher client
      const options = this.publisherClient.options;
      this.subscriberClient = new Redis(options);
      this.subscriberClient.on("error", (err) => {
        logger.warn(
          "[MessageBroker] Redis subscriber client error:",
          err.message,
        );
      });

      await this.subscriberClient.subscribe(this.channel);

      this.subscriberClient.on("message", (channel, message) => {
        if (channel === this.channel) {
          this.handleInboundMessage(message);
        }
      });

      this.initialized = true;
      logger.info(
        `[MessageBroker] Decoupled pub/sub initialized on channel "${this.channel}"`,
      );
    } catch (err) {
      logger.error(
        "[MessageBroker] Initialization failed, falling back to local mode:",
        err.message,
      );
    }
  }

  /**
   * Register subscriber for an event
   *
   * @param {string} eventName
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, handler) {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }
    this.subscribers.get(eventName).push(handler);

    // Return cleanup/unsubscribe function
    return () => {
      const list = this.subscribers.get(eventName) || [];
      const index = list.indexOf(handler);
      if (index > -1) {
        list.splice(index, 1);
      }
    };
  }

  /**
   * Remove a subscriber.
   *
   * @param {string} eventName
   * @param {Function} [handler] - specific handler to remove; when omitted,
   *   all handlers for the event are removed.
   * @returns {boolean} true when something was removed
   */
  unsubscribe(eventName, handler) {
    if (!eventName) return false;
    if (handler) {
      const list = this.subscribers.get(eventName) || [];
      const index = list.indexOf(handler);
      if (index > -1) {
        list.splice(index, 1);
      }
      return index > -1;
    }
    return this.subscribers.delete(eventName);
  }

  /**
   * Remove all subscribers for all events.
   */
  unsubscribeAll() {
    this.subscribers.clear();
  }

  /**
   * Publish an event to all subscribers (cross-process)
   *
   * @param {string} eventName
   * @param {Object} payload
   */
  async publish(eventName, payload = {}) {
    const envelope = {
      name: eventName,
      payload,
      publishedAt: new Date().toISOString(),
      publisherId: this.instanceId,
    };

    // Trigger local listeners first
    await this.triggerLocalSubscribers(eventName, payload);

    // Publish to Redis for cross-instance delivery if initialized
    if (this.initialized && this.publisherClient) {
      try {
        await this.publisherClient.publish(
          this.channel,
          JSON.stringify(envelope),
        );
      } catch (err) {
        logger.error(
          `[MessageBroker] Failed to publish event "${eventName}" to Redis:`,
          err.message,
        );
      }
    }
  }

  /**
   * Enqueue event as a persistent BullMQ job for durable, retryable background processing
   *
   * @param {string} eventName
   * @param {Object} payload
   */
  async enqueue(eventName, payload = {}, opts = {}) {
    if (!isQueueEnabled()) {
      // Fallback to pub/sub immediately if queue is disabled
      return this.publish(eventName, payload);
    }

    const envelope = {
      name: eventName,
      payload,
      enqueuedAt: new Date().toISOString(),
    };

    try {
      // Idempotent jobId with random suffix (mirrors eventBus) so concurrent
      // enqueues of the same event never collide; caller may pass a stable
      // opts.jobId for replay/dedup.
      const jobId = opts?.jobId
        ? String(opts.jobId)
        : `event-${eventName}-${payload.userId || "system"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await addJob(QUEUE_NAMES.EVENTS || "events", eventName, envelope, {
        // BullMQ custom job IDs cannot contain ":" - use "-" separators
        jobId,
      });
    } catch (err) {
      logger.error(
        `[MessageBroker] Queue failure for event "${eventName}", falling back to publish:`,
        err.message,
      );
      await this.publish(eventName, payload);
    }
  }

  /**
   * Publish an event to OTHER instances only (no local trigger).
   *
   * Used for the WebSocket fan-out bridge: the publishing instance already
   * delivered locally via the in-process eventBus, so a local trigger here
   * would double-deliver. Siblings receive via handleInboundMessage (which
   * skips our own loopback via publisherId) and re-emit on their local bus.
   *
   * @param {string} eventName
   * @param {Object} payload
   * @returns {Promise<boolean>} true when handed to Redis
   */
  async publishRemote(eventName, payload = {}) {
    if (!this.initialized || !this.publisherClient) return false;
    try {
      await this.publisherClient.publish(
        this.channel,
        JSON.stringify({
          name: eventName,
          payload,
          publishedAt: new Date().toISOString(),
          publisherId: this.instanceId,
        }),
      );
      return true;
    } catch (err) {
      logger.error(
        `[MessageBroker] Failed to publish remote event "${eventName}":`,
        err.message,
      );
      return false;
    }
  }

  /**
   * Process incoming pub/sub event message
   */
  handleInboundMessage(messageStr) {
    try {
      const envelope = JSON.parse(messageStr);
      if (!envelope || !envelope.name) return;

      // Skip our own publications looping back from Redis — publish() already
      // triggered local subscribers synchronously. Without this guard the
      // publishing instance handles every event twice (duplicate emails etc.).
      if (envelope.publisherId && envelope.publisherId === this.instanceId) {
        return;
      }

      this.triggerLocalSubscribers(envelope.name, envelope.payload, true);
    } catch (err) {
      logger.error(
        "[MessageBroker] Failed to parse inbound event message:",
        err.message,
      );
    }
  }

  /**
   * Trigger local registered subscribers
   */
  async triggerLocalSubscribers(eventName, payload, isExternalSource = false) {
    const handlers = this.subscribers.get(eventName) || [];
    if (handlers.length === 0) return;

    const promises = handlers.map(async (handler) => {
      try {
        await handler(payload, { isExternalSource });
      } catch (err) {
        logger.error(
          `[MessageBroker] Error in subscriber for event "${eventName}":`,
          err,
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * Reset / cleanup resources for testing
   */
  async close() {
    this.subscribers.clear();
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      this.subscriberClient = null;
    }
    this.publisherClient = null;
    this.initialized = false;
  }
}

export const messageBroker = new MessageBroker();
export default messageBroker;
