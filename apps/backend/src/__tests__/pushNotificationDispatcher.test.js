import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockInsertOne = jest.fn();
const mockFindById = jest.fn();
const mockUpdateById = jest.fn();
const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {
      insertOne: (...args) => mockInsertOne(...args),
      findById: (...args) => mockFindById(...args),
      updateById: (...args) => mockUpdateById(...args),
      pool: { query: (...args) => mockPoolQuery(...args) },
    },
    pool: { query: (...args) => mockPoolQuery(...args) },
  }),
);

const mockSendNotificationEmail = jest.fn();
jest.unstable_mockModule("../services/EmailService.js", () => ({
  default: {
    sendNotificationEmail: (...args) => mockSendNotificationEmail(...args),
  },
}));

const mockIsNotificationEnabled = jest.fn();
const mockGetFullSettings = jest.fn();
jest.unstable_mockModule("../services/SettingsService.js", () => ({
  isNotificationEnabled: (...args) => mockIsNotificationEnabled(...args),
  getFullSettings: (...args) => mockGetFullSettings(...args),
}));

const {
  notificationService,
  isWithinQuietHours,
  registerPushToken,
  dispatchNotification,
  handleNotificationJob,
} = await import("../services/core/notificationService.js");

describe("Push Notification Dispatcher & Quiet Hours Engine", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockIsNotificationEnabled.mockResolvedValue(true);
    mockGetFullSettings.mockResolvedValue({
      notifications: { notificationFrequency: "instant" },
    });
    mockSendNotificationEmail.mockResolvedValue({
      success: true,
      messageId: "msg-test",
    });
  });

  describe("Push Token Registration", () => {
    it("rejects missing user ID or token", async () => {
      const res1 = await registerPushToken(null, { token: "token-123" });
      expect(res1.success).toBe(false);
      expect(res1.reason).toBe("missing_token_or_user");

      const res2 = await registerPushToken(101, { token: "" });
      expect(res2.success).toBe(false);
      expect(res2.reason).toBe("missing_token_or_user");
    });

    it("upserts push subscription in database table", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: "101",
            token: "fcm-device-token-xyz",
            device_type: "android",
          },
        ],
      });

      const res = await registerPushToken(101, {
        token: "fcm-device-token-xyz",
        deviceType: "android",
        p256dh: "p256-key",
        auth: "auth-secret",
      });

      expect(res.success).toBe(true);
      expect(res.subscription.token).toBe("fcm-device-token-xyz");
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO push_subscriptions"),
        [
          "101",
          "fcm-device-token-xyz",
          "android",
          "p256dh-key" ? expect.anything() : null,
          expect.anything(),
        ],
      );
    });

    it("falls back to user metadata when push_subscriptions table is missing", async () => {
      mockPoolQuery.mockRejectedValueOnce(
        new Error('relation "push_subscriptions" does not exist'),
      );
      mockFindById.mockResolvedValueOnce({
        id: 101,
        notificationPreferences: { email: true },
      });
      mockUpdateById.mockResolvedValueOnce({ id: 101 });

      const res = await registerPushToken(101, {
        token: "web-push-token-abc",
        deviceType: "web",
      });

      expect(res.success).toBe(true);
      expect(res.fallback).toBe(true);
      expect(mockUpdateById).toHaveBeenCalledWith(
        "users",
        101,
        expect.objectContaining({
          notificationPreferences: expect.objectContaining({
            pushToken: "web-push-token-abc",
            deviceType: "web",
          }),
        }),
      );
    });
  });

  describe("Quiet Hours Throttling Engine", () => {
    it("returns false if quiet hours are not enabled", () => {
      const prefs = {
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      };
      const lateNight = new Date("2026-09-05T23:30:00");
      expect(isWithinQuietHours(prefs, lateNight)).toBe(false);
    });

    it("detects when current time falls within overnight quiet hours (e.g. 22:00 to 07:00)", () => {
      const prefs = {
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      };

      // 23:45 -> in quiet hours
      const nightTime = new Date();
      nightTime.setHours(23, 45, 0, 0);
      expect(isWithinQuietHours(prefs, nightTime)).toBe(true);

      // 04:15 -> in quiet hours
      const earlyMorning = new Date();
      earlyMorning.setHours(4, 15, 0, 0);
      expect(isWithinQuietHours(prefs, earlyMorning)).toBe(true);

      // 14:00 -> NOT in quiet hours
      const afternoon = new Date();
      afternoon.setHours(14, 0, 0, 0);
      expect(isWithinQuietHours(prefs, afternoon)).toBe(false);
    });

    it("detects when current time falls within daytime quiet hours (e.g. 13:00 to 15:00)", () => {
      const prefs = {
        quietHoursEnabled: true,
        quietHoursStart: "13:00",
        quietHoursEnd: "15:00",
      };

      const inWindow = new Date();
      inWindow.setHours(14, 0, 0, 0);
      expect(isWithinQuietHours(prefs, inWindow)).toBe(true);

      const outWindow = new Date();
      outWindow.setHours(16, 0, 0, 0);
      expect(isWithinQuietHours(prefs, outWindow)).toBe(false);
    });

    it("throttles non-critical push notifications during quiet hours but delivers in-app", async () => {
      // Setup a user who is currently in quiet hours
      const curHour = new Date().getHours();
      const startH = (curHour - 1 + 24) % 24;
      const endH = (curHour + 2) % 24;

      const user = {
        id: 202,
        email: "student@trstprep.com",
        notificationPreferences: {
          quietHoursEnabled: true,
          quietHoursStart: `${String(startH).padStart(2, "0")}:00`,
          quietHoursEnd: `${String(endH).padStart(2, "0")}:00`,
        },
      };

      mockInsertOne.mockResolvedValueOnce({ id: 999, userId: 202 });

      // Non-critical reminder: push should be disabled due to quiet hours
      const reminderRes = await dispatchNotification(202, {
        title: "Daily Practice Reminder",
        message: "Time for your 15-minute drill",
        type: "reminder",
        sendPush: true,
        sendEmail: false,
        preloadedUser: user,
      });

      expect(reminderRes.inApp).toBeDefined();
      expect(reminderRes.push.skipped).toBe(true);

      // Critical payment notification: push MUST bypass quiet hours
      mockInsertOne.mockResolvedValueOnce({ id: 1000, userId: 202 });
      const paymentRes = await dispatchNotification(202, {
        title: "Payment Received",
        message: "Your subscription is active",
        type: "payment",
        sendPush: true,
        sendEmail: false,
        preloadedUser: user,
      });

      expect(paymentRes.inApp).toBeDefined();
      expect(paymentRes.push.success).toBe(true);
    });
  });

  describe("Specialized Notification Job Handlers", () => {
    it("handles streak-milestone jobs and awards recognition", async () => {
      mockFindById.mockResolvedValueOnce({
        id: 301,
        email: "streak@trstprep.com",
      });
      mockInsertOne.mockResolvedValueOnce({ id: 88, userId: 301 });

      const res = await handleNotificationJob(
        "notifications.streak-milestone",
        {
          userId: 301,
          streakDays: 7,
          xpAwarded: 50,
        },
      );

      expect(mockInsertOne).toHaveBeenCalledWith(
        "notifications",
        expect.objectContaining({
          userId: 301,
          title: expect.stringContaining("7-Day Study Streak!"),
          message: expect.stringContaining("+50 XP awarded"),
          type: "streak",
        }),
      );
    });

    it("handles discussion-reply jobs and links directly to the discussion thread", async () => {
      mockFindById.mockResolvedValueOnce({
        id: 302,
        email: "peer@trstprep.com",
      });
      mockInsertOne.mockResolvedValueOnce({ id: 89, userId: 302 });

      const res = await handleNotificationJob(
        "notifications.discussion-reply",
        {
          userId: 302,
          replierName: "Mentor Ravi",
          questionId: "q-reasoning-401",
          commentPreview:
            "Here is the alternate shortcut using divisibility by 9",
        },
      );

      expect(mockInsertOne).toHaveBeenCalledWith(
        "notifications",
        expect.objectContaining({
          userId: 302,
          title: "New reply from Mentor Ravi",
          actionUrl: "/discussions/q-reasoning-401",
          type: "discussion",
        }),
      );
    });

    it("handles mock-test-reminder jobs with test details and countdown alert", async () => {
      mockFindById.mockResolvedValueOnce({
        id: 303,
        email: "candidate@trstprep.com",
      });
      mockInsertOne.mockResolvedValueOnce({ id: 90, userId: 303 });

      const res = await handleNotificationJob(
        "notifications.mock-test-reminder",
        {
          userId: 303,
          testTitle: "SSC CGL All India Live Mock #4",
          startTime: "10:00 AM IST",
          testId: "mock-live-04",
          seriesSlug: "ssc-cgl-2026",
        },
      );

      expect(mockInsertOne).toHaveBeenCalledWith(
        "notifications",
        expect.objectContaining({
          userId: 303,
          title: "Upcoming Mock Test: SSC CGL All India Live Mock #4",
          actionUrl: "/ssc-cgl-2026/tests/mock-live-04",
          type: "mock_reminder",
        }),
      );
    });
  });
});
