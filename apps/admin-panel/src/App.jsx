import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import AdminLayout from './shared/components/AdminLayout'
import ProtectedRoute from './shared/components/ProtectedRoute'
import { GlobalConfirmHost } from './shared/components/common/ConfirmModal'
import ErrorBoundary from './shared/components/common/ErrorBoundary'

const Login = lazy(() => import('./features/admin/auth/Login'))
const AdminDashboard = lazy(() => import('./features/admin/dashboard/AdminDashboard'))

const TestSeriesManager = lazy(() => import('./features/admin/assessments-quizzes/TestSeriesManager'))
const TestsManager = lazy(() => import('./features/admin/assessments-quizzes/TestsManager'))
const QuestionsManager = lazy(() => import('./features/admin/assessments-quizzes/QuestionsManager'))
const QuizzesManager = lazy(() => import('./features/admin/assessments-quizzes/QuizzesManager'))
const SectionsManager = lazy(() => import('./features/admin/assessments-quizzes/SectionsManager'))
const PracticeQuestionsManager = lazy(() => import('./features/admin/assessments-quizzes/PracticeQuestionsManager'))

const StudyMaterialsManager = lazy(() => import('./features/admin/study-materials/StudyMaterialsManager'))
const SubjectRelationsManager = lazy(() => import('./features/admin/study-materials/SubjectRelationsManager'))
const TopicsManager = lazy(() => import('./features/admin/study-materials/TopicsManager'))
const CurriculumBuilder = lazy(() => import('./features/admin/study-materials/CurriculumBuilder'))
const ContentManagement = lazy(() => import('./features/admin/study-materials/ContentManagement'))
const CurrentAffairsManager = lazy(() => import('./features/admin/study-materials/CurrentAffairsManager'))
const CategoriesManager = lazy(() => import('./features/admin/exams-categories/CategoriesManager'))

const ExamCategoriesManager = lazy(() => import('./features/admin/exams-categories/ExamCategoriesManager'))
const ExamInfoManager = lazy(() => import('./features/admin/exams-categories/ExamInfoManager'))
const StagesManager = lazy(() => import('./features/admin/exams-categories/StagesManager'))
const TagConfigsManager = lazy(() => import('./features/admin/exams-categories/TagConfigsManager'))

const AdminAnalytics = lazy(() => import('./features/admin/analytics-insights/AdminAnalytics'))
const DeepAnalytics = lazy(() => import('./features/admin/analytics-insights/DeepAnalytics'))
const LeaderboardResultsUnified = lazy(() => import('./features/admin/analytics-insights/LeaderboardResultsUnified'))

const UsersManager = lazy(() => import('./features/admin/users-enrollments/UsersManager'))
const EnrollmentsManager = lazy(() => import('./features/admin/users-enrollments/EnrollmentsManager'))
const RolePermissionsManager = lazy(() => import('./features/admin/users-enrollments/RolePermissionsManager'))
const UsersPermissions = lazy(() => import('./features/admin/users-enrollments/UsersPermissions'))
const UserActivityLog = lazy(() => import('./features/admin/users-enrollments/UserActivityLog'))

const AuditTrailManager = lazy(() => import('./features/admin/audit-compliance/AuditTrailManager'))
const ResultsManager = lazy(() => import('./features/admin/audit-compliance/ResultsManager'))

const NotificationsManager = lazy(() => import('./features/admin/notifications-comms/NotificationsManager'))
const BannerManager = lazy(() => import('./features/admin/notifications-comms/BannerManager'))
const FaqManager = lazy(() => import('./features/admin/notifications-comms/FaqManager'))
const EmailTemplatesManager = lazy(() => import('./features/admin/notifications-comms/EmailTemplatesManager'))

const SubscriptionPlansManager = lazy(() => import('./features/admin/subscriptions-monetization/SubscriptionPlansManager'))
const CouponsManager = lazy(() => import('./features/admin/subscriptions-monetization/CouponsManager'))
const PromotionManager = lazy(() => import('./features/admin/subscriptions-monetization/PromotionManager'))
const PaymentsManager = lazy(() => import('./features/admin/subscriptions-monetization/PaymentsManager'))

const AdminSettings = lazy(() => import('./features/admin/system-settings/AdminSettings'))
const BackupsManager = lazy(() => import('./features/admin/system-settings/BackupsManager'))
const ComingSoonManager = lazy(() => import('./features/admin/system-settings/ComingSoonManager'))
const NavigationManager = lazy(() => import('./features/admin/system-settings/NavigationManager'))
const RecycleBin = lazy(() => import('./features/admin/system-settings/RecycleBin'))
const SystemHealthMonitor = lazy(() => import('./features/admin/system-settings/SystemHealthMonitor'))
const ActiveSessionsManager = lazy(() => import('./features/admin/system-settings/ActiveSessionsManager'))
const LiveTestMonitor = lazy(() => import('./features/admin/system-settings/LiveTestMonitor'))
const ModerationManager = lazy(() => import('./features/admin/moderation/ModerationManager'))
const TwoFactorManager = lazy(() => import('./features/admin/system-settings/TwoFactorManager'))

const PageSkeleton = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
      <p className="text-gray-600 font-medium mt-6 animate-pulse">Loading...</p>
    </div>
  </div>
)

function App() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname.endsWith('/') && location.pathname !== '/') {
      navigate(location.pathname.slice(0, -1), { replace: true })
    }
  }, [location, navigate])
  
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ErrorBoundary>
      <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<Login />} />
    
      <Route path="/admin" element={
        <ProtectedRoute adminOnly={true}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        
        <Route path="test-series" element={<TestSeriesManager />} />
        <Route path="tests" element={<TestsManager />} />
        <Route path="questions" element={<QuestionsManager />} />
        <Route path="sections" element={<SectionsManager />} />
        <Route path="section" element={<Navigate to="/admin/sections" replace />} />
        <Route path="quizzes" element={<QuizzesManager />} />
        <Route path="categories" element={<CategoriesManager />} />
        
        <Route path="study-materials" element={<StudyMaterialsManager />} />
        <Route path="subjects" element={<Navigate to="/admin/study-materials" replace />} />
        <Route path="subject-relations" element={<Navigate to="/admin/study-materials?tab=subject-relations" replace />} />
        <Route path="deep-analytics" element={<DeepAnalytics />} />
        <Route path="email-templates" element={<EmailTemplatesManager />} />
        <Route path="roles-permissions" element={<UsersPermissions />} />
        <Route path="audit-trail" element={<AuditTrailManager />} />
        <Route path="topics" element={<TopicsManager />} />
        <Route path="curriculum" element={<CurriculumBuilder />} />
        
        <Route path="exam-categories" element={<ExamCategoriesManager />} />
        <Route path="exam-info" element={<ExamInfoManager />} />
        <Route path="exam-info/:examId" element={<ExamInfoManager />} />
        <Route path="stages" element={<StagesManager />} />
        
        <Route path="users" element={<UsersPermissions />} />
        <Route path="sessions" element={<ActiveSessionsManager />} />
        <Route path="live-monitor" element={<LiveTestMonitor />} />
        <Route path="enrollments" element={<EnrollmentsManager />} />
        <Route path="results" element={<ResultsManager />} />
        
        <Route path="banners" element={<BannerManager />} />
        <Route path="faqs" element={<FaqManager />} />
        
        <Route path="notifications" element={<NotificationsManager />} />
        <Route path="current-affairs" element={<CurrentAffairsManager />} />
        <Route path="practice-questions" element={<PracticeQuestionsManager />} />
        
        <Route path="promotions" element={<PromotionManager />} />
        <Route path="coupons" element={<CouponsManager />} />
        <Route path="coming-soon" element={<ComingSoonManager />} />
        
        <Route path="subscription-plans" element={<SubscriptionPlansManager />} />
        
        <Route path="navigation" element={<NavigationManager />} />
        <Route path="tag-configs" element={<TagConfigsManager />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="leaderboards" element={<LeaderboardResultsUnified />} />
        <Route path="content-management" element={<ContentManagement />} />
        <Route path="system-health" element={<SystemHealthMonitor />} />
        <Route path="backups" element={<BackupsManager />} />
        <Route path="activity-log" element={<UserActivityLog />} />
        <Route path="recycle-bin" element={<RecycleBin />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="payments" element={<PaymentsManager />} />
        <Route path="moderation" element={<ModerationManager />} />
        <Route path="two-factor" element={<TwoFactorManager />} />
      </Route>
      
      <Route path="*" element={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 700, color: '#1e293b' }}>404</h1>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>Page not found</p>
          <a href="/admin" style={{ color: '#6366f1', textDecoration: 'underline' }}>&larr; Back to Dashboard</a>
        </div>
      } />
    </Routes>
    </ErrorBoundary>
    <GlobalConfirmHost />
    </Suspense>
  )
}

export default App