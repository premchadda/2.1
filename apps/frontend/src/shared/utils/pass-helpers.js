/**
 * Pass system feature matrix and helper functions
 */

export const PASS_TYPES = {
  FREE: 'free',
  TEST_SERIES: 'test_series',
  PRO_MONTHLY: 'pro_monthly',
  PRO_YEARLY: 'pro_yearly'
};

const FEATURE_MATRIX = {
  mock_tests: {
    [PASS_TYPES.FREE]: 'limited',
    [PASS_TYPES.TEST_SERIES]: 'full',
    [PASS_TYPES.PRO_MONTHLY]: 'full',
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  chapter_tests: {
    [PASS_TYPES.FREE]: 'limited',
    [PASS_TYPES.TEST_SERIES]: 'full',
    [PASS_TYPES.PRO_MONTHLY]: 'full',
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  pyq_papers: {
    [PASS_TYPES.FREE]: 'limited',
    [PASS_TYPES.TEST_SERIES]: 'full',
    [PASS_TYPES.PRO_MONTHLY]: 'full',
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  live_tests: {
    [PASS_TYPES.FREE]: false,
    [PASS_TYPES.TEST_SERIES]: false,
    [PASS_TYPES.PRO_MONTHLY]: 'full',
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  sectional_tests: {
    [PASS_TYPES.FREE]: false,
    [PASS_TYPES.TEST_SERIES]: false,
    [PASS_TYPES.PRO_MONTHLY]: 'full', 
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  pdf_downloads: {
    [PASS_TYPES.FREE]: false,
    [PASS_TYPES.TEST_SERIES]: false,
    [PASS_TYPES.PRO_MONTHLY]: 'full',
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  performance_analytics: {
    [PASS_TYPES.FREE]: false,
    [PASS_TYPES.TEST_SERIES]: 'full',
    [PASS_TYPES.PRO_MONTHLY]: 'full',
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  leaderboard: {
    [PASS_TYPES.FREE]: false,
    [PASS_TYPES.TEST_SERIES]: false,
    [PASS_TYPES.PRO_MONTHLY]: 'full',
    [PASS_TYPES.PRO_YEARLY]: 'full',
  },
  multiple_device: {
    [PASS_TYPES.FREE]: false,
    [PASS_TYPES.TEST_SERIES]: false,
    [PASS_TYPES.PRO_MONTHLY]: false,
    [PASS_TYPES.PRO_YEARLY]: 'full',
  }
};

/**
 * Check if a user has access to a specific feature based on their pass type
 * @param {string} feature - Feature name (from FEATURE_MATRIX keys)
 * @param {string} passType - User's current pass type
 * @returns {boolean|string} false if no access, 'limited' or 'full' otherwise
 */
export function checkFeatureAccess(feature, passType = 'free') {
  const normalizedPass = String(passType).toLowerCase();
  
  // Try to find a match for the pass type if it's not exactly what's in PASS_TYPES
  let mappedPass = PASS_TYPES.FREE;
  if (normalizedPass.includes('yearly') || normalizedPass.includes('pro_yearly')) {
    mappedPass = PASS_TYPES.PRO_YEARLY;
  } else if (normalizedPass.includes('monthly') || normalizedPass.includes('pro_monthly')) {
    mappedPass = PASS_TYPES.PRO_MONTHLY;
  } else if (normalizedPass.includes('test_series') || normalizedPass.includes('test series')) {
    mappedPass = PASS_TYPES.TEST_SERIES;
  } else if (normalizedPass.includes('pro')) {
    // Default pro to monthly if not specified/couldn't match yearly
    mappedPass = PASS_TYPES.PRO_MONTHLY;
  }

  const access = FEATURE_MATRIX[feature]?.[mappedPass];
  return access === undefined ? false : access;
}

/**
 * Filter an array of tests based on feature gating and pass type
 * @param {Array} tests - Array of test objects
 * @param {string} passType - User's current pass type
 * @returns {Array} List of tests with accessibility info
 */
export function gateTests(tests, passType = 'free') {
  return tests.map(test => {
    const featureKey = test.type === 'Live' ? 'live_tests' : 
                      test.type === 'Chapter' ? 'chapter_tests' : 
                      test.type === 'PYQ' ? 'pyq_papers' : 'mock_tests';
    
    const access = checkFeatureAccess(featureKey, passType);
    
    // If it's free/limited access, check if the test itself is marked as free
    const isActuallyFree = test.isFree || test.type === 'Free' || !test.isPro;
    
    return {
      ...test,
      isAccessible: !!access || isActuallyFree,
      accessLevel: access,
      isLocked: !access && !isActuallyFree
    };
  });
}
