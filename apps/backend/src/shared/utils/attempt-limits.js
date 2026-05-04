/**
 * Logic for checking attempt limits based on user pass type
 */

const PASS_TYPES = {
  FREE: 'free',
  TEST_SERIES: 'test_series',
  PRO_MONTHLY: 'pro_monthly',
  PRO_YEARLY: 'pro_yearly',
  PRO: 'pro'
};

const LIMITS = {
  [PASS_TYPES.FREE]: {
    total_attempts: 3,
    mock_tests: 'limited',
    chapter_tests: 'limited',
    pyq_papers: 'limited',
    live_tests: false
  },
  [PASS_TYPES.TEST_SERIES]: {
    total_attempts: 'unlimited',
    mock_tests: 'unlimited',
    chapter_tests: 'unlimited',
    pyq_papers: 'unlimited',
    live_tests: false
  }
};

/**
 * Check if a user has exceeded their attempt limit
 * @param {Object} user - User object from DB
 * @param {Array} attempts - List of user's attempts
 * @param {Object} test - Test object 
 * @returns {Object} { hasReached: boolean, message: string }
 */
export function checkAttemptLimit(user, attempts, test) {
  const passType = String(user.pass_type || 'free').toLowerCase();
  const isAdmin = user.role === 'admin';
  const isPro = passType.includes('pro') || passType.includes('yearly') || passType.includes('monthly');
  
  // Admins and Pro users have no limits on standard tests
  if (isAdmin || isPro) return { hasReached: false };
  
  const testType = String(test.type || '').toLowerCase();
  const isLiveTest = test.isLive || testType === 'live' || test.tags?.some(t => String(t).toLowerCase() === 'live');
  
  // 1. Live Tests are restricted to Pro users only
  if (isLiveTest) {
    return {
      hasReached: true,
      message: 'Live Tests are only available for Pro Monthly and Pro Yearly subscribers. Please upgrade to access.'
    };
  }
  
  const limits = LIMITS[passType] || LIMITS[PASS_TYPES.FREE];
  
  // 2. Check total completed attempts cap for free users
  if (passType === 'free') {
    const completedAttempts = attempts.filter(a => {
      const statusStr = String(a.status || '').toLowerCase();
      return a.isCompleted === true || 
             a.is_completed === true || 
             statusStr === 'completed' || 
             statusStr === 'submitted' ||
             statusStr === 'finish' ||
             statusStr === 'finished';
    });
    
    if (completedAttempts.length >= 3) {
      return { 
        hasReached: true, 
        message: 'You have reached the free limit of 3 test attempts. Upgrade to a Test Series or Pro Pass for unlimited access.'
      };
    }
  }
  
  return { hasReached: false };
}
