// Main Pages Export - Re-exports from all page categories
// This allows importing from '@/pages' or './pages' directly

// Public Pages
export {
  About,
  Blog,
  BlogDetail,
  ComingSoon,
  Contact,
  Faq,
  Home,
  Pass,
  Privacy,
  Refund,
  SearchPage,
  TagPage,
  Terms,
  CurrentAffairsDetail
} from './public'

// Auth Pages
export {
  ForgotPassword,
  EmailVerification,
  ResetPassword
} from './auth'

// Dashboard Pages
export {
  Dashboard,
  Profile,
  Settings,
  Analysis,
  Bookmarks,
  AttemptedTests,
  Notifications,
  Achievements,
  ReferAndEarn
} from './dashboard'

// Exam Pages
export {
  Exams,
  ExamsNew,
  ExamDetails,
  ExamInfoNew,
  ExamCategory,
  ExamYear,
  ExamCompare,
  ExamUpdates,
} from './exams'

// Test Pages
export {
  TestSeries,
  TestDetails,
  TestInstructions,
  TestInterface,
  TestResult,
  TestReview,
  LiveTests,
  LiveTestInterface,
  LiveTestResults,
  PreviousYearPapers,
  Leaderboard,
  SeriesLeaderboard,
  PYPTest
} from './tests'

// Study Pages
export {
  StudyMaterial,
  StudyMaterialDetail,
  StudyMaterialChapter,
  Videos,
  CurrentAffairs
} from './study'

// Community Pages
export {
  Community
} from './community'

// Error Pages
export {
  NotFound,
  ServerError
} from './errors'