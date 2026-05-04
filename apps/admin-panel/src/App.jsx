import { Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AdminLayout from './shared/components/AdminLayout'
import ProtectedRoute from './shared/components/ProtectedRoute'

// Auth
import Login from './features/admin/auth/Login'

// Dashboard
import AdminDashboard from './features/admin/dashboard/AdminDashboard'

// Assessments & Quizzes
import TestSeriesManager from './features/admin/assessments-quizzes/TestSeriesManager'
import TestsManager from './features/admin/assessments-quizzes/TestsManager'
import QuestionsManager from './features/admin/assessments-quizzes/QuestionsManager'
import QuizzesManager from './features/admin/assessments-quizzes/QuizzesManager'
import SectionsManager from './features/admin/assessments-quizzes/SectionsManager'
import PracticeQuestionsManager from './features/admin/assessments-quizzes/PracticeQuestionsManager'

// Study Materials
import StudyMaterialsManager from './features/admin/study-materials/StudyMaterialsManager'
import SubjectsManager from './features/admin/study-materials/SubjectsManager'
import SubjectRelationsManager from './features/admin/study-materials/SubjectRelationsManager'
import TopicsManager from './features/admin/study-materials/TopicsManager'
import CurriculumBuilder from './features/admin/study-materials/CurriculumBuilder'
import ContentManagement from './features/admin/study-materials/ContentManagement'
import MediaLibrary from './features/admin/study-materials/MediaLibrary'
import VideosManager from './features/admin/study-materials/VideosManager'
import CurrentAffairsManager from './features/admin/study-materials/CurrentAffairsManager'
import CategoriesManager from './features/admin/exams-categories/CategoriesManager'

// Exams & Categories
import ExamCategoriesManager from './features/admin/exams-categories/ExamCategoriesManager'
import ExamInfoManager from './features/admin/exams-categories/ExamInfoManager'
import StagesManager from './features/admin/exams-categories/StagesManager'
import TagConfigsManager from './features/admin/exams-categories/TagConfigsManager'

// Analytics & Insights
import AdminAnalytics from './features/admin/analytics-insights/AdminAnalytics'
import DeepAnalytics from './features/admin/analytics-insights/DeepAnalytics'
import LeaderboardResultsUnified from './features/admin/analytics-insights/LeaderboardResultsUnified'

// Users & Enrollments
import UsersManager from './features/admin/users-enrollments/UsersManager'
import EnrollmentsManager from './features/admin/users-enrollments/EnrollmentsManager'
import RolePermissionsManager from './features/admin/users-enrollments/RolePermissionsManager'
import UserActivityLog from './features/admin/users-enrollments/UserActivityLog'

// Audit & Compliance
import AuditTrailManager from './features/admin/audit-compliance/AuditTrailManager'
import ResultsManager from './features/admin/audit-compliance/ResultsManager'

// Notifications & Comms
import NotificationsManager from './features/admin/notifications-comms/NotificationsManager'
import BannerManager from './features/admin/notifications-comms/BannerManager'
import FaqManager from './features/admin/notifications-comms/FaqManager'
import EmailTemplatesManager from './features/admin/notifications-comms/EmailTemplatesManager'

// Subscriptions & Monetization
import SubscriptionPlansManager from './features/admin/subscriptions-monetization/SubscriptionPlansManager'
import CouponsManager from './features/admin/subscriptions-monetization/CouponsManager'
import PromotionManager from './features/admin/subscriptions-monetization/PromotionManager'

// System & Settings
import AdminSettings from './features/admin/system-settings/AdminSettings'
import BackupsManager from './features/admin/system-settings/BackupsManager'
import ComingSoonManager from './features/admin/system-settings/ComingSoonManager'
import NavigationManager from './features/admin/system-settings/NavigationManager'
import RecycleBin from './features/admin/system-settings/RecycleBin'
import SystemHealthMonitor from './features/admin/system-settings/SystemHealthMonitor'
import ActiveSessionsManager from './features/admin/system-settings/ActiveSessionsManager'

function App() {
  const location = useLocation()
  
  useEffect(() => {
    // Track page views for analytics (analytics tracking can be added here)
  }, [location])
  
  return (
    <Routes>
      {/* Login Route - No ThemeProvider needed */}
      <Route path="/login" element={<Login />} />
    
      {/* Admin Panel Routes - Protected and wrapped with ThemeProvider */}
      <Route path="/admin" element={
        <ProtectedRoute adminOnly={true}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        
        {/* Test & Series Management */}
        <Route path="test-series" element={<TestSeriesManager />} />
        <Route path="tests" element={<TestsManager />} />
        <Route path="questions" element={<QuestionsManager />} />
        <Route path="sections" element={<SectionsManager />} />
        <Route path="quizzes" element={<QuizzesManager />} />
        <Route path="categories" element={<CategoriesManager />} />
        
        {/* Study Materials */}
        <Route path="study-materials" element={<StudyMaterialsManager />} />
        <Route path="subjects" element={<SubjectsManager />} />
        <Route path="subject-relations" element={<SubjectRelationsManager />} />
        <Route path="deep-analytics" element={<DeepAnalytics />} />
        <Route path="email-templates" element={<EmailTemplatesManager />} />
        <Route path="roles-permissions" element={<RolePermissionsManager />} />
        <Route path="audit-trail" element={<AuditTrailManager />} />
        <Route path="topics" element={<TopicsManager />} />
        <Route path="curriculum" element={<CurriculumBuilder />} />
        
        {/* Exams */}
        <Route path="exam-categories" element={<ExamCategoriesManager />} />
        <Route path="exam-info" element={<ExamInfoManager />} />
        <Route path="exam-info/:examId" element={<ExamInfoManager />} />
        <Route path="stages" element={<StagesManager />} />
        
        {/* Users */}
        <Route path="users" element={<UsersManager />} />
        <Route path="sessions" element={<ActiveSessionsManager />} />
        <Route path="enrollments" element={<EnrollmentsManager />} />
        <Route path="results" element={<ResultsManager />} />
        
        {/* Media */}
        <Route path="media" element={<MediaLibrary />} />
        <Route path="banners" element={<BannerManager />} />
        <Route path="faqs" element={<FaqManager />} />
        <Route path="videos" element={<VideosManager />} />
        
        {/* Communication */}
        <Route path="notifications" element={<NotificationsManager />} />
        <Route path="current-affairs" element={<CurrentAffairsManager />} />
        <Route path="practice-questions" element={<PracticeQuestionsManager />} />
        
        {/* Marketing */}
        <Route path="promotions" element={<PromotionManager />} />
        <Route path="coupons" element={<CouponsManager />} />
        <Route path="coming-soon" element={<ComingSoonManager />} />
        
        {/* Subscription */}
        <Route path="subscription-plans" element={<SubscriptionPlansManager />} />
        
        {/* System */}
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
      </Route>
      
      {/* 404 - Show meaningful error instead of silent redirect */}
      <Route path="*" element={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 700, color: '#1e293b' }}>404</h1>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>Page not found</p>
          <a href="/admin" style={{ color: '#6366f1', textDecoration: 'underline' }}>← Back to Dashboard</a>
        </div>
      } />
    </Routes>
  )
}

export default App