import { isProUser } from "../shared/utils/user-utils.js";
import { TestPolicyEngine } from "./core/TestPolicyEngine.js";

/**
 * EntitlementService provides a canonical authority for
 * evaluating user access permissions across tests, series, and premium features.
 *
 * Rules:
 * 1. Series visibility/access ≠ individual Test access.
 * 2. A FREE series can contain PRO tests (which require Pro Pass).
 * 3. A PRO series can contain FREE tests (which any user can attempt for free).
 * 4. Never derive Test attempt access from Series access.
 */
export class EntitlementService {
  /**
   * Evaluates whether a user has active Pro privileges.
   *
   * @param {Object} user
   * @returns {boolean}
   */
  static isPro(user) {
    if (!user) return false;
    const { isPro, isAdmin } = TestPolicyEngine.resolveUserEntitlement(user);
    return Boolean(isPro || isAdmin);
  }

  /**
   * Resolves canonical user entitlement plan object.
   * @param {Object} user
   * @returns {Object}
   */
  static resolveEntitlement(user) {
    return TestPolicyEngine.resolveUserEntitlement(user);
  }

  /**
   * Checks whether a given test is Pro-restricted.
   *
   * @param {Object} test
   * @returns {boolean}
   */
  static isTestPro(test) {
    return TestPolicyEngine.isTestPro(test);
  }

  /**
   * Checks whether a given test series is Pro-restricted (marketing/catalog level).
   *
   * @param {Object} series
   * @returns {boolean}
   */
  static isSeriesPro(series) {
    if (!series) return false;
    if (series.isFree === true || series.is_free === true) return false;
    if (String(series.type || "").toLowerCase() === "free") return false;
    if (
      String(series.accessType || series.access_type || "").toUpperCase() ===
      "FREE"
    )
      return false;
    return Boolean(
      series.isPro === true ||
      series.is_pro === true ||
      series.isProPass === true ||
      series.is_pro_pass === true ||
      String(series.type || "").toLowerCase() === "pro" ||
      String(series.accessType || series.access_type || "").toUpperCase() ===
        "PRO" ||
      Number(series.price) > 0,
    );
  }

  /**
   * Evaluates canonical test entitlement.
   * Test attempt entitlement is strictly decoupled from Series classification.
   *
   * @param {Object|null} user
   * @param {Object} test
   * @param {Object|null} series
   * @returns {{ accessType: 'FREE'|'PRO', canAttempt: boolean, requiresPro: boolean, requiresAuth: boolean, allowed: boolean, reason: string|null, message: string|null }}
   */
  static getTestEntitlement(user, test, _series = null) {
    if (!test) {
      return {
        accessType: "FREE",
        canAttempt: false,
        requiresPro: false,
        requiresAuth: false,
        allowed: false,
        reason: "TEST_NOT_FOUND",
        message: "Test not found",
      };
    }

    const isTestPro = this.isTestPro(test);
    const isProUser = this.isPro(user);
    const accessType = isTestPro ? "PRO" : "FREE";

    // Free test inside ANY series (Free or Pro) is attemptable by everyone
    if (!isTestPro) {
      return {
        accessType: "FREE",
        canAttempt: true,
        requiresPro: false,
        requiresAuth: false,
        allowed: true,
        reason: null,
        message: null,
      };
    }

    // Pro test requires authentication
    if (!user) {
      return {
        accessType: "PRO",
        canAttempt: false,
        requiresPro: true,
        requiresAuth: true,
        allowed: false,
        reason: "AUTH_REQUIRED",
        message: "Authentication is required to access this Pro test",
      };
    }

    // Pro user has access
    if (isProUser) {
      return {
        accessType: "PRO",
        canAttempt: true,
        requiresPro: false,
        requiresAuth: false,
        allowed: true,
        reason: null,
        message: null,
      };
    }

    // Free user attempting Pro test
    return {
      accessType: "PRO",
      canAttempt: false,
      requiresPro: true,
      requiresAuth: false,
      allowed: false,
      reason: "PRO_REQUIRED",
      message: "Pro Pass is required to access this test",
    };
  }

  /**
   * Backwards compatible helper for canAccessTest
   */
  static canAccessTest(user, test, series = null) {
    return this.getTestEntitlement(user, test, series);
  }

  /**
   * Evaluates whether a user can enroll in a test series.
   *
   * @param {Object|null} user
   * @param {Object} series
   * @returns {{ allowed: boolean, reason?: string, message?: string, requiresPro?: boolean }}
   */
  static canEnrollSeries(user, series) {
    if (!this.isSeriesPro(series)) {
      return { allowed: true, canEnroll: true, requiresPro: false };
    }
    if (!user) {
      return {
        allowed: false,
        canEnroll: false,
        reason: "AUTH_REQUIRED",
        message: "Authentication is required to enroll in this test series",
        requiresAuth: true,
        requiresPro: true,
      };
    }
    if (this.isPro(user)) {
      return { allowed: true, canEnroll: true, requiresPro: false };
    }
    return {
      allowed: false,
      canEnroll: false,
      reason: "PRO_REQUIRED",
      message: "Pro Pass is required to enroll in this test series",
      requiresPro: true,
    };
  }
}

export default EntitlementService;
