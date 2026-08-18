/**
 * TRSTPrep Central Entitlement Engine
 *
 * Single source of truth for test attempt access, permissions, badges, and CTA resolution.
 * 
 * Core Architectural Rules:
 * 1. Series visibility/access ≠ individual Test access.
 * 2. A FREE series can contain PRO tests (which require Pro Pass).
 * 3. A PRO series can contain FREE tests (which any user can attempt for free).
 * 4. Never derive Test attempt access from Series access.
 * 5. A test's attempt entitlement is determined strictly by the individual test's
 *    access type and the user's subscription status.
 */

/**
 * Checks if a user has active Pro subscription / privileges.
 * 
 * @param {Object|null} user
 * @returns {boolean}
 */
export const isUserPro = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const passType = String(user.passType || user.pass_type || '').toLowerCase();
  if (passType && passType !== 'free' && passType !== 'none') {
    return true;
  }

  if (
    user.isProUser === true ||
    user.is_pro_user === true ||
    user.isPro === true ||
    user.is_pro === true ||
    user.hasProPass === true
  ) {
    const expiry = user.proExpiry || user.pro_expiry;
    if (expiry) {
      const expDate = new Date(expiry);
      if (!isNaN(expDate.getTime())) {
        return expDate > new Date();
      }
    }
    return true;
  }

  return false;
};

/**
 * Resolves the access type of an individual test ('FREE' or 'PRO').
 * Explicit free flags always take precedence.
 * 
 * @param {Object} test
 * @returns {'FREE' | 'PRO'}
 */
export const getTestAccessType = (test) => {
  if (!test) return 'FREE';

  const type = String(test.type || test.test_type || test.testType || '').toLowerCase();
  if (type === 'free') return 'FREE';
  if (test.isFree === true || test.is_free === true) return 'FREE';
  if (String(test.accessType || test.access_type || '').toUpperCase() === 'FREE') return 'FREE';

  const isPro = Boolean(
    test.isPro === true ||
    test.is_pro === true ||
    test.isProPass === true ||
    test.is_pro_pass === true ||
    type === 'pro' ||
    String(test.accessType || test.access_type || '').toUpperCase() === 'PRO' ||
    (Number(test.price) > 0)
  );

  return isPro ? 'PRO' : 'FREE';
};

/**
 * Resolves the access type of a test series ('FREE' or 'PRO') for catalog/marketing.
 * 
 * @param {Object} series
 * @returns {'FREE' | 'PRO'}
 */
export const getSeriesAccessType = (series) => {
  if (!series) return 'FREE';

  const type = String(series.type || '').toLowerCase();
  if (type === 'free') return 'FREE';
  if (series.isFree === true || series.is_free === true) return 'FREE';
  if (String(series.accessType || series.access_type || '').toUpperCase() === 'FREE') return 'FREE';

  const isPro = Boolean(
    series.isPro === true ||
    series.is_pro === true ||
    series.isProPass === true ||
    series.is_pro_pass === true ||
    type === 'pro' ||
    String(series.accessType || series.access_type || '').toUpperCase() === 'PRO' ||
    (Number(series.price) > 0)
  );

  return isPro ? 'PRO' : 'FREE';
};

/**
 * Evaluates canonical entitlement for an individual test.
 * Test attempt entitlement is strictly decoupled from Series classification.
 * 
 * @param {Object} params
 * @param {Object} params.test - The test object
 * @param {Object|null} [params.user] - The authenticated user object
 * @param {Object|null} [params.series] - The parent series object (optional)
 * @returns {{
 *   accessType: 'FREE' | 'PRO',
 *   isUserPro: boolean,
 *   canAttempt: boolean,
 *   requiresPro: boolean,
 *   requiresLogin: boolean,
 *   isLocked: boolean,
 *   reason: string | null,
 *   message: string | null
 * }}
 */
export const getTestEntitlement = ({ test, user, series = null }) => {
  if (!test) {
    return {
      accessType: 'FREE',
      isUserPro: false,
      canAttempt: false,
      requiresPro: false,
      requiresLogin: false,
      isLocked: true,
      reason: 'TEST_NOT_FOUND',
      message: 'Test not found',
    };
  }

  const accessType = getTestAccessType(test);
  const userIsPro = isUserPro(user);

  // Free test inside ANY series (Free or Pro) is attemptable by everyone
  if (accessType === 'FREE') {
    return {
      accessType: 'FREE',
      isUserPro: userIsPro,
      canAttempt: true,
      requiresPro: false,
      requiresLogin: !user,
      isLocked: false,
      reason: null,
      message: null,
    };
  }

  // Test is PRO:
  if (!user) {
    return {
      accessType: 'PRO',
      isUserPro: false,
      canAttempt: false,
      requiresPro: true,
      requiresLogin: true,
      isLocked: true,
      reason: 'AUTH_REQUIRED',
      message: 'Please log in to access this Pro test',
    };
  }

  if (userIsPro) {
    return {
      accessType: 'PRO',
      isUserPro: true,
      canAttempt: true,
      requiresPro: false,
      requiresLogin: false,
      isLocked: false,
      reason: null,
      message: null,
    };
  }

  // Logged in as Free user attempting Pro test
  return {
    accessType: 'PRO',
    isUserPro: false,
    canAttempt: false,
    requiresPro: true,
    requiresLogin: false,
    isLocked: true,
    reason: 'PRO_REQUIRED',
    message: 'Pro Pass is required to access this test',
  };
};

/**
 * Generates badge items for a test card based on its entitlement and taxonomy.
 * 
 * @param {Object} params
 * @param {Object} params.test
 * @param {Object|null} [params.user]
 * @param {Object|null} [params.series]
 * @param {boolean} [params.isLive]
 * @param {boolean} [params.isUpcoming]
 * @param {boolean} [params.isQuiz]
 * @returns {Array<{ key: string, label: string, variant: string, icon?: string }>}
 */
export const getTestBadges = ({
  test,
  user,
  series = null,
  isLive = false,
  isUpcoming = false,
  isQuiz = false,
}) => {
  const badges = [];
  const entitlement = getTestEntitlement({ test, user, series });

  // 1. Live / Quiz / Scheduled Badge
  if (isLive) {
    badges.push({
      key: 'live',
      label: isQuiz ? 'LIVE QUIZ' : 'LIVE TEST',
      variant: 'live',
    });
  } else if (isUpcoming) {
    badges.push({
      key: 'scheduled',
      label: isQuiz ? 'SCHEDULED QUIZ' : 'SCHEDULED',
      variant: 'scheduled',
    });
  } else if (isQuiz) {
    badges.push({
      key: 'quiz',
      label: 'QUIZ',
      variant: 'quiz',
    });
  }

  // 2. Access Type Badge (FREE vs PRO)
  if (entitlement.accessType === 'FREE') {
    badges.push({
      key: 'access_free',
      label: 'FREE',
      variant: 'free',
    });
  } else {
    badges.push({
      key: 'access_pro',
      label: 'PRO',
      variant: 'pro',
      icon: 'crown',
    });
  }

  // 3. Must Attempt / Featured Badge
  if (test.isMustAttempt === true || test.is_must_attempt === true) {
    badges.push({
      key: 'must_attempt',
      label: 'MUST ATTEMPT',
      variant: 'featured',
    });
  }

  // 4. New Badge
  if (test.isNew === true || test.is_new === true) {
    badges.push({
      key: 'new',
      label: 'NEW',
      variant: 'new',
    });
  }

  return badges;
};

/**
 * Resolves the exact CTA state, button label, and destination URL for a test.
 * 
 * @param {Object} params
 * @param {Object} params.test
 * @param {Object|null} [params.user]
 * @param {Object|null} [params.series]
 * @param {boolean} [params.isLive]
 * @param {boolean} [params.isUpcoming]
 * @param {boolean} [params.isExpired]
 * @param {boolean} [params.isQuiz]
 * @param {boolean} [params.isRegistered]
 * @param {boolean} [params.isAttempted]
 * @param {string} [params.targetTestUrl]
 * @param {string} [params.targetAttemptUrl]
 * @param {string} [params.targetResultUrl]
 * @returns {{
 *   actionState: string,
 *   label: string,
 *   to: string,
 *   isLink: boolean,
 *   requiresPro: boolean,
 *   requiresLogin: boolean,
 *   isDisabled: boolean,
 *   variant: 'primary' | 'amber' | 'pro' | 'secondary' | 'disabled'
 * }}
 */
export const resolveTestCtaState = ({
  test,
  user,
  series = null,
  isLive = false,
  isUpcoming = false,
  isExpired = false,
  isQuiz = false,
  isRegistered = false,
  isAttempted = false,
  targetTestUrl = '',
  targetAttemptUrl = '',
  targetResultUrl = '',
}) => {
  const entitlement = getTestEntitlement({ test, user, series });

  // 1. Updating / Coming Soon
  if (test.isUpdating || (test.totalQuestions === 0 && !isLive && !isUpcoming)) {
    return {
      actionState: 'UPDATING',
      label: 'Updating Soon',
      to: '',
      isLink: false,
      requiresPro: false,
      requiresLogin: false,
      isDisabled: true,
      variant: 'disabled',
    };
  }

  // 2. Unauthenticated User Flow
  if (!user) {
    if (entitlement.accessType === 'PRO') {
      return {
        actionState: 'LOGIN_UNLOCK',
        label: '🔒 Login to Unlock',
        to: '/login',
        isLink: true,
        requiresPro: true,
        requiresLogin: true,
        isDisabled: false,
        variant: 'pro',
      };
    }
    return {
      actionState: 'LOGIN_START',
      label: 'Log In to Start',
      to: '/login',
      isLink: true,
      requiresPro: false,
      requiresLogin: true,
      isDisabled: false,
      variant: 'primary',
    };
  }

  // 3. Pro Pass Required for Free User
  if (entitlement.requiresPro) {
    return {
      actionState: 'UNLOCK_PRO',
      label: '👑 Get Pro Pass',
      to: '/pass',
      isLink: true,
      requiresPro: true,
      requiresLogin: false,
      isDisabled: false,
      variant: 'pro',
    };
  }

  // 4. Completed / Reattempt
  if (isAttempted && targetResultUrl) {
    return {
      actionState: 'RESULT',
      label: 'View Result',
      to: targetResultUrl,
      isLink: true,
      requiresPro: false,
      requiresLogin: false,
      isDisabled: false,
      variant: 'secondary',
    };
  }

  // 5. Expired Live Test / Result Available
  if (isExpired) {
    if (targetResultUrl) {
      return {
        actionState: 'RESULT',
        label: 'View Result',
        to: targetResultUrl,
        isLink: true,
        requiresPro: false,
        requiresLogin: false,
        isDisabled: false,
        variant: 'secondary',
      };
    }
    return {
      actionState: 'EXPIRED',
      label: 'Contest Ended',
      to: targetTestUrl,
      isLink: Boolean(targetTestUrl),
      requiresPro: false,
      requiresLogin: false,
      isDisabled: !targetTestUrl,
      variant: 'disabled',
    };
  }

  // 6. Scheduled / Upcoming Live Test
  if (isUpcoming) {
    if (isRegistered) {
      return {
        actionState: 'REGISTERED',
        label: '✓ Registered',
        to: '',
        isLink: false,
        requiresPro: false,
        requiresLogin: false,
        isDisabled: false,
        variant: 'secondary',
      };
    }
    return {
      actionState: 'REGISTER',
      label: 'Register Now',
      to: '',
      isLink: false,
      requiresPro: false,
      requiresLogin: false,
      isDisabled: false,
      variant: 'amber',
    };
  }

  // 7. Active Live Test
  if (isLive) {
    return {
      actionState: isQuiz ? 'ATTEMPT_QUIZ' : 'ATTEMPT_NOW',
      label: isQuiz ? '🎯 Start Quiz' : '🎯 Attempt Now',
      to: targetAttemptUrl || targetTestUrl,
      isLink: true,
      requiresPro: false,
      requiresLogin: false,
      isDisabled: false,
      variant: 'primary',
    };
  }

  // 8. Standard Available Test
  return {
    actionState: 'START',
    label: isQuiz ? 'Start Quiz' : 'Start Now',
    to: targetTestUrl,
    isLink: true,
    requiresPro: false,
    requiresLogin: false,
    isDisabled: false,
    variant: 'primary',
  };
};
