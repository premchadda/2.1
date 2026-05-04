import { QUEUE_NAMES } from '../infrastructure/queue/queueManager.js'
import {
  analyticsService,
  leaderboardService,
  notificationService,
  recommendationService,
} from '../services/core/index.js'

const logJobStart = (queueName, job) => {
  console.log(
    `[Worker][${queueName}] Processing job ${job.id} (${job.name}) with payload keys: ${Object.keys(job.data?.payload || {}).join(', ')}`
  )
}

const defaultResult = (extra = {}) => ({
  processedAt: new Date().toISOString(),
  ...extra
})

export const handlersByQueue = {
  [QUEUE_NAMES.ANALYTICS]: async (job) => {
    logJobStart(QUEUE_NAMES.ANALYTICS, job)
    const payload = job.data?.payload || {}
    if (job.name === 'analytics.test-submitted') {
      const processed = await analyticsService.processTestSubmissionAnalytics({
        userId: payload.userId,
        testId: payload.testId,
        attemptId: payload.attemptId,
      })
      return defaultResult({ action: 'analytics-test-submitted', ...processed })
    }

    if (job.name === 'analytics.question-answered') {
      return defaultResult({ action: 'analytics-question-answered' })
    }

    if (job.name === 'analytics.test-started') {
      return defaultResult({ action: 'analytics-test-started' })
    }

    return defaultResult({ action: 'analytics-noop' })
  },
  [QUEUE_NAMES.LEADERBOARD]: async (job) => {
    logJobStart(QUEUE_NAMES.LEADERBOARD, job)
    const payload = job.data?.payload || {}
    const recalculated = await leaderboardService.recalculateLeaderboards({
      testId: payload.testId || null,
    })
    return defaultResult({ action: 'leaderboard-updated', recalculated })
  },
  [QUEUE_NAMES.NOTIFICATIONS]: async (job) => {
    logJobStart(QUEUE_NAMES.NOTIFICATIONS, job)
    if (job.name === 'notifications.scheduled-reminders') {
      const result = await notificationService.sendScheduledReminders({
        inactivityHours: Number(job.data?.payload?.inactivityHours || 24),
      })
      return defaultResult({ action: 'notifications-scheduled-reminders', ...result })
    }

    const payload = job.data?.payload || {}
    const dispatched = await notificationService.handleNotificationJob(job.name, payload)
    return defaultResult({ action: 'notification-dispatched', dispatched })
  },
  [QUEUE_NAMES.RECOMMENDATIONS]: async (job) => {
    logJobStart(QUEUE_NAMES.RECOMMENDATIONS, job)
    const payload = job.data?.payload || {}
    const refreshed = await recommendationService.refreshRecommendationsFromEvent({
      userId: payload.userId || null,
      testId: payload.testId || null,
    })
    return defaultResult({ action: 'recommendations-refreshed', ...refreshed })
  }
}
