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

import { EventEmitter } from 'events'
import { addJob, isQueueEnabled, QUEUE_NAMES } from '../queue/queueManager.js'

const eventEmitter = new EventEmitter()
eventEmitter.setMaxListeners(100)

const EVENT_QUEUE_MAP = Object.freeze({
  test_started: [
    { queue: QUEUE_NAMES.ANALYTICS, jobName: 'analytics.test-started' }
  ],
  test_submitted: [
    { queue: QUEUE_NAMES.ANALYTICS, jobName: 'analytics.test-submitted' },
    { queue: QUEUE_NAMES.LEADERBOARD, jobName: 'leaderboard.recalculate' },
    { queue: QUEUE_NAMES.RECOMMENDATIONS, jobName: 'recommendations.refresh' },
    { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'notifications.test-result-ready' }
  ],
  question_answered: [
    { queue: QUEUE_NAMES.ANALYTICS, jobName: 'analytics.question-answered' },
    { queue: QUEUE_NAMES.RECOMMENDATIONS, jobName: 'recommendations.update-topic-signal' }
  ],
  subscription_purchased: [
    { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'notifications.subscription-purchased' },
    { queue: QUEUE_NAMES.RECOMMENDATIONS, jobName: 'recommendations.plan-upgrade' }
  ],
  leaderboard_updated: [
    { queue: QUEUE_NAMES.LEADERBOARD, jobName: 'leaderboard.broadcas-update' }
  ],
  notification_sent: [
    { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'notifications.deliver' }
  ]
})

/**
 * Emit a domain event with automatic queue routing
 * 
 * @param {string} eventName - The event name
 * @param {Object} payload - Event payload (should include userId when applicable)
 * @returns {Promise<{queuedJobs: number, queueEnabled: boolean}>}
 */
export const emitDomainEvent = async (eventName, payload = {}) => {
  const envelope = {
    name: eventName,
    payload,
    emittedAt: new Date().toISOString()
  }

  // Emit synchronously for immediate local listeners
  eventEmitter.emit(eventName, envelope)
  eventEmitter.emit('__all__', envelope)

  if (!isQueueEnabled()) {
    return {
      queuedJobs: 0,
      queueEnabled: false
    }
  }

  const queueTargets = EVENT_QUEUE_MAP[eventName] || []
  let queuedJobs = 0

  for (const target of queueTargets) {
    await addJob(target.queue, target.jobName, envelope, {
      jobId: `${eventName}:${target.queue}:${payload.userId || 'system'}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    })
    queuedJobs += 1
  }

  return {
    queuedJobs,
    queueEnabled: true
  }
}

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
  const userIdResolved = userId || data?.userId || data?.payload?.userId
  const envelope = {
    name: eventName,
    payload: { ...data, userId: userIdResolved },
    targetUser: userIdResolved,
    emittedAt: new Date().toISOString()
  }

  eventEmitter.emit(eventName, envelope)
  eventEmitter.emit('user:event', envelope)

  return envelope
}

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
    emittedAt: new Date().toISOString()
  }

  eventEmitter.emit(eventName, envelope)
  eventEmitter.emit('broadcast', envelope)

  return envelope
}

/**
 * Subscribe to domain events
 * 
 * @param {string} eventName - Event to subscribe to
 * @param {Function} handler - Event handler
 * @returns {Function} Cleanup function to unsubscribe
 */
export const onDomainEvent = (eventName, handler) => {
  eventEmitter.on(eventName, handler)
  return () => eventEmitter.off(eventName, handler)
}

// Re-export raw EventEmitter for direct access
export const eventBus = eventEmitter
export const getEventQueueMap = () => EVENT_QUEUE_MAP