import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockDispatchNotification = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {
      pool: { query: (...args) => mockPoolQuery(...args) },
    },
  }),
);

jest.unstable_mockModule("../services/core/notificationService.js", () => ({
  notificationService: {
    dispatchNotification: (...args) => mockDispatchNotification(...args),
  },
  dispatchNotification: (...args) => mockDispatchNotification(...args),
}));

const { default: SubscriptionService, FREE_LIMITS } =
  await import("../services/SubscriptionService.js");

describe("Subscription & Plan Expiration Auto-Downgrade Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Subscription State & Grace Period Recognition", () => {
    it("recognizes active subscription with inGracePeriod: false", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: 101,
            plan_type: "pro_yearly",
            status: "active",
            expiry_date: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      });

      const sub = await SubscriptionService.getUserSubscription(101);

      expect(sub).toBeDefined();
      expect(sub.status).toBe("active");
      expect(sub.inGracePeriod).toBe(false);
    });

    it("recognizes grace_period subscription with inGracePeriod: true", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            user_id: 102,
            plan_type: "pro_monthly",
            status: "grace_period",
            expiry_date: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      });

      const sub = await SubscriptionService.getUserSubscription(102);

      expect(sub).toBeDefined();
      expect(sub.status).toBe("grace_period");
      expect(sub.inGracePeriod).toBe(true);
    });

    it("allows Pro Pass access during grace period", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            user_id: 103,
            plan_type: "pro_monthly",
            status: "grace_period",
          },
        ],
      });

      const hasPro = await SubscriptionService.hasActiveProPass(103);
      expect(hasPro).toBe(true);
    });

    it("denies Pro Pass access when no active subscription or pro expiry exists", async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [] }) // getUserSubscription
        .mockResolvedValueOnce({
          rows: [{ is_pro_user: false, pro_expiry: null }],
        }); // users table check

      const hasPro = await SubscriptionService.hasActiveProPass(104);
      expect(hasPro).toBe(false);
    });
  });

  describe("Grace Period Transition & Auto-Downgrade Engine", () => {
    it("transitions subscriptions within grace period to 'grace_period' and notifies users", async () => {
      const expiringSub = {
        id: 10,
        user_id: 201,
        plan_type: "pro_monthly",
        expiry_date: new Date(Date.now() - 12 * 3600000).toISOString(), // 12 hours ago
      };

      mockPoolQuery
        // 1. Grace period update
        .mockResolvedValueOnce({ rows: [expiringSub], rowCount: 1 })
        // 2. Final expiry update
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // 3. Legacy users reset
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockDispatchNotification.mockResolvedValue({
        success: true,
        notificationId: 99,
      });

      const result = await SubscriptionService.processExpiredSubscriptions({
        gracePeriodHours: 48,
        notify: true,
      });

      expect(result.success).toBe(true);
      expect(result.inGracePeriodCount).toBe(1);
      expect(result.downgradedCount).toBe(0);
      expect(result.notifiedUsers).toBe(1);

      expect(mockDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 201,
          type: "subscription_grace_period",
          title: expect.stringContaining("Grace Period"),
        }),
      );
    });

    it("auto-downgrades subscriptions past grace period to 'expired' and resets user pro status", async () => {
      const pastGraceSub = {
        id: 20,
        user_id: 202,
        plan_type: "pro_yearly",
        expiry_date: new Date(Date.now() - 72 * 3600000).toISOString(), // 72 hours ago (> 48h grace)
      };

      mockPoolQuery
        // 1. Grace period update
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // 2. Final expiry update
        .mockResolvedValueOnce({ rows: [pastGraceSub], rowCount: 1 })
        // 3. Auto-downgrade users table
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        // 4. Legacy users reset
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockDispatchNotification.mockResolvedValue({
        success: true,
        notificationId: 100,
      });

      const result = await SubscriptionService.processExpiredSubscriptions({
        gracePeriodHours: 48,
        notify: true,
      });

      expect(result.success).toBe(true);
      expect(result.inGracePeriodCount).toBe(0);
      expect(result.downgradedCount).toBe(1);
      expect(result.notifiedUsers).toBe(1);

      // Verify users table was updated to reset is_pro_user
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET is_pro_user = false"),
        [[202]],
      );

      // Verify expiration notice was dispatched
      expect(mockDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 202,
          type: "subscription_expired",
          title: expect.stringContaining("Expired"),
        }),
      );
    });

    it("handles database errors gracefully and returns error report", async () => {
      mockPoolQuery.mockRejectedValueOnce(
        new Error("Database pool disconnect"),
      );

      const result = await SubscriptionService.processExpiredSubscriptions();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database pool disconnect");
      expect(result.inGracePeriodCount).toBe(0);
      expect(result.downgradedCount).toBe(0);
    });
  });
});
