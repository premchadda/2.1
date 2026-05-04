// Add these routes to your App.jsx or routing configuration
// This file shows the new routes to add for all the new features

const newRoutes = [
  // ===== PREVIOUS YEAR PAPERS =====
  {
    path: '/pyp',
    element: lazy(() => import('./pages/exams/PreviousYearPapers')),
    name: 'PreviousYearPapers'
  },
  {
    path: '/pyp/:id',
    element: lazy(() => import('./pages/exams/PYPTest')),
    name: 'PYPTest'
  },

  // ===== CURRENT AFFAIRS =====
  {
    path: '/current-affairs',
    element: lazy(() => import('./pages/public/CurrentAffairs')),
    name: 'CurrentAffairs'
  },
  {
    path: '/current-affairs/:id',
    element: lazy(() => import('./pages/public/CurrentAffairsDetail')),
    name: 'CurrentAffairsDetail'
  },

  // ===== LIVE TESTS =====
  {
    path: '/live-tests',
    element: lazy(() => import('./pages/public/LiveTests')),
    name: 'LiveTests'
  },
  {
    path: '/live-test/:id',
    element: lazy(() => import('./pages/public/LiveTestInterface')),
    name: 'LiveTestInterface',
    protected: true
  },
  {
    path: '/live-test/:id/results',
    element: lazy(() => import('./pages/public/LiveTestResults')),
    name: 'LiveTestResults',
    protected: true
  },

  // ===== PRACTICE QUESTIONS =====
  {
    path: '/practice',
    element: lazy(() => import('./pages/public/PracticeQuestions')),
    name: 'PracticeQuestions'
  },

  // ===== BOOKMARKS =====
  {
    path: '/bookmarks',
    element: lazy(() => import('./pages/MyBookmarks')),
    name: 'Bookmarks',
    protected: true
  },

  // ===== ADMIN ROUTES =====
  {
    path: '/admin/pyp',
    element: lazy(() => import('./features/admin/PYPManager')),
    name: 'PYPManager',
    protected: true,
    adminOnly: true
  },
  {
    path: '/admin/current-affairs',
    element: lazy(() => import('./features/admin/CurrentAffairsManager')),
    name: 'CurrentAffairsManager',
    protected: true,
    adminOnly: true
  },
  {
    path: '/admin/live-tests',
    element: lazy(() => import('./features/admin/LiveTestsManager')),
    name: 'LiveTestsManager',
    protected: true,
    adminOnly: true
  },
  {
    path: '/admin/practice',
    element: lazy(() => import('./features/admin/PracticeQuestionsManager')),
    name: 'PracticeQuestionsManager',
    protected: true,
    adminOnly: true
  }
]

/*
 * NAVIGATION UPDATES
 * Add to main Navbar:
 * 
 * <NavLink to="/pyp">Previous Year Papers</NavLink>
 * <NavLink to="/current-affairs">Current Affairs</NavLink>
 * <NavLink to="/live-tests">Live Tests</NavLink>
 * <NavLink to="/practice">Practice Questions</NavLink>
 * <NavLink to="/bookmarks">My Bookmarks</NavLink>
 * 
 * Add to Admin Dashboard:
 * <NavLink to="/admin/pyp">PYP Management</NavLink>
 * <NavLink to="/admin/current-affairs">Current Affairs</NavLink>
 * <NavLink to="/admin/live-tests">Live Tests</NavLink>
 * <NavLink to="/admin/practice">Practice Questions</NavLink>
 */

/*
 * ENVIRONMENT VARIABLES TO ADD
 * 
 * VITE_ENABLE_I18N=true
 * VITE_LANGUAGES=en,hi
 * VITE_DEFAULT_LANGUAGE=en
 * 
 * For Phone Auth:
 * VITE_TWILIO_ACCOUNT_SID=your_account_sid
 * VITE_TWILIO_AUTH_TOKEN=your_auth_token
 * VITE_TWILIO_PHONE=+1234567890
 * 
 * Or Firebase:
 * VITE_FIREBASE_API_KEY=your_api_key
 * VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
 */

export default newRoutes
