import { isProUser } from '../shared/utils/user-utils.js'

/**
 * EntitlementService provides a single, canonical source of truth for
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
   * Considers admin status, pass type, explicit pro flags, and subscription dates.
   *
   * @param {Object} user
   * @returns {boolean}
   */
  static isPro(user) {
    if (!user) return false
    if (user.role === 'admin') return true
    
    if (typeof isProUser === 'function') {
      try {
        if (isProUser(user)) return true
      } catch {
        // Fall back to direct property examination
      }
    }

    const passType = String(user.passType || user.pass_type || '').toLowerCase()
    if (passType && passType !== 'free' && passType !== 'none') {
      return true
    }

    if (user.isProUser === true || user.is_pro_user === true || user.isPro === true || user.is_pro === true) {
      if (user.proExpiry || user.pro_expiry) {
        return new Date(user.proExpiry || user.pro_expiry) > new Date()
      }
      return true
    }

    return false
  }

  /**
   * Checks whether a given test is Pro-restricted.
   * Explicit Free indicators always take precedence.
   *
   * @param {Object} test
   * @returns {boolean}
   */
  static isTestPro(test) {
    if (!test) return false
    const type = String(test.type || test.test_type || test.testType || '').toLowerCase()
    if (type === 'free') return false
    if (test.isFree === true || test.is_free === true) return false
    if (String(test.accessType || test.access_type || '').toUpperCase() === 'FREE') return false
    return Boolean(
      test.isPro === true ||
      test.is_pro === true ||
      test.isProPass === true ||
      test.is_pro_pass === true ||
      type === 'pro' ||
      String(test.accessType || test.access_type || '').toUpperCase() === 'PRO' ||
      (Number(test.price) > 0)
    )
  }

  /**
   * Checks whether a given test series is Pro-restricted (marketing/catalog level).
   *
   * @param {Object} series
   * @returns {boolean}
   */
  static isSeriesPro(series) {
    if (!series) return false
    if (series.isFree === true || series.is_free === true) return false
    if (String(series.type || '').toLowerCase() === 'free') return false
    if (String(series.accessType || series.access_type || '').toUpperCase() === 'FREE') return false
    return Boolean(
      series.isPro === true ||
      series.is_pro === true ||
      series.isProPass === true ||
      series.is_pro_pass === true ||
      String(series.type || '').toLowerCase() === 'pro' ||
      String(series.accessType || series.access_type || '').toUpperCase() === 'PRO' ||
      (Number(series.price) > 0)
    )
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
        accessType: 'FREE',
        canAttempt: false,
        requiresPro: false,
        requiresAuth: false,
        allowed: false,
        reason: 'TEST_NOT_FOUND',
        message: 'Test not found'
      }
    }

    const isTestPro = this.isTestPro(test)
    const isProUser = this.isPro(user)
    const accessType = isTestPro ? 'PRO' : 'FREE'

    // Free test inside ANY series (Free or Pro) is attemptable by everyone
    if (!isTestPro) {
      return {
        accessType: 'FREE',
        canAttempt: true,
        requiresPro: false,
        requiresAuth: false,
        allowed: true,
        reason: null,
        message: null
      }
    }

    // Pro test requires authentication
    if (!user) {
      return {
        accessType: 'PRO',
        canAttempt: false,
        requiresPro: true,
        requiresAuth: true,
        allowed: false,
        reason: 'AUTH_REQUIRED',
        message: 'Authentication is required to access this Pro test'
      }
    }

    // Pro user has access
    if (isProUser) {
      return {
        accessType: 'PRO',
        canAttempt: true,
        requiresPro: false,
        requiresAuth: false,
        allowed: true,
        reason: null,
        message: null
      }
    }

    // Free user attempting Pro test
    return {
      accessType: 'PRO',
      canAttempt: false,
      requiresPro: true,
      requiresAuth: false,
      allowed: false,
      reason: 'PRO_REQUIRED',
      message: 'Pro Pass is required to access this test'
    }
  }

  /**
   * Backwards compatible helper for canAccessTest
   */
  static canAccessTest(user, test, series = null) {
    return this.getTestEntitlement(user, test, series)
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
      return { allowed: true, canEnroll: true, requiresPro: false }
    }
    if (!user) {
      return {
        allowed: false,
        canEnroll: false,
        reason: 'AUTH_REQUIRED',
        message: 'Authentication is required to enroll in this test series',
        requiresAuth: true,
        requiresPro: true
      }
    }
    if (this.isPro(user)) {
      return { allowed: true, canEnroll: true, requiresPro: false }
    }
    return {
      allowed: false,
      canEnroll: false,
      reason: 'PRO_REQUIRED',
      message: 'Pro Pass is required to enroll in this test series',
      requiresPro: true
    }
  }
}

export default EntitlementService
