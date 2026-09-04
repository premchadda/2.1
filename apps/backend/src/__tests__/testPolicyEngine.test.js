import {
  TestPolicyEngine,
  USER_PLANS,
  POLICY_ERROR_CODES,
} from "../services/core/TestPolicyEngine.js";

describe("TestPolicyEngine Matrix Suite", () => {
  const mockFreeTest = {
    id: 101,
    title: "SSC CGL Reasoning Mock 1",
    type: "free",
    isFree: true,
    status: "published",
    is_active: true,
  };

  const mockProTest = {
    id: 102,
    title: "SSC CGL Tier 2 Pro Mock",
    type: "pro",
    isPro: true,
    status: "published",
    is_active: true,
  };

  const mockDraftTest = {
    id: 103,
    title: "Unreleased Draft Mock",
    type: "free",
    status: "draft",
    is_active: true,
  };

  const mockScheduledFutureLiveTest = {
    id: 104,
    title: "All India Live Contest 2026",
    type: "live",
    isLive: true,
    status: "scheduled",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    scheduledEnd: new Date(Date.now() + 172800000).toISOString(),
    is_active: true,
  };

  const mockActiveLiveTest = {
    id: 105,
    title: "Active Live Test Contest",
    type: "live",
    isLive: true,
    status: "published",
    scheduledAt: new Date(Date.now() - 3600000).toISOString(),
    scheduledEnd: new Date(Date.now() + 3600000).toISOString(),
    is_active: true,
  };

  const mockConcludedLiveTest = {
    id: 106,
    title: "Concluded Live Test Contest",
    type: "live",
    isLive: true,
    status: "published",
    scheduledAt: new Date(Date.now() - 7200000).toISOString(),
    scheduledEnd: new Date(Date.now() - 3600000).toISOString(),
    is_active: true,
  };

  describe("User Entitlement Resolution", () => {
    test("resolves null user to GUEST plan", () => {
      const res = TestPolicyEngine.resolveUserEntitlement(null);
      expect(res.effectivePlan).toBe(USER_PLANS.GUEST);
      expect(res.isAdmin).toBe(false);
      expect(res.isPro).toBe(false);
    });

    test("resolves standard free user", () => {
      const user = { id: 1, role: "user", pass_type: "free" };
      const res = TestPolicyEngine.resolveUserEntitlement(user);
      expect(res.effectivePlan).toBe(USER_PLANS.FREE);
      expect(res.isPro).toBe(false);
    });

    test("resolves pro monthly subscriber", () => {
      const user = { id: 2, role: "user", pass_type: "pro_monthly" };
      const res = TestPolicyEngine.resolveUserEntitlement(user);
      expect(res.effectivePlan).toBe(USER_PLANS.PRO_MONTHLY);
      expect(res.isPro).toBe(true);
    });

    test("resolves pro yearly subscriber", () => {
      const user = { id: 3, role: "user", pass_type: "pro_yearly" };
      const res = TestPolicyEngine.resolveUserEntitlement(user);
      expect(res.effectivePlan).toBe(USER_PLANS.PRO_YEARLY);
      expect(res.isPro).toBe(true);
    });

    test("resolves test series enrolled user", () => {
      const user = { id: 4, role: "user", pass_type: "test_series" };
      const res = TestPolicyEngine.resolveUserEntitlement(user);
      expect(res.effectivePlan).toBe(USER_PLANS.TEST_SERIES);
      expect(res.isPro).toBe(false);
    });

    test("resolves admin user with separate isAdmin flag", () => {
      const user = { id: 5, role: "admin" };
      const res = TestPolicyEngine.resolveUserEntitlement(user);
      expect(res.effectivePlan).toBe(USER_PLANS.ADMIN);
      expect(res.isAdmin).toBe(true);
    });

    test("resolves suspended user", () => {
      const user = { id: 6, role: "user", is_suspended: true };
      const res = TestPolicyEngine.resolveUserEntitlement(user);
      expect(res.effectivePlan).toBe(USER_PLANS.SUSPENDED);
      expect(res.isSuspended).toBe(true);
    });
  });

  describe("Guest Access Layer", () => {
    test("guest can discover and view details of published free test, but cannot start", () => {
      const policy = TestPolicyEngine.resolveTestAccess(null, mockFreeTest);
      expect(policy.canDiscover).toBe(true);
      expect(policy.canViewDetails).toBe(true);
      expect(policy.canStart).toBe(false);
      expect(policy.code).toBe(POLICY_ERROR_CODES.AUTH_REQUIRED);
    });

    test("guest cannot discover draft test", () => {
      const policy = TestPolicyEngine.resolveTestAccess(null, mockDraftTest);
      expect(policy.canDiscover).toBe(false);
      expect(policy.canViewDetails).toBe(false);
    });
  });

  describe("Free User Attempt Limits & Pro Gates", () => {
    const freeUser = { id: 10, role: "user", pass_type: "free" };

    test("free user can start free test when attempts < 3", () => {
      const policy = TestPolicyEngine.resolveTestAccess(
        freeUser,
        mockFreeTest,
        {
          completedAttemptsCount: 1,
        },
      );
      expect(policy.canStart).toBe(true);
      expect(policy.canReattempt.full).toBe(true);
      expect(policy.canReattempt.wrong).toBe(false);
    });

    test("free user is blocked from starting free test when completed attempts >= 3", () => {
      const policy = TestPolicyEngine.resolveTestAccess(
        freeUser,
        mockFreeTest,
        {
          completedAttemptsCount: 3,
        },
      );
      expect(policy.canStart).toBe(false);
      expect(policy.code).toBe(POLICY_ERROR_CODES.ATTEMPT_LIMIT_REACHED);
    });

    test("free user can resume an active in-progress attempt even if 3 completed exist", () => {
      const policy = TestPolicyEngine.resolveTestAccess(
        freeUser,
        mockFreeTest,
        {
          completedAttemptsCount: 3,
          activeAttempt: { id: 999, status: "in_progress" },
        },
      );
      expect(policy.canStart).toBe(true);
      expect(policy.canResume).toBe(true);
    });

    test("free user is blocked from Pro test with PRO_REQUIRED", () => {
      const policy = TestPolicyEngine.resolveTestAccess(freeUser, mockProTest);
      expect(policy.canStart).toBe(false);
      expect(policy.code).toBe(POLICY_ERROR_CODES.PRO_REQUIRED);
    });
  });

  describe("Pro & Admin Access & Live Contest Locking", () => {
    const proUser = { id: 20, role: "user", pass_type: "pro_monthly" };
    const adminUser = { id: 30, role: "admin" };

    test("pro user can attempt pro test and has full reattempt modes", () => {
      const policy = TestPolicyEngine.resolveTestAccess(proUser, mockProTest);
      expect(policy.canStart).toBe(true);
      expect(policy.canReattempt.wrong).toBe(true);
      expect(policy.canReattempt.unattempted).toBe(true);
      expect(policy.canReattempt.slow).toBe(true);
      expect(policy.canReattempt.smart).toBe(true);
    });

    test("admin can preview draft test", () => {
      const policy = TestPolicyEngine.resolveTestAccess(
        adminUser,
        mockDraftTest,
      );
      expect(policy.canDiscover).toBe(true);
      expect(policy.canViewDetails).toBe(true);
      expect(policy.canStart).toBe(true);
    });

    test("non-admin is blocked from starting future scheduled live test", () => {
      const policy = TestPolicyEngine.resolveTestAccess(
        proUser,
        mockScheduledFutureLiveTest,
      );
      expect(policy.canStart).toBe(false);
      expect(policy.code).toBe(POLICY_ERROR_CODES.LIVE_TEST_NOT_STARTED);
    });

    test("live test active contest locks review solutions for students", () => {
      const studentPolicy = TestPolicyEngine.resolveTestAccess(
        proUser,
        mockActiveLiveTest,
      );
      expect(studentPolicy.isLiveSolutionLocked).toBe(true);
      expect(studentPolicy.canReview).toBe(false);

      const adminPolicy = TestPolicyEngine.resolveTestAccess(
        adminUser,
        mockActiveLiveTest,
      );
      expect(adminPolicy.isLiveSolutionLocked).toBe(false);
      expect(adminPolicy.canReview).toBe(true);
    });

    test("concluded live test unlocks review solutions for all participants", () => {
      const policy = TestPolicyEngine.resolveTestAccess(
        proUser,
        mockConcludedLiveTest,
      );
      expect(policy.isLiveSolutionLocked).toBe(false);
      expect(policy.canReview).toBe(true);
    });
  });
});
