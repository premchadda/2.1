import { Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom'
import React, { Suspense, useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'

import { lazyWithRetry as lazy } from './shared/utils/lazyWithRetry'

// Layout Components (kept eager — used on nearly every route)
import Layout from './shared/components/layout/Layout'
import ScrollToTop from './shared/components/common/ScrollToTop'
import ProtectedRoute from './shared/components/auth/ProtectedRoute'
import ErrorBoundary from './shared/components/common/ErrorBoundary'
import MaintenanceMode from './shared/components/common/MaintenanceMode'
import FeatureGate from './shared/components/common/FeatureGate'

// PERF-03: Route-level code splitting via React.lazy with automatic retries.
// Reduces initial JS bundle by 30-50% — each page is loaded on demand.

// Page loading skeleton
const PageSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3 will-change-transform"></div>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Loading...</p>
    </div>
  </div>
)

const LegacyPypsExamRedirect = () => {
  const { examSlug } = useParams()
  const location = useLocation()
  return <Navigate to={`/pyps/${examSlug}${location.search || ''}`} replace />
}

// --- Core Entry Pages (eagerly imported for instant 0ms initial render) ---
import Home from './pages/public/Home'
import Dashboard from './pages/dashboard/Dashboard'
import Login from './features/auth/Login'

// --- Public Pages (lazy) ---
const About = lazy(() => import('./pages/public/About'))
const Contact = lazy(() => import('./pages/public/Contact'))
const Terms = lazy(() => import('./pages/public/Terms'))
const Privacy = lazy(() => import('./pages/public/Privacy'))
const Refund = lazy(() => import('./pages/public/Refund'))
const Faq = lazy(() => import('./pages/public/Faq'))
const Pass = lazy(() => import('./pages/public/Pass'))
const SearchPage = lazy(() => import('./pages/public/SearchPage'))
const Blog = lazy(() => import('./pages/public/Blog'))
const BlogDetail = lazy(() => import('./pages/public/BlogDetail'))
const TagPage = lazy(() => import('./pages/public/TagPage'))
const CurrentAffairsDetail = lazy(() => import('./pages/public/CurrentAffairsDetail'))

// --- Auth Pages (lazy) ---
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const EmailVerification = lazy(() => import('./pages/auth/EmailVerification'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const Signup = lazy(() => import('./features/auth/Signup'))

// --- Dashboard Pages (lazy) ---
const Profile = lazy(() => import('./pages/dashboard/Profile'))
const Analysis = lazy(() => import('./pages/dashboard/Analysis'))
const Bookmarks = lazy(() => import('./pages/dashboard/Bookmarks'))
const AttemptedTests = lazy(() => import('./pages/dashboard/AttemptedTests'))
const Notifications = lazy(() => import('./pages/dashboard/Notifications'))
const Achievements = lazy(() => import('./pages/dashboard/Achievements'))
const ReferAndEarn = lazy(() => import('./pages/dashboard/ReferAndEarn'))
const Settings = lazy(() => import('./pages/dashboard/Settings'))
const AIStudyPlanner = lazy(() => import('./pages/dashboard/AIStudyPlanner'))
const PerformanceInsights = lazy(() => import('./pages/dashboard/PerformanceInsights'))

// --- Exam Pages (lazy) ---
const Exams = lazy(() => import('./pages/exams/Exams'))
const ExamInfoNew = lazy(() => import('./pages/exams/ExamInfoNew'))
const ExamCategory = lazy(() => import('./pages/exams/ExamCategory'))
const ExamYear = lazy(() => import('./pages/exams/ExamYear'))
const ExamCompare = lazy(() => import('./pages/exams/ExamCompare'))
const ExamUpdates = lazy(() => import('./pages/exams/ExamUpdates'))


// --- Test Pages (lazy) ---
const TestSeries = lazy(() => import('./pages/tests/TestSeries'))
const TestDetails = lazy(() => import('./pages/tests/TestDetails'))
const TestInterface = lazy(() => import('./pages/tests/TestInterface'))
const TestResult = lazy(() => import('./pages/tests/TestResult'))
const TestReview = lazy(() => import('./pages/tests/TestReview'))
const TestInstructions = lazy(() => import('./pages/tests/TestInstructions'))
const SeriesLeaderboard = lazy(() => import('./pages/tests/SeriesLeaderboard'))
const LiveTests = lazy(() => import('./pages/tests/LiveTests'))
const PracticeLab = lazy(() => import('./pages/tests/PracticeLab'))
const PreviousYearPapers = lazy(() => import('./pages/tests/PreviousYearPapers'))
const Leaderboard = lazy(() => import('./pages/tests/Leaderboard'))
const PYPTest = lazy(() => import('./pages/tests/PYPTest'))
const PypsLanding = lazy(() => import('./pages/pyps/PypsLanding'))
const LiveTestInterface = lazy(() => import('./pages/tests/LiveTestInterface'))
const LiveTestResults = lazy(() => import('./pages/tests/LiveTestResults'))
const LiveTestLeaderboard = lazy(() => import('./pages/tests/LiveTestLeaderboard'))
const LiveTestReview = lazy(() => import('./pages/tests/LiveTestReview'))

// --- Study Pages (lazy) ---
const StudyMaterial = lazy(() => import('./pages/study/StudyMaterial'))
const StudyMaterialDetail = lazy(() => import('./pages/study/StudyMaterialDetail'))
const StudyMaterialChapter = lazy(() => import('./pages/study/StudyMaterialChapter'))
const Videos = lazy(() => import('./pages/study/Videos'))
const VideoDetail = lazy(() => import('./pages/study/VideoDetail'))
const CurrentAffairs = lazy(() => import('./pages/study/CurrentAffairs'))
const SpacedRepetition = lazy(() => import('./pages/study/SpacedRepetition'))

// --- Community Pages (lazy) ---
const Community = lazy(() => import('./pages/community/Community'))

// --- Error Pages (lazy) ---
const NotFound = lazy(() => import('./pages/errors/NotFound'))
const ServerError = lazy(() => import('./pages/errors/ServerError'))

function LegacyExamRedirect() {
  const { examId } = useParams()
  return <Navigate to={`/exam/${examId}`} replace />
}

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('RouteErrorBoundary caught:', error, info)
  }
  handleRetry = () => {
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
      this.state.error?.message || ''
    )
    if (isChunkError) {
      window.location.reload()
    } else {
      this.setState({ hasError: false, error: null, info: null })
    }
  }
  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV
      const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
        this.state.error?.message || ''
      )
      return (
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="text-center max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {isChunkError ? 'Unable to load page' : 'Something went wrong'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isChunkError
                ? 'A new version or update is available, or connection was temporarily interrupted. Please reload the page.'
                : 'This page encountered an error. Try refreshing.'}
            </p>
            {isDev && this.state.error && (
              <pre className="text-left text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap">
                {this.state.error.stack || this.state.error.message || String(this.state.error)}
                {this.state.info?.componentStack ? '\n\n' + this.state.info.componentStack : ''}
              </pre>
            )}
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
              >
                Reload Page
              </button>
              {!isChunkError && (
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ConditionalGoogleProvider({ children }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) return <>{children}</>
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
}

function App() {
  const location = useLocation()
  const background = ['/login', '/signup'].includes(location.pathname) ? location.state?.backgroundLocation : null

  return (
    <ConditionalGoogleProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none font-medium"
      >
        Skip to main content
      </a>
      <ErrorBoundary>
      <MaintenanceMode>
      <ScrollToTop />
      <Suspense fallback={<PageSkeleton />}>
      <Routes location={background || location}>
        <Route path="/verify-email" element={<RouteErrorBoundary><EmailVerification /></RouteErrorBoundary>} />

        {/* Test Interface & Instructions (Testbook URL Structure: /:seriesSlug/tests/:testId/instructions) */}
        <Route path="/:seriesSlug/tests/:testId/instructions" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestInstructions />
          </ProtectedRoute></RouteErrorBoundary>
        } />
        <Route path="/:seriesSlug/tests/:testId/result" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestResult />
          </ProtectedRoute></RouteErrorBoundary>
        } />
        <Route path="/:seriesSlug/tests/:testId/review" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestInterface />
          </ProtectedRoute></RouteErrorBoundary>
        } />
        <Route path="/:seriesSlug/tests/:testId" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestInterface />
          </ProtectedRoute></RouteErrorBoundary>
        } />

        {/* Legacy Test Interface Routes (Backwards Compatibility) */}
        <Route path="/test/:seriesId/:testId/instructions" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestInstructions />
          </ProtectedRoute></RouteErrorBoundary>
        } />
        <Route path="/test/:seriesId/:testId" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestInterface />
          </ProtectedRoute></RouteErrorBoundary>
        } />
        <Route path="/test-result/:seriesId/:testId" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestResult />
          </ProtectedRoute></RouteErrorBoundary>
        } />
        <Route path="/test-review/:seriesId/:testId" element={
          <RouteErrorBoundary><ProtectedRoute>
            <TestInterface />
          </ProtectedRoute></RouteErrorBoundary>
        } />

        {/* Main Layout Routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<RouteErrorBoundary><Home /></RouteErrorBoundary>} />
          <Route path="/login" element={<RouteErrorBoundary><Home /><Login /></RouteErrorBoundary>} />
          <Route path="/signup" element={<RouteErrorBoundary><Home /><Signup /></RouteErrorBoundary>} />
          <Route path="/dashboard" element={
            <RouteErrorBoundary><ProtectedRoute>
              <Dashboard />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/dashboard/ai-planner" element={
            <RouteErrorBoundary><ProtectedRoute>
              <AIStudyPlanner />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/ai-tutor" element={
            <RouteErrorBoundary><ProtectedRoute>
              <AIStudyPlanner />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/dashboard/insights" element={
            <RouteErrorBoundary><ProtectedRoute>
              <PerformanceInsights />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/dashboard/rankings" element={
            <RouteErrorBoundary><ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/test-series" element={<RouteErrorBoundary><TestSeries /></RouteErrorBoundary>} />
          <Route path="/tests" element={<RouteErrorBoundary><TestSeries /></RouteErrorBoundary>} />
          <Route path="/live-tests" element={<RouteErrorBoundary><LiveTests /></RouteErrorBoundary>} />
          <Route path="/live" element={<RouteErrorBoundary><Navigate to="/live-tests" replace /></RouteErrorBoundary>} />
          <Route path="/pricing" element={<RouteErrorBoundary><Navigate to="/pass" replace /></RouteErrorBoundary>} />
          <Route path="/results" element={<RouteErrorBoundary><Navigate to="/attempted-tests" replace /></RouteErrorBoundary>} />
          <Route path="/test-series/:seriesId" element={<RouteErrorBoundary><TestDetails /></RouteErrorBoundary>} />
          <Route path="/test-series/:seriesId/my" element={<RouteErrorBoundary><TestDetails /></RouteErrorBoundary>} />
          <Route path="/:examSlug/test-series/my" element={<RouteErrorBoundary><TestDetails /></RouteErrorBoundary>} />
          <Route path="/:examSlug/test-series/:seriesId" element={<RouteErrorBoundary><TestDetails /></RouteErrorBoundary>} />
          <Route path="/test-series/:id/leaderboard" element={<RouteErrorBoundary><SeriesLeaderboard /></RouteErrorBoundary>} />
          <Route path="/study" element={<RouteErrorBoundary><StudyMaterial /></RouteErrorBoundary>} />
          <Route path="/study/:subjectId" element={<RouteErrorBoundary><StudyMaterialDetail /></RouteErrorBoundary>} />
          <Route path="/study/:subjectId/:chapterId" element={<RouteErrorBoundary><StudyMaterialChapter /></RouteErrorBoundary>} />
          <Route path="/exams" element={<RouteErrorBoundary><Exams /></RouteErrorBoundary>} />
          <Route path="/exams-old" element={<RouteErrorBoundary><Navigate to="/exams" replace /></RouteErrorBoundary>} />
          <Route path="/exams/category/:categoryId" element={<RouteErrorBoundary><ExamCategory /></RouteErrorBoundary>} />
          <Route path="/exams/category/:categoryId/exam/:examId" element={<RouteErrorBoundary><ExamInfoNew /></RouteErrorBoundary>} />
          <Route path="/exams/category/:categoryId/exam/:examId/year/:year" element={<RouteErrorBoundary><ExamYear /></RouteErrorBoundary>} />
          <Route path="/exam/:examId" element={<RouteErrorBoundary><ExamInfoNew /></RouteErrorBoundary>} />
          <Route path="/exam-old/:examId" element={<RouteErrorBoundary><LegacyExamRedirect /></RouteErrorBoundary>} />
          <Route path="/exam/:examId/updates" element={<RouteErrorBoundary><ExamUpdates /></RouteErrorBoundary>} />
          <Route path="/exam/:examId/year/:year" element={<RouteErrorBoundary><ExamYear /></RouteErrorBoundary>} />
          <Route path="/exam/:examId/compare" element={<RouteErrorBoundary><ExamCompare /></RouteErrorBoundary>} />
          <Route path="/tag/:tag" element={<RouteErrorBoundary><TagPage /></RouteErrorBoundary>} />
          <Route path="/videos" element={<RouteErrorBoundary><FeatureGate pageKey="videos"><Videos /></FeatureGate></RouteErrorBoundary>} />
          <Route path="/videos/:subjectSlug/:chapterSlug/:videoId" element={<RouteErrorBoundary><VideoDetail /></RouteErrorBoundary>} />
          <Route path="/videos/:id" element={<RouteErrorBoundary><VideoDetail /></RouteErrorBoundary>} />
          <Route path="/analysis" element={
            <RouteErrorBoundary><ProtectedRoute>
              <Analysis />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/attempted-tests" element={
            <RouteErrorBoundary><ProtectedRoute>
              <AttemptedTests />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/pass" element={<RouteErrorBoundary><Pass /></RouteErrorBoundary>} />
          <Route path="/profile" element={
            <RouteErrorBoundary><ProtectedRoute>
              <Profile />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/settings" element={
            <RouteErrorBoundary><ProtectedRoute>
              <Settings />
            </ProtectedRoute></RouteErrorBoundary>
          } />

          <Route path="/about" element={<RouteErrorBoundary><About /></RouteErrorBoundary>} />
          <Route path="/contact" element={<RouteErrorBoundary><Contact /></RouteErrorBoundary>} />
          <Route path="/terms" element={<RouteErrorBoundary><Terms /></RouteErrorBoundary>} />
          <Route path="/privacy" element={<RouteErrorBoundary><Privacy /></RouteErrorBoundary>} />
          <Route path="/refund" element={<RouteErrorBoundary><Refund /></RouteErrorBoundary>} />
          <Route path="/faq" element={<RouteErrorBoundary><Faq /></RouteErrorBoundary>} />
          <Route path="/search" element={<RouteErrorBoundary><SearchPage /></RouteErrorBoundary>} />
          <Route path="/forgot-password" element={<RouteErrorBoundary><ForgotPassword /></RouteErrorBoundary>} />
          <Route path="/reset-password" element={<RouteErrorBoundary><ResetPassword /></RouteErrorBoundary>} />
          <Route path="/live-test-results/:liveTestId" element={
            <RouteErrorBoundary><ProtectedRoute>
              <LiveTestResults />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/live-tests/:liveTestId/leaderboard" element={
            <RouteErrorBoundary><ProtectedRoute>
              <LiveTestLeaderboard />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/live-tests/:liveTestId" element={
            <RouteErrorBoundary><ProtectedRoute>
              <LiveTestInterface />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/live-tests/:liveTestId/review" element={
            <RouteErrorBoundary><ProtectedRoute>
              <LiveTestReview />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/spaced-repetition" element={<RouteErrorBoundary><ProtectedRoute><SpacedRepetition /></ProtectedRoute></RouteErrorBoundary>} />
          <Route path="/current-affairs" element={<RouteErrorBoundary><FeatureGate pageKey="currentAffairs"><CurrentAffairs /></FeatureGate></RouteErrorBoundary>} />
          <Route path="/current-affairs/:caId" element={<RouteErrorBoundary><CurrentAffairsDetail /></RouteErrorBoundary>} />
          <Route path="/previous-year-papers" element={<RouteErrorBoundary><PreviousYearPapers /></RouteErrorBoundary>} />
          <Route path="/pyps" element={<RouteErrorBoundary><PypsLanding /></RouteErrorBoundary>} />
          <Route path="/pyps/:examCategory/:examSlug" element={<RouteErrorBoundary><LegacyPypsExamRedirect /></RouteErrorBoundary>} />
          <Route path="/pyps/:examCategory" element={<RouteErrorBoundary><PypsLanding /></RouteErrorBoundary>} />
          <Route path="/tag/pyps" element={<RouteErrorBoundary><PypsLanding /></RouteErrorBoundary>} />
          <Route path="/tag/pyq" element={<RouteErrorBoundary><PypsLanding /></RouteErrorBoundary>} />
          <Route path="/tag/previous-year-papers" element={<RouteErrorBoundary><PypsLanding /></RouteErrorBoundary>} />
          <Route path="/pyp/:pypId/test" element={
            <RouteErrorBoundary><ProtectedRoute>
              <PYPTest />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/leaderboard" element={<RouteErrorBoundary><Leaderboard /></RouteErrorBoundary>} />
          <Route path="/refer-and-earn" element={<RouteErrorBoundary><FeatureGate pageKey="referAndEarn"><ReferAndEarn /></FeatureGate></RouteErrorBoundary>} />
          <Route path="/practice" element={<RouteErrorBoundary><ProtectedRoute><PracticeLab /></ProtectedRoute></RouteErrorBoundary>} />
          <Route path="/quizzes" element={<RouteErrorBoundary><TagPage tagProp="quizzes" /></RouteErrorBoundary>} />
          <Route path="/blog" element={<RouteErrorBoundary><Blog /></RouteErrorBoundary>} />
          <Route path="/blog/:id" element={<RouteErrorBoundary><BlogDetail /></RouteErrorBoundary>} />
          <Route path="/community" element={<RouteErrorBoundary><FeatureGate pageKey="doubtForum"><Community /></FeatureGate></RouteErrorBoundary>} />
          <Route path="/community/groups/:id" element={<RouteErrorBoundary><FeatureGate pageKey="studyGroups"><Community /></FeatureGate></RouteErrorBoundary>} />
          <Route path="/notifications" element={
            <RouteErrorBoundary><ProtectedRoute>
              <Notifications />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/bookmarks" element={
            <RouteErrorBoundary><ProtectedRoute>
              <Bookmarks />
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/achievements" element={
            <RouteErrorBoundary><ProtectedRoute>
              <FeatureGate pageKey="achievements"><Achievements /></FeatureGate>
            </ProtectedRoute></RouteErrorBoundary>
          } />
          <Route path="/error-500" element={<RouteErrorBoundary><ServerError /></RouteErrorBoundary>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<RouteErrorBoundary><NotFound /></RouteErrorBoundary>} />
      </Routes>

      {/* Render auth popup modal over background page when navigating with state */}
      {background && (
        <Routes>
          <Route path="/login" element={<RouteErrorBoundary><Login /></RouteErrorBoundary>} />
          <Route path="/signup" element={<RouteErrorBoundary><Signup /></RouteErrorBoundary>} />
        </Routes>
      )}
      </Suspense>
      </MaintenanceMode>
    </ErrorBoundary>
    </ConditionalGoogleProvider>
  )
}

export default App
