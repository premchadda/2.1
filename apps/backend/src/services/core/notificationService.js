import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import emailService from "../EmailService.js";
import { idsMatch } from "./common.js";
import { isNotificationEnabled, getFullSettings } from "../SettingsService.js";

export const createInAppNotification = async (
  userId,
  { title, message, type = "info", metadata = {}, actionUrl = null } = {},
) => {
  if (!userId || !title || !message) return null;

  const linkUrl = actionUrl || metadata?.link || metadata?.actionUrl || null;

  return dbHelpers.insertOne("notifications", {
    userId,
    title,
    message,
    type,
    channel: "in_app",
    isRead: false,
    // notifications.action_url is the canonical database column. The
    // postgres helper converts this camelCase field to action_url.
    actionUrl: linkUrl,
    metadata: {
      ...metadata,
      link: linkUrl || metadata?.link || null,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const sendEmailNotification = async (
  user,
  { title, message, actionUrl = null } = {},
) => {
  if (!user?.email || !title || !message) {
    return { success: false, reason: "missing_recipient_or_content" };
  }

  return emailService.sendNotificationEmail(
    user.email,
    title,
    message,
    actionUrl,
  );
};

export const sendPushNotification = async (
  user,
  { title, message, metadata = {} } = {},
) => {
  // Push service integration point. Persist as in-app fallback while push infra is connected.
  if (!user?.id && !user?._id) {
    return { success: false, reason: "missing_user" };
  }

  return {
    success: true,
    channel: "push",
    payload: {
      userId: user.id || user._id,
      title,
      message,
      metadata,
    },
  };
};

async function shouldDeliverNow(userId, frequency) {
  if (!frequency || frequency === "instant") return true;
  const intervalDays =
    frequency === "daily"
      ? 1
      : frequency === "weekly"
        ? 7
        : frequency === "monthly"
          ? 30
          : 1;
  try {
    const { rows } = await dbHelpers.pool.query(
      `SELECT created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (!rows[0]?.created_at) return true;
    const last = new Date(rows[0].created_at).getTime();
    return Date.now() - last >= intervalDays * 86400000;
  } catch {
    return true;
  }
}

export const dispatchNotification = async (
  userId,
  {
    title,
    message,
    type = "info",
    actionUrl = null,
    sendEmail = true,
    sendPush = true,
    metadata = {},
    preloadedUser = null,
  } = {},
) => {
  const user = preloadedUser || (await dbHelpers.findById("users", userId));
  if (!user) return { success: false, reason: "user_not_found" };

  // Respect admin notification toggles — previously these settings were persisted
  // but never read, so toggling them had no effect. Also respect
  // notifications.notificationFrequency (instant/daily/weekly/monthly).
  let effectiveSendEmail = sendEmail;
  let effectiveSendPush = sendPush;
  let notificationFrequency = "instant";
  try {
    notificationFrequency =
      (await getFullSettings()).notifications?.notificationFrequency ||
      "instant";
  } catch {
    // intentionally empty - use default instant frequency if settings lookup fails
  }
  try {
    if (sendEmail) {
      // Map notification types to the corresponding admin toggle
      if (
        type === "subscription" ||
        type === "purchase" ||
        type === "payment"
      ) {
        if (!(await isNotificationEnabled("emailOnPayment")))
          effectiveSendEmail = false;
      } else if (type === "registration" || type === "verification") {
        if (!(await isNotificationEnabled("emailOnRegistration")))
          effectiveSendEmail = false;
      } else {
        // Generic email: require at least one email toggle to be on
        const emailOnReg = await isNotificationEnabled("emailOnRegistration");
        const emailOnPay = await isNotificationEnabled("emailOnPayment");
        if (!emailOnReg && !emailOnPay) effectiveSendEmail = false;
      }
      // smsOnOrder gates order-related notifications; fall back to push toggle for others
      if (type === "order" && !(await isNotificationEnabled("smsOnOrder"))) {
        // smsOnOrder disabled does not block email, but keep as signal
      }
    }
    if (sendPush && !(await isNotificationEnabled("pushNotifications"))) {
      effectiveSendPush = false;
    }
    // Frequency gate: non-critical types (reminder/result/info) are batched
    // according to the admin frequency. Critical subscription/payment still
    // deliver instantly regardless of frequency.
    const isCritical = [
      "subscription",
      "payment",
      "purchase",
      "security",
      "verification",
      "registration",
    ].includes(type);
    if (
      !isCritical &&
      notificationFrequency !== "instant" &&
      (effectiveSendEmail || effectiveSendPush)
    ) {
      const deliverNow = await shouldDeliverNow(userId, notificationFrequency);
      if (!deliverNow) {
        effectiveSendEmail = false;
        effectiveSendPush = false;
      }
    }
  } catch {
    // If settings lookup fails, fail open for notifications to avoid dropping critical alerts
  }

  const inApp = await createInAppNotification(userId, {
    title,
    message,
    type,
    metadata,
    actionUrl,
  });
  let email = { success: false, skipped: true, reason: "disabled_by_settings" };
  if (effectiveSendEmail) {
    try {
      email = await sendEmailNotification(user, { title, message, actionUrl });
    } catch (e) {
      email = { success: false, reason: e.message };
    }
  }
  let push = { success: false, skipped: true, reason: "disabled_by_settings" };
  if (effectiveSendPush) {
    try {
      push = await sendPushNotification(user, { title, message, metadata });
    } catch (e) {
      push = { success: false, reason: e.message };
    }
  }

  return {
    inApp,
    email,
    push,
  };
};

export const handleNotificationJob = async (jobName, payload = {}) => {
  if (jobName === "notifications.test-result-ready") {
    const seriesSlug =
      payload.seriesSlug || payload.series_slug || "ssc-cgl-2026";
    const testId = payload.testId || payload.test_id;
    const attemptId = payload.attemptId || payload.attempt_id;
    const resultLink = testId
      ? `/${seriesSlug}/tests/${testId}/result${attemptId ? `?attemptId=${attemptId}` : ""}`
      : null;

    return dispatchNotification(payload.userId, {
      title: "Test result available",
      message: payload.testTitle
        ? `Your result for ${payload.testTitle} is now available.`
        : `Your result for test #${payload.testId} is now available.`,
      type: "result_declared",
      actionUrl: resultLink,
      metadata: {
        ...payload,
        link: resultLink,
        seriesSlug,
        testId,
        attemptId,
      },
    });
  }

  if (jobName === "notifications.subscription-purchased") {
    return dispatchNotification(payload.userId, {
      title: "Subscription activated",
      message:
        "Your Pro subscription is active now. Premium features unlocked.",
      type: "subscription",
      metadata: payload,
    });
  }

  if (jobName === "notifications.daily-reminder") {
    return dispatchNotification(payload.userId, {
      title: "Daily practice reminder",
      message:
        "Keep your streak alive. Attempt today’s quiz and revision tasks.",
      type: "reminder",
      metadata: payload,
    });
  }

  return { skipped: true, reason: "unknown_job_name" };
};

export const sendScheduledReminders = async ({ inactivityHours = 24 } = {}) => {
  // Single query: find all active users whose last attempt activity is before the
  // inactivity cutoff (or who have never attempted anything). No full-table scan.
  const { rows: staleUsers } = await dbHelpers.pool.query(
    `SELECT u.id, u.email, u.name, u.notification_preferences, u.is_active
     FROM users u
     LEFT JOIN (
       SELECT user_id,
              MAX(GREATEST(
                COALESCE(updated_at, '1970-01-01'),
                COALESCE(submitted_at, '1970-01-01'),
                COALESCE(created_at,  '1970-01-01')
              )) AS last_activity
       FROM test_attempts
       GROUP BY user_id
     ) a ON a.user_id = u.id
     WHERE u.is_active = true
       AND (a.last_activity IS NULL
            OR a.last_activity <= NOW() - ($1 * INTERVAL '1 hour'))`,
    [inactivityHours],
  );

  if (staleUsers.length === 0) {
    return { remindersSent: 0 };
  }

  let reminders = 0;
  for (const row of staleUsers) {
    const user = dbHelpers.toCamel ? dbHelpers.toCamel(row) : row;
    const userId = user.id || user._id;
    if (!userId) continue;

    await dispatchNotification(userId, {
      title: "Practice reminder",
      message:
        "You have pending revision and quizzes. Resume today to stay on track.",
      type: "reminder",
      sendPush: true,
      sendEmail: true,
      metadata: { reason: "scheduled_inactivity_reminder" },
      preloadedUser: user,
    });
    reminders += 1;
  }

  return { remindersSent: reminders };
};

export const notificationService = {
  createInAppNotification,
  sendEmailNotification,
  sendPushNotification,
  dispatchNotification,
  handleNotificationJob,
  sendScheduledReminders,
};

export default notificationService;
