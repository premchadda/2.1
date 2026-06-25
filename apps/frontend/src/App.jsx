import { Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Layout Components (kept eager — used on nearly every route)
import Layout from './shared/components/layout/Layout'
import ScrollToTop from './shared/components/common/ScrollToTop'
import ProtectedRoute from './shared/components/auth/ProtectedRoute'
import ErrorBoundary from './shared/components/common/ErrorBoundary'
import MaintenanceMode from './shared/components/common/MaintenanceMode'

// PERF-03: Route-level code splitting via React.lazy.
// Reduces initial JS bundle by 30-50% — each page is loaded on demand.

// Page loading skeleton
const PageSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-brand-start/20 border-brand-start rounded-full animate-spin"></div>
        <div className="absolute inset-2 w-16 h-16 border-4 border-brand-end/30 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
      </div>
      <p className="text-gray-600 font-medium mt-6 animate-pulse">Loading...</p>
    </div>
  </div>
)

// --- Public Pages (lazy) ---
const Home = lazy(() => import('./pages/public/Home'))
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
const Login = lazy(() => import('./features/auth/Login'))
const Signup = lazy(() => import('./features/auth/Signup'))

// --- Dashboard Pages (lazy) ---
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
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
const ExamsNew = lazy(() => import('./pages/exams/ExamsNew'))
const ExamDetails = lazy(() => import('./pages/exams/ExamDetails'))
const ExamInfoNew = lazy(() => import('./pages/exams/ExamInfoNew'))
const ExamCategory = lazy(() => import('./pages/exams/ExamCategory'))
const ExamYear = lazy(() => import('./pages/exams/ExamYear'))
const ExamCompare = lazy(() => import('./pages/exams/ExamCompare'))
const ExamUpdates = lazy(() => import('./pages/exams/ExamUpdates'))
const ExamMasterPage = lazy(() => import('./pages/exams/ExamMasterPage'))

// --- Test Pages (lazy) ---
const TestSeries = lazy(() => import('./pages/tests/TestSeries'))
const MockTests = lazy(() => import('./pages/tests/MockTests'))
const TestDetails = lazy(() => import('./pages/tests/TestDetails'))
const TestInterface = lazy(() => import('./pages/tests/TestInterface'))
const TestResult = lazy(() => import('./pages/tests/TestResult'))
const TestReview = lazy(() => import('./pages/tests/TestReview'))
const TestInstructions = lazy(() => import('./pages/tests/TestInstructions'))
const SeriesLeaderboard = lazy(() => import('./pages/tests/SeriesLeaderboard'))
const LiveTests = lazy(() => import('./pages/tests/LiveTests'))
const PracticeQuestions = lazy(() => import('./pages/tests/PracticeQuestions'))
const PreviousYearPapers = lazy(() => import('./pages/tests/PreviousYearPapers'))
const Leaderboard = lazy(() => import('./pages/tests/Leaderboard'))
const PYPTest = lazy(() => import('./pages/tests/PYPTest'))
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

// --- Community Pages (lazy) ---
const Community = lazy(() => import('./pages/community/Community'))

// --- Error Pages (lazy) ---
const NotFound = lazy(() => import('./pages/errors/NotFound'))
const ServerError = lazy(() => import('./pages/errors/ServerError'))

// Admin Panel URL (change this in production)
const ADMIN_PANEL_URL = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3002'

// Component to handle cross-origin redirect to admin panel
function AdminPanelRedirect() {
  useEffect(() => {
    window.location.href = ADMIN_PANEL_URL
  }, [])
  return null
}

function App() {
  const location = useLocation()
  const background = location.state?.backgroundLocation

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
      <ErrorBoundary>
      <MaintenanceMode>
      <ScrollToTop />
      <Suspense fallback={<PageSkeleton />}>
      <Routes location={background || location}>
        {/* Auth popup renders over Home via Layout outlet */}
        <Route element={<Layout />}>
          <Route path="/login" element={<><Home /><Login /></>} />
          <Route path="/signup" element={<><Home /><Signup /></>} />
        </Route>

        <Route path="/verify-email" element={<EmailVerification />} />

        {/* Test Interface (Full Screen, No Layout) */}
        <Route path="/test/:seriesId/:testId/instructions" element={
          <ProtectedRoute>
            <TestInstructions />
          </ProtectedRoute>
        } />
        <Route path="/test/:seriesId/:testId" element={
          <ProtectedRoute>
            <TestInterface />
          </ProtectedRoute>
        } />
        <Route path="/test-result/:seriesId/:testId" element={
          <ProtectedRoute>
            <TestResult />
          </ProtectedRoute>
        } />
        <Route path="/test-review/:seriesId/:testId" element={
          <ProtectedRoute>
            <TestReview />
          </ProtectedRoute>
        } />

        {/* Main Layout Routes */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/ai-planner" element={
            <ProtectedRoute>
              <AIStudyPlanner />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/insights" element={
            <ProtectedRoute>
              <PerformanceInsights />
            </ProtectedRoute>
          } />
          <Route path="/test-series" element={<TestSeries />} />
          <Route path="/test-series/:seriesId" element={<TestDetails />} />
          <Route path="/test-series/:id/leaderboard" element={<SeriesLeaderboard />} />
          <Route path="/study" element={<StudyMaterial />} />
          <Route path="/study/:subjectId" element={<StudyMaterialDetail />} />
          <Route path="/study/:subjectId/:chapterId" element={<StudyMaterialChapter />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams-old" element={<ExamsNew />} />
          <Route path="/exams/category/:categoryId" element={<ExamCategory />} />
          <Route path="/exams/category/:categoryId/exam/:examId" element={<ExamInfoNew />} />
          <Route path="/exams/category/:categoryId/exam/:examId/year/:year" element={<ExamYear />} />
          <Route path="/exam/:examId" element={<ExamInfoNew />} />
          <Route path="/exam-old/:examId" element={<ExamInfoNew />} />
          <Route path="/exam/:examId/updates" element={<ExamUpdates />} />
          <Route path="/exam/:examId/year/:year" element={<ExamYear />} />
          <Route path="/exam/:examId/compare" element={<ExamCompare />} />
          <Route path="/tag/:tag" element={<TagPage />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/videos/:id" element={<VideoDetail />} />
          <Route path="/analysis" element={
            <ProtectedRoute>
              <Analysis />
            </ProtectedRoute>
          } />
          <Route path="/attempted-tests" element={
            <ProtectedRoute>
              <AttemptedTests />
            </ProtectedRoute>
          } />
          <Route path="/pass" element={<Pass />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />

          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/live-tests" element={<TagPage tagProp="live-tests" />} />
          <Route path="/live-tests/:liveTestId" element={
            <ProtectedRoute>
              <LiveTestInterface />
            </ProtectedRoute>
          } />
          <Route path="/live-test-results/:liveTestId" element={
            <ProtectedRoute>
              <LiveTestResults />
            </ProtectedRoute>
          } />
          <Route path="/live-tests/:liveTestId/leaderboard" element={
            <ProtectedRoute>
              <LiveTestLeaderboard />
            </ProtectedRoute>
          } />
          <Route path="/live-tests/:liveTestId/review" element={
            <ProtectedRoute>
              <LiveTestReview />
            </ProtectedRoute>
          } />
          <Route path="/current-affairs" element={<CurrentAffairs />} />
          <Route path="/current-affairs/:caId" element={<CurrentAffairsDetail />} />
          <Route path="/previous-year-papers" element={<PreviousYearPapers />} />
          <Route path="/pyps" element={<TagPage tagProp="pyps" />} />
          <Route path="/pyp/:pypId/test" element={
            <ProtectedRoute>
              <PYPTest />
            </ProtectedRoute>
          } />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/refer-and-earn" element={<ReferAndEarn />} />
          <Route path="/practice" element={<TagPage tagProp="practice" />} />
          <Route path="/quizzes" element={<TagPage tagProp="quizzes" />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogDetail />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/groups/:id" element={<Community />} />
          <Route path="/notifications" element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          } />
          <Route path="/bookmarks" element={
            <ProtectedRoute>
              <Bookmarks />
            </ProtectedRoute>
          } />
          <Route path="/achievements" element={
            <ProtectedRoute>
              <Achievements />
            </ProtectedRoute>
          } />
          <Route path="/error-500" element={<ServerError />} />
        </Route>

        {/* Admin Panel Redirect - Now hosted separately */}
        <Route path="/admin/*" element={<AdminPanelRedirect />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Render auth modals as overlays when navigating via state */}
      {background && (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      )}
      </Suspense>
      </MaintenanceMode>
    </ErrorBoundary>
    </GoogleOAuthProvider>
  )
}

export default App
