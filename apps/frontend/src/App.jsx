import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Layout Components
import Layout from './shared/components/layout/Layout'

// Public Pages
import {
  Home,
  About,
  Contact,
  Terms,
  Privacy,
  Refund,
  Faq,
  Pass,
  SearchPage,
  Blog,
  BlogDetail,
  TagPage,
  CurrentAffairsDetail
} from './pages/public'

import ScrollToTop from './shared/components/common/ScrollToTop'

// Auth Pages
import {
  ForgotPassword,
  EmailVerification,
  ResetPassword
} from './pages/auth'

// Dashboard Pages
import {
  Dashboard,
  Profile,
  Analysis,
  Bookmarks,
  AttemptedTests,
  Notifications,
  Achievements,
  ReferAndEarn,
  Settings
} from './pages/dashboard'

// Exam Pages
import {
  Exams,
  ExamsNew,
  ExamDetails,
  ExamInfoNew,
  ExamCategory,
  ExamYear,
  ExamCompare,
  ExamUpdates,
  ExamMasterPage,
} from './pages/exams'

// Test Pages
import {
  TestSeries,
  MockTests,
  TestDetails,
  TestInterface,
  TestResult,
  TestReview,
  TestInstructions,
  SeriesLeaderboard,
  LiveTests,
  PracticeQuestions,
  PreviousYearPapers,
  Leaderboard,
  PYPTest,
  LiveTestInterface,
  LiveTestResults,
  LiveTestLeaderboard,
  LiveTestReview
} from './pages/tests'

// Study Pages
import {
  StudyMaterial,
  StudyMaterialDetail,
  StudyMaterialChapter,
  Videos,
  CurrentAffairs
} from './pages/study'

// Community Pages
import {
  DoubtForum,
  StudyGroups
} from './pages/community'

// Error Pages
import {
  NotFound,
  ServerError
} from './pages/errors'

// Auth Pages (from features/auth)
import { Login, Signup } from './features/auth'

// Protected Route
import ProtectedRoute from './shared/components/auth/ProtectedRoute'

// Import Error Boundary
import ErrorBoundary from './shared/components/common/ErrorBoundary'

// Import Maintenance Mode wrapper
import MaintenanceMode from './shared/components/common/MaintenanceMode'

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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate initial app load
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-brand-start/20 border-brand-start rounded-full animate-spin"></div>
            <div className="absolute inset-2 w-16 h-16 border-4 border-brand-end/30 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
          </div>
          <p className="text-gray-600 font-medium mt-6 animate-pulse">Loading Trstprep...</p>
        </div>
      </div>
    )
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
      <ErrorBoundary>
      <MaintenanceMode>
      <ScrollToTop />
      <Routes>
        {/* Auth Routes (No Layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
          <Route path="/doubts" element={<DoubtForum />} />
          <Route path="/doubts/:id" element={<DoubtForum />} />
          <Route path="/study-groups" element={<StudyGroups />} />
          <Route path="/study-groups/:id" element={<StudyGroups />} />
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
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </MaintenanceMode>
    </ErrorBoundary>
    </GoogleOAuthProvider>
  )
}

export default App
