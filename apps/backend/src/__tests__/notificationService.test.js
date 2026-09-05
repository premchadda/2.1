import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockInsertOne = jest.fn();
const mockFindById = jest.fn();
const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {
      insertOne: (...args) => mockInsertOne(...args),
      findById: (...args) => mockFindById(...args),
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

const { notificationService } =
  await import("../services/core/notificationService.js");

describe("NotificationService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockIsNotificationEnabled.mockResolvedValue(true);
    mockGetFullSettings.mockResolvedValue({
      notifications: { notificationFrequency: "instant" },
    });
    mockSendNotificationEmail.mockResolvedValue({
      success: true,
      messageId: "msg-101",
    });
  });

  describe("createInAppNotification", () => {
    it("returns null when mandatory fields are missing", async () => {
      expect(
        await notificationService.createInAppNotification(null, {
          title: "T",
          message: "M",
        }),
      ).toBeNull();
      expect(
        await notificationService.createInAppNotification(1, {
          title: "",
          message: "M",
        }),
      ).toBeNull();
      expect(
        await notificationService.createInAppNotification(1, {
          title: "T",
          message: "",
        }),
      ).toBeNull();
    });

    it("creates in-app notification with canonical actionUrl and metadata", async () => {
      mockInsertOne.mockResolvedValueOnce({
        id: 55,
        userId: 1,
        title: "Score Ready",
        message: "Your mock test has been evaluated",
        actionUrl: "/results/123",
      });

      const res = await notificationService.createInAppNotification(1, {
        title: "Score Ready",
        message: "Your mock test has been evaluated",
        actionUrl: "/results/123",
        type: "result",
      });

      expect(res.id).toBe(55);
      expect(mockInsertOne).toHaveBeenCalledWith(
        "notifications",
        expect.objectContaining({
          userId: 1,
          channel: "in_app",
          isRead: false,
          actionUrl: "/results/123",
          type: "result",
        }),
      );
    });
  });

  describe("sendEmailNotification & sendPushNotification", () => {
    it("returns missing_recipient_or_content when user email is not present", async () => {
      const res = await notificationService.sendEmailNotification(
        { id: 1, email: null },
        { title: "Hello", message: "World" },
      );
      expect(res.success).toBe(false);
      expect(res.reason).toBe("missing_recipient_or_content");
    });

    it("delegates to EmailService when email is present", async () => {
      const res = await notificationService.sendEmailNotification(
        { id: 1, email: "student@example.com" },
        { title: "Update", message: "New quiz live", actionUrl: "/quizzes" },
      );
      expect(res.success).toBe(true);
      expect(mockSendNotificationEmail).toHaveBeenCalledWith(
        "student@example.com",
        "Update",
        "New quiz live",
        "/quizzes",
      );
    });

    it("generates push notification payload for active user", async () => {
      const res = await notificationService.sendPushNotification(
        { id: 42 },
        { title: "Live Contest", message: "Starts in 10 mins" },
      );
      expect(res.success).toBe(true);
      expect(res.channel).toBe("push");
      expect(res.payload.userId).toBe(42);
    });
  });

  describe("dispatchNotification", () => {
    it("returns user_not_found when user does not exist", async () => {
      mockFindById.mockResolvedValueOnce(null);
      const res = await notificationService.dispatchNotification(999, {
        title: "Alert",
        message: "Notice",
      });
      expect(res.success).toBe(false);
      expect(res.reason).toBe("user_not_found");
    });

    it("dispatches in-app, email, and push for critical notifications", async () => {
      const user = { id: 7, email: "pro@test.com", name: "ProUser" };
      mockFindById.mockResolvedValueOnce(user);
      mockInsertOne.mockResolvedValueOnce({ id: 101 });

      const res = await notificationService.dispatchNotification(7, {
        title: "Payment Successful",
        message: "Pro Pass Activated",
        type: "payment",
      });

      expect(res.inApp).toBeDefined();
      expect(res.email.success).toBe(true);
      expect(res.push.success).toBe(true);
    });

    it("skips email when admin setting is disabled for notification type", async () => {
      const user = { id: 7, email: "pro@test.com", name: "ProUser" };
      mockFindById.mockResolvedValueOnce(user);
      mockInsertOne.mockResolvedValueOnce({ id: 102 });
      mockIsNotificationEnabled.mockImplementation(async (key) => {
        if (key === "emailOnPayment") return false;
        return true;
      });

      const res = await notificationService.dispatchNotification(7, {
        title: "Payment Confirmed",
        message: "Invoice attached",
        type: "payment",
      });

      expect(res.inApp).toBeDefined();
      expect(res.email.skipped).toBe(true);
      expect(res.email.reason).toBe("disabled_by_settings");
    });
  });

  describe("handleNotificationJob", () => {
    it("handles test-result-ready event and builds canonical test result URL", async () => {
      const user = { id: 10, email: "tester@test.com" };
      mockFindById.mockResolvedValueOnce(user);
      mockInsertOne.mockResolvedValueOnce({ id: 301 });

      const result = await notificationService.handleNotificationJob(
        "notifications.test-result-ready",
        {
          userId: 10,
          testId: 45,
          attemptId: 102,
          seriesSlug: "rrb-ntpc-2026",
          testTitle: "RRB NTPC Mock 3",
        },
      );

      expect(result.inApp).toBeDefined();
      const insertCall = mockInsertOne.mock.calls[0][1];
      expect(insertCall.actionUrl).toBe(
        "/rrb-ntpc-2026/tests/45/result?attemptId=102",
      );
    });

    it("returns skipped for unrecognized job types", async () => {
      const result = await notificationService.handleNotificationJob(
        "notifications.unknown-type",
        {},
      );
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("unknown_job_name");
    });
  });

  describe("sendScheduledReminders", () => {
    it("returns 0 reminders when no users are inactive", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const res = await notificationService.sendScheduledReminders({
        inactivityHours: 48,
      });
      expect(res.remindersSent).toBe(0);
    });

    it("dispatches reminder for inactive users past cutoff interval", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 201,
            email: "inactive@test.com",
            name: "Sleepy",
            is_active: true,
          },
        ],
      });
      mockInsertOne.mockResolvedValueOnce({ id: 401 });

      const res = await notificationService.sendScheduledReminders({
        inactivityHours: 24,
      });
      expect(res.remindersSent).toBe(1);
      expect(mockInsertOne).toHaveBeenCalledWith(
        "notifications",
        expect.objectContaining({
          userId: 201,
          type: "reminder",
        }),
      );
    });
  });
});
