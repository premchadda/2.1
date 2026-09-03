/**
 * TestPolicyEngine — Canonical policy resolver for Trstprep V2.1.
 *
 * Implements the authoritative decision contract across:
 * - User Entitlement & Plan resolution (GUEST, FREE, TEST_SERIES, PRO_MONTHLY, PRO_YEARLY, ADMIN, SUSPENDED)
 * - Test Lifecycle & Discovery validation (DRAFT, REVIEW, SCHEDULED, PUBLISHED, LIVE, EXPIRED, ARCHIVED)
 * - Action-level permissions (canDiscover, canViewDetails, canViewInstructions, canStart, canResume, canSubmit, canViewResult, canReview, canReattempt)
 * - Standardized error codes for consistent client handling
 */

import {
  USER_PLANS,
  TEST_STATES,
  ATTEMPT_STATES,
  REATTEMPT_TYPES,
  POLICY_ERROR_CODES,
  isValidAttemptTransition,
} from "../../constants/lifecycle.constants.js";

export {
  USER_PLANS,
  TEST_STATES,
  ATTEMPT_STATES,
  REATTEMPT_TYPES,
  POLICY_ERROR_CODES,
  isValidAttemptTransition,
};

export class TestPolicyEngine {
  /**
   * Resolves the canonical user entitlement plan.
   *
   * @param {Object|null} user
   * @returns {{ effectivePlan: string, isAdmin: boolean, isPro: boolean, isSuspended: boolean }}
   */
  static resolveUserEntitlement(user) {
    if (!user) {
      return {
        effectivePlan: USER_PLANS.GUEST,
        isAdmin: false,
        isPro: false,
        isSuspended: false,
      };
    }

    if (
      user.is_suspended === true ||
      user.status === "suspended" ||
      user.isSuspended === true
    ) {
      return {
        effectivePlan: USER_PLANS.SUSPENDED,
        isAdmin: false,
        isPro: false,
        isSuspended: true,
      };
    }

    const isAdmin = user.role === "admin";
    const passType = String(
      user.passType || user.pass_type || "",
    ).toLowerCase();

    let effectivePlan = USER_PLANS.FREE;
    let isPro = false;

    if (isAdmin) {
      effectivePlan = USER_PLANS.ADMIN;
    } else if (
      passType.includes("yearly") ||
      user.plan === "yearly" ||
      user.plan === "pro_yearly"
    ) {
      effectivePlan = USER_PLANS.PRO_YEARLY;
      isPro = true;
    } else if (
      passType.includes("monthly") ||
      user.plan === "monthly" ||
      user.plan === "pro_monthly" ||
      passType === "pro"
    ) {
      effectivePlan = USER_PLANS.PRO_MONTHLY;
      isPro = true;
    } else if (passType.includes("series") || passType === "test_series") {
      effectivePlan = USER_PLANS.TEST_SERIES;
    } else if (
      user.isProUser === true ||
      user.is_pro_user === true ||
      user.isPro === true ||
      user.is_pro === true
    ) {
      const expiry = user.proExpiry || user.pro_expiry;
      if (!expiry || new Date(expiry) > new Date()) {
        effectivePlan = USER_PLANS.PRO_MONTHLY;
        isPro = true;
      }
    }

    return {
      effectivePlan,
      isAdmin,
      isPro,
      isSuspended: false,
    };
  }

  /**
   * Determines whether a test requires Pro pass.
   * Explicit Free indicators always take precedence.
   *
   * @param {Object} test
   * @returns {boolean}
   */
  static isTestPro(test) {
    if (!test) return false;
    const type = String(
      test.type || test.test_type || test.testType || "",
    ).toLowerCase();
    if (type === "free") return false;
    if (test.isFree === true || test.is_free === true) return false;
    if (
      String(test.accessType || test.access_type || "").toUpperCase() === "FREE"
    )
      return false;

    return Boolean(
      test.isPro === true ||
      test.is_pro === true ||
      test.isProPass === true ||
      test.is_pro_pass === true ||
      type === "pro" ||
      String(test.accessType || test.access_type || "").toUpperCase() ===
        "PRO" ||
      Number(test.price) > 0,
    );
  }

  /**
   * Evaluates complete action-level permissions for a user and a test.
   *
   * @param {Object|null} user
   * @param {Object} test
   * @param {Object} [context={}]
   * @param {number} [context.completedAttemptsCount=0]
   * @param {Object|null} [context.activeAttempt=null]
   * @returns {Object} Comprehensive resolved policy
   */
  static resolveTestAccess(user, test, context = {}) {
    if (!test) {
      return {
        canDiscover: false,
        canViewDetails: false,
        canViewInstructions: false,
        canStart: false,
        canResume: false,
        canSubmit: false,
        canViewResult: false,
        canReview: false,
        canReattempt: {
          full: false,
          wrong: false,
          unattempted: false,
          slow: false,
          smart: false,
        },
        code: POLICY_ERROR_CODES.TEST_UNAVAILABLE,
        message: "Test not found",
      };
    }

    const { effectivePlan, isAdmin, isPro, isSuspended } =
      this.resolveUserEntitlement(user);
    const testIsPro = this.isTestPro(test);
    const status = String(test.status || "published").toLowerCase();
    const isActive = test.is_active !== false && test.isActive !== false;
    const now = new Date();

    const isLive = Boolean(
      test.isLive ||
      test.is_live ||
      test.type === "live-tests" ||
      test.type === "live" ||
      test.testType === "live-tests" ||
      test.testType === "live" ||
      test.scheduledAt ||
      test.scheduled_at ||
      test.startTime ||
      test.start_time,
    );

    const scheduledStart =
      test.scheduledAt ||
      test.scheduled_at ||
      test.startTime ||
      test.start_time ||
      test.scheduledStart ||
      test.scheduled_start;
    const scheduledEnd =
      test.scheduledEnd ||
      test.scheduled_end ||
      test.dateEnd ||
      test.date_end ||
      test.endTime ||
      test.end_time;

    const isBeforeLiveStart = scheduledStart && now < new Date(scheduledStart);
    const isPastLiveEnd = scheduledEnd && now > new Date(scheduledEnd);

    // 1. Account Suspended Check
    if (isSuspended) {
      return {
        canDiscover: false,
        canViewDetails: false,
        canViewInstructions: false,
        canStart: false,
        canResume: false,
        canSubmit: false,
        canViewResult: false,
        canReview: false,
        canReattempt: {
          full: false,
          wrong: false,
          unattempted: false,
          slow: false,
          smart: false,
        },
        code: POLICY_ERROR_CODES.ACCOUNT_RESTRICTED,
        message:
          "Your account is currently restricted from participating in tests.",
      };
    }

    // 2. Lifecycle & Visibility
    let canDiscover = false;
    let canViewDetails = false;
    let canViewInstructions = false;

    if (isAdmin) {
      canDiscover = true;
      canViewDetails = true;
      canViewInstructions = true;
    } else {
      if (
        status === "draft" ||
        status === "review" ||
        status === "archived" ||
        !isActive
      ) {
        canDiscover = false;
        canViewDetails = false;
      } else if (status === "scheduled" && isBeforeLiveStart) {
        canDiscover = true;
        canViewDetails = true;
        canViewInstructions = false;
      } else {
        canDiscover = true;
        canViewDetails = true;
        canViewInstructions = Boolean(user);
      }
    }

    // 3. Start / Attempt Permission
    let canStart = false;
    let startCode = null;
    let startMessage = null;

    const hasActiveAttempt = Boolean(context.activeAttempt);
    const completedAttemptsCount = Number(context.completedAttemptsCount || 0);

    if (isAdmin) {
      canStart = true;
    } else if (!user) {
      canStart = false;
      startCode = POLICY_ERROR_CODES.AUTH_REQUIRED;
      startMessage = "Please sign in to attempt this test.";
    } else if (status === "draft" || status === "review") {
      canStart = false;
      startCode = POLICY_ERROR_CODES.TEST_NOT_AVAILABLE;
      startMessage =
        "This test is currently under review and cannot be started.";
    } else if (status === "archived" || !isActive) {
      canStart = false;
      startCode = POLICY_ERROR_CODES.TEST_UNAVAILABLE;
      startMessage = "This test is no longer available.";
    } else if (isLive && isBeforeLiveStart) {
      canStart = false;
      startCode = POLICY_ERROR_CODES.LIVE_TEST_NOT_STARTED;
      startMessage = `This live test contest starts at ${new Date(scheduledStart).toLocaleString("en-IN")}.`;
    } else if (isLive && isPastLiveEnd && !hasActiveAttempt) {
      canStart = false;
      startCode = POLICY_ERROR_CODES.LIVE_TEST_ENDED;
      startMessage = "This live test contest has ended.";
    } else if (testIsPro && !isPro) {
      canStart = false;
      startCode = POLICY_ERROR_CODES.PRO_REQUIRED;
      startMessage = "A Pro Pass is required to attempt this test.";
    } else if (
      !testIsPro &&
      effectivePlan === USER_PLANS.FREE &&
      completedAttemptsCount >= 3 &&
      !hasActiveAttempt
    ) {
      canStart = false;
      startCode = POLICY_ERROR_CODES.ATTEMPT_LIMIT_REACHED;
      startMessage =
        "You have reached the free limit of 3 completed attempts for this test. Upgrade to Pro for unlimited attempts.";
    } else {
      canStart = true;
    }

    // 4. Live Test Solution Lock Check
    const isLiveSolutionLocked = isLive && !isPastLiveEnd && !isAdmin;

    // 5. Reattempt Permissions Matrix
    const isLiveActive = isLive && !isPastLiveEnd;
    const canReattempt = {
      full:
        !isLiveActive &&
        (isPro ||
          isAdmin ||
          (effectivePlan === USER_PLANS.FREE && completedAttemptsCount < 3)),
      wrong: !isLiveActive && (isPro || isAdmin),
      unattempted: !isLiveActive && (isPro || isAdmin),
      slow: !isLiveActive && (isPro || isAdmin),
      smart: !isLiveActive && (isPro || isAdmin),
    };

    return {
      canDiscover,
      canViewDetails,
      canViewInstructions: canViewInstructions && canStart,
      canStart,
      canResume: hasActiveAttempt,
      canSubmit: hasActiveAttempt,
      canViewResult: true,
      canReview: !isLiveSolutionLocked,
      isLiveSolutionLocked,
      canReattempt,
      effectivePlan,
      isPro,
      isAdmin,
      code: startCode,
      message: startMessage,
    };
  }
}

export default TestPolicyEngine;
