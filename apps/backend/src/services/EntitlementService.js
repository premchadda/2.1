import { isProUser } from '../shared/utils/user-utils.js'

/**
 * EntitlementService provides a single, canonical source of truth for
 * evaluating user access permissions across tests, series, and premium features.
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
   *
   * @param {Object} test
   * @returns {boolean}
   */
  static isTestPro(test) {
    if (!test) return false
    const type = String(test.type || '').toLowerCase()
    if (type === 'free') return false
    if (test.isFree === true || test.is_free === true) return false
    return Boolean(test.isPro === true || test.is_pro === true || type === 'pro')
  }

  /**
   * Checks whether a given test series is Pro-restricted.
   *
   * @param {Object} series
   * @returns {boolean}
   */
  static isSeriesPro(series) {
    if (!series) return false
    if (series.isFree === true || series.is_free === true) return false
    return Boolean(series.isPro === true || series.is_pro === true)
  }

  /**
   * Evaluates whether a user can access a test for taking/starting.
   *
   * @param {Object|null} user
   * @param {Object} test
   * @returns {{ allowed: boolean, reason?: string, message?: string, requiresPro?: boolean }}
   */
  static canAccessTest(user, test) {
    if (!this.isTestPro(test)) {
      return { allowed: true }
    }
    if (!user) {
      return {
        allowed: false,
        reason: 'AUTH_REQUIRED',
        message: 'Authentication is required to access this test',
        requiresAuth: true
      }
    }
    if (this.isPro(user)) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: 'PRO_REQUIRED',
      message: 'Pro Pass is required to access this test',
      requiresPro: true
    }
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
      return { allowed: true }
    }
    if (!user) {
      return {
        allowed: false,
        reason: 'AUTH_REQUIRED',
        message: 'Authentication is required to enroll in this test series',
        requiresAuth: true
      }
    }
    if (this.isPro(user)) {
      return { allowed: true }
    }
    return {
      allowed: false,
      reason: 'PRO_REQUIRED',
      message: 'Pro Pass is required to enroll in this test series',
      requiresPro: true
    }
  }
}

export default EntitlementService
