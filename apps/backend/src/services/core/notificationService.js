import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import emailService from '../EmailService.js'
import { idsMatch } from './common.js'

export const createInAppNotification = async (
  userId,
  { title, message, type = 'info', metadata = {} } = {}
) => {
  if (!userId || !title || !message) return null

  return dbHelpers.insertOne('notifications', {
    userId,
    title,
    message,
    type,
    channel: 'in_app',
    read: false,
    metadata,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

export const sendEmailNotification = async (
  user,
  { title, message, actionUrl = null } = {}
) => {
  if (!user?.email || !title || !message) {
    return { success: false, reason: 'missing_recipient_or_content' }
  }

  return emailService.sendNotificationEmail(user.email, title, message, actionUrl)
}

export const sendPushNotification = async (
  user,
  { title, message, metadata = {} } = {}
) => {
  // Push service integration point. Persist as in-app fallback while push infra is connected.
  if (!user?.id && !user?._id) {
    return { success: false, reason: 'missing_user' }
  }

  return {
    success: true,
    channel: 'push',
    payload: {
      userId: user.id || user._id,
      title,
      message,
      metadata,
    },
  }
}

export const dispatchNotification = async (
  userId,
  {
    title,
    message,
    type = 'info',
    actionUrl = null,
    sendEmail = true,
    sendPush = true,
    metadata = {},
  } = {}
) => {
  const users = await dbHelpers.find('users', {})
  const user = users.find((entry) => idsMatch(entry.id || entry._id, userId))

  const inApp = await createInAppNotification(userId, { title, message, type, metadata })
  const email = sendEmail ? await sendEmailNotification(user, { title, message, actionUrl }) : { success: false, skipped: true }
  const push = sendPush ? await sendPushNotification(user, { title, message, metadata }) : { success: false, skipped: true }

  return {
    inApp,
    email,
    push,
  }
}

export const handleNotificationJob = async (jobName, payload = {}) => {
  if (jobName === 'notifications.test-result-ready') {
    return dispatchNotification(payload.userId, {
      title: 'Test result available',
      message: `Your result for test #${payload.testId} is ready. Score: ${payload.score ?? 'N/A'}.`,
      type: 'test_result',
      metadata: payload,
    })
  }

  if (jobName === 'notifications.subscription-purchased') {
    return dispatchNotification(payload.userId, {
      title: 'Subscription activated',
      message: 'Your Pro subscription is active now. Premium features unlocked.',
      type: 'subscription',
      metadata: payload,
    })
  }

  if (jobName === 'notifications.daily-reminder') {
    return dispatchNotification(payload.userId, {
      title: 'Daily practice reminder',
      message: 'Keep your streak alive. Attempt today’s quiz and revision tasks.',
      type: 'reminder',
      metadata: payload,
    })
  }

  return { skipped: true, reason: 'unknown_job_name' }
}

export const sendScheduledReminders = async ({ inactivityHours = 24 } = {}) => {
  const attempts = await dbHelpers.find('attempts', {})
  const users = await dbHelpers.find('users', {})
  const cutoff = Date.now() - inactivityHours * 60 * 60 * 1000

  const lastActivityByUser = new Map()
  attempts.forEach((attempt) => {
    const userId = attempt.userId || attempt.user_id
    if (!userId) return
    const activityTs = new Date(attempt.updatedAt || attempt.submittedAt || attempt.createdAt || 0).getTime()
    const existing = lastActivityByUser.get(String(userId)) || 0
    if (activityTs > existing) {
      lastActivityByUser.set(String(userId), activityTs)
    }
  })

  let reminders = 0
  for (const user of users) {
    const userId = user.id || user._id
    if (!userId || user.isActive === false) continue

    const lastActivity = lastActivityByUser.get(String(userId)) || 0
    if (lastActivity > cutoff) continue

    await dispatchNotification(userId, {
      title: 'Practice reminder',
      message: 'You have pending revision and quizzes. Resume today to stay on track.',
      type: 'reminder',
      sendPush: true,
      sendEmail: true,
      metadata: { reason: 'scheduled_inactivity_reminder' },
    })
    reminders += 1
  }

  return { remindersSent: reminders }
}

export const notificationService = {
  createInAppNotification,
  sendEmailNotification,
  sendPushNotification,
  dispatchNotification,
  handleNotificationJob,
  sendScheduledReminders,
}

export default notificationService

