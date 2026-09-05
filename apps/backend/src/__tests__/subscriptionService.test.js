import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

const mockPool = {
  query: (...args) => mockPoolQuery(...args),
  connect: jest.fn().mockResolvedValue({
    query: (...args) => mockClientQuery(...args),
    release: () => mockClientRelease(),
  }),
};

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: mockPool,
    dbHelpers: {},
  }),
);

const {
  default: subscriptionService,
  SUBSCRIPTION_PLANS,
  FEATURES,
  FREE_LIMITS,
} = await import("../services/SubscriptionService.js");
const { EntitlementService } =
  await import("../services/EntitlementService.js");

describe("SubscriptionService & EntitlementService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockPool.connect.mockResolvedValue({
      query: (...args) => mockClientQuery(...args),
      release: () => mockClientRelease(),
    });
  });

  describe("getUserSubscription", () => {
    it("returns active subscription row with plan_name", async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [
          {
            id: 1,
            user_id: 42,
            plan_type: "pro_yearly",
            plan_name: "Pro Yearly",
            status: "active",
            expiry_date: "2026-12-31T23:59:59Z",
          },
        ],
      });

      const sub = await subscriptionService.getUserSubscription(42);
      expect(sub).not.toBeNull();
      expect(sub.plan_type).toBe("pro_yearly");
      expect(sub.plan_name).toBe("Pro Yearly");
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("FROM subscriptions"),
        [42],
      );
    });

    it("returns null when no active subscription is found", async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });
      const sub = await subscriptionService.getUserSubscription(99);
      expect(sub).toBeNull();
    });
  });

  describe("hasActiveProPass", () => {
    it("returns true if active subscription plan includes pro_pass", async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 1, plan_type: "pro_pass_monthly", status: "active" }],
      });

      const isPro = await subscriptionService.hasActiveProPass(42);
      expect(isPro).toBe(true);
    });

    it("falls back to legacy users table pro_expiry when subscriptions row is missing", async () => {
      // 1st query: getUserSubscription -> empty
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      // 2nd query: users table check
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ is_pro_user: true, pro_expiry: futureDate }],
      });

      const isPro = await subscriptionService.hasActiveProPass(42);
      expect(isPro).toBe(true);
    });

    it("returns false if legacy pro_expiry is in the past", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ is_pro_user: true, pro_expiry: pastDate }],
      });

      const isPro = await subscriptionService.hasActiveProPass(42);
      expect(isPro).toBe(false);
    });
  });

  describe("hasFeature & getUserFeatures", () => {
    it("returns false if user has no subscription", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const hasFeat = await subscriptionService.hasFeature(
        42,
        FEATURES.ANALYTICS_DETAILED,
      );
      expect(hasFeat).toBe(false);
    });

    it("checks feature flag in subscription_features table", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ plan_type: "pro_pass_monthly" }],
      });
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ is_enabled: true }],
      });

      const hasFeat = await subscriptionService.hasFeature(
        42,
        FEATURES.REATTEMPT_WRONG,
      );
      expect(hasFeat).toBe(true);
    });

    it("getUserFeatures maps all enabled features as key-value pairs", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ plan_type: "pro_pass_yearly" }],
      });
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { feature_key: "analytics_detailed", is_enabled: true },
          { feature_key: "priority_support", is_enabled: false },
        ],
      });

      const feats = await subscriptionService.getUserFeatures(42);
      expect(feats).toEqual({
        analytics_detailed: true,
        priority_support: false,
      });
    });
  });

  describe("canAttemptTest", () => {
    it("allows unlimited attempts for Pro users", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ plan_type: "pro_pass_yearly", status: "active" }],
      });

      const decision = await subscriptionService.canAttemptTest(42, 101);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe("pro_user");
      expect(decision.unlimited).toBe(true);
    });

    it("allows free user if attempt count is below MAX_FREE_ATTEMPTS", async () => {
      // hasActiveProPass: getUserSubscription -> empty, users -> not pro
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_pro_user: false }] });
      // getAttemptCount -> 1
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: "1" }] });

      const decision = await subscriptionService.canAttemptTest(42, 101);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe("free_user");
      expect(decision.remaining).toBe(2);
    });

    it("rejects free user if attempt count reaches MAX_FREE_ATTEMPTS (3)", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ is_pro_user: false }] });
      // getAttemptCount -> 3
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: "3" }] });

      const decision = await subscriptionService.canAttemptTest(42, 101);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("limit_exceeded");
      expect(decision.currentAttempts).toBe(3);
      expect(decision.upgradeUrl).toBe("/pro-pass");
    });
  });

  describe("createSubscription", () => {
    it("executes atomic transaction inserting subscription and updating user pro status", async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 999,
              user_id: 1,
              plan_type: "pro_pass_monthly",
              status: "active",
            },
          ],
        }) // INSERT
        .mockResolvedValueOnce({}) // UPDATE users
        .mockResolvedValueOnce({}); // COMMIT

      const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
      const sub = await subscriptionService.createSubscription(
        1,
        "pro_pass_monthly",
        expiry,
        {
          amount_paid: 299,
          transaction_id: "tx_123",
        },
      );

      expect(sub.id).toBe(999);
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO subscriptions"),
        expect.any(Array),
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET is_pro_user = true"),
        [expiry, "pro_pass_monthly", 1],
      );
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it("rolls back transaction on error", async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error("Unique constraint violation")); // INSERT fails

      await expect(
        subscriptionService.createSubscription(
          1,
          "pro_pass_monthly",
          "2026-12-31",
        ),
      ).rejects.toThrow("Unique constraint violation");

      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  describe("cancelSubscription", () => {
    it("cancels with ownership verification when userId is provided", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });
      await subscriptionService.cancelSubscription(100, 42);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1 AND user_id = $2"),
        [100, 42],
      );
    });

    it("cancels by ID only when userId is omitted", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });
      await subscriptionService.cancelSubscription(100);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1"),
        [100],
      );
    });
  });

  describe("Solution Reattempt Queries", () => {
    it("getWrongQuestions queries incorrect answers for attempt", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ question_id: 10, question_text: "What is 2+2?" }],
      });

      const wrong = await subscriptionService.getWrongQuestions(500);
      expect(wrong).toHaveLength(1);
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE aa.attempt_id = $1 AND aa.is_correct = false",
        ),
        [500],
      );
    });

    it("getUnattemptedQuestions queries unselected answers for attempt", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ question_id: 11, question_text: "Skipped question" }],
      });

      const unattempted =
        await subscriptionService.getUnattemptedQuestions(500);
      expect(unattempted).toHaveLength(1);
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "aa.selected_option_id IS NULL OR aa.is_unattempted = true",
        ),
        [500],
      );
    });

    it("getSlowQuestions queries questions exceeding time threshold", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ question_id: 12, time_spent_seconds: 120 }],
      });

      const slow = await subscriptionService.getSlowQuestions(500, 90);
      expect(slow).toHaveLength(1);
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("aa.time_spent_seconds > $2"),
        [500, 90],
      );
    });
  });

  describe("EntitlementService Rules", () => {
    it("isSeriesPro correctly differentiates free vs pro test series", () => {
      expect(EntitlementService.isSeriesPro({ isFree: true })).toBe(false);
      expect(EntitlementService.isSeriesPro({ is_free: true })).toBe(false);
      expect(EntitlementService.isSeriesPro({ accessType: "FREE" })).toBe(
        false,
      );
      expect(EntitlementService.isSeriesPro({ type: "free" })).toBe(false);

      expect(EntitlementService.isSeriesPro({ isPro: true })).toBe(true);
      expect(EntitlementService.isSeriesPro({ isProPass: true })).toBe(true);
      expect(EntitlementService.isSeriesPro({ price: 499 })).toBe(true);
      expect(EntitlementService.isSeriesPro({ accessType: "PRO" })).toBe(true);
    });

    it("getTestEntitlement allows free tests regardless of series Pro status", () => {
      const freeTest = {
        id: 1,
        isPro: false,
        is_pro: false,
        accessType: "FREE",
      };
      const proSeries = { id: 10, isPro: true, price: 999 };

      const ent = EntitlementService.getTestEntitlement(
        null,
        freeTest,
        proSeries,
      );
      expect(ent.accessType).toBe("FREE");
      expect(ent.canAttempt).toBe(true);
      expect(ent.requiresPro).toBe(false);
    });

    it("getTestEntitlement blocks pro tests for anonymous or free users", () => {
      const proTest = { id: 2, isPro: true, accessType: "PRO" };
      const normalUser = { id: 5, is_pro_user: false, role: "student" };

      const ent = EntitlementService.getTestEntitlement(normalUser, proTest);
      expect(ent.accessType).toBe("PRO");
      expect(ent.canAttempt).toBe(false);
      expect(ent.requiresPro).toBe(true);
      expect(ent.reason).toBe("PRO_REQUIRED");
    });

    it("getTestEntitlement allows pro tests for active Pro or Admin users", () => {
      const proTest = { id: 2, isPro: true, accessType: "PRO" };
      const proUser = {
        id: 5,
        is_pro_user: true,
        pro_expiry: new Date(Date.now() + 100000).toISOString(),
      };
      const adminUser = { id: 6, role: "admin" };

      const entPro = EntitlementService.getTestEntitlement(proUser, proTest);
      expect(entPro.canAttempt).toBe(true);

      const entAdmin = EntitlementService.getTestEntitlement(
        adminUser,
        proTest,
      );
      expect(entAdmin.canAttempt).toBe(true);
    });
  });
});
