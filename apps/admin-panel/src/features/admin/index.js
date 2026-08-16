// Admin Feature Exports — Reorganized into domain subdirectories

// Dashboard
export { default as AdminDashboard } from './dashboard/AdminDashboard'

// Analytics & Insights
export { default as AdminAnalytics } from './analytics-insights/AdminAnalytics'
export { default as LeaderboardResultsUnified } from './analytics-insights/LeaderboardResultsUnified'
export { default as DeepAnalytics } from './analytics-insights/DeepAnalytics'

// Exams & Categories
export { default as ExamCategoriesManager } from './exams-categories/ExamCategoriesManager'
export { default as ExamInfoManager } from './exams-categories/ExamInfoManager'
export { default as StagesManager } from './exams-categories/StagesManager'
export { default as CategoriesManager } from './exams-categories/CategoriesManager'
export { default as TagConfigsManager } from './exams-categories/TagConfigsManager'

// Assessments & Quizzes
export { default as TestSeriesManager } from './assessments-quizzes/TestSeriesManager'
export { default as TestsManager } from './assessments-quizzes/TestsManager'
export { default as SectionsManager } from './assessments-quizzes/SectionsManager'
export { default as QuestionsManager } from './assessments-quizzes/QuestionsManager'
export { default as QuizzesManager } from './assessments-quizzes/QuizzesManager'
export { default as PracticeQuestionsManager } from './assessments-quizzes/PracticeQuestionsManager'

// Study Materials
export { default as StudyMaterialsManager } from './study-materials/StudyMaterialsManager'
export { default as SubjectRelationsManager } from './study-materials/SubjectRelationsManager'
export { default as TopicsManager } from './study-materials/TopicsManager'

export { default as ContentManagement } from './study-materials/ContentManagement'
export { default as CurriculumBuilder } from './study-materials/CurriculumBuilder'
export { default as CurrentAffairsManager } from './study-materials/CurrentAffairsManager'

// Notifications & Comms
export { default as EmailTemplatesManager } from './notifications-comms/EmailTemplatesManager'
export { default as NotificationsManager } from './notifications-comms/NotificationsManager'
export { default as BannerManager } from './notifications-comms/BannerManager'
export { default as FaqManager } from './notifications-comms/FaqManager'

// Subscriptions & Monetization
export { default as SubscriptionPlansManager } from './subscriptions-monetization/SubscriptionPlansManager'
export { default as CouponsManager } from './subscriptions-monetization/CouponsManager'
export { default as PromotionManager } from './subscriptions-monetization/PromotionManager'

// Users & Enrollments
export { default as RolePermissionsManager } from './users-enrollments/RolePermissionsManager'
export { default as UsersManager } from './users-enrollments/UsersManager'
export { default as EnrollmentsManager } from './users-enrollments/EnrollmentsManager'
export { default as UserActivityLog } from './users-enrollments/UserActivityLog'

// Audit & Compliance
export { default as AuditTrailManager } from './audit-compliance/AuditTrailManager'
export { default as ResultsManager } from './audit-compliance/ResultsManager'

// System & Settings
export { default as RecycleBin } from './system-settings/RecycleBin'
export { default as SystemHealthMonitor } from './system-settings/SystemHealthMonitor'
export { default as BackupsManager } from './system-settings/BackupsManager'
export { default as AdminSettings } from './system-settings/AdminSettings'
export { default as NavigationManager } from './system-settings/NavigationManager'
export { default as ComingSoonManager } from './system-settings/ComingSoonManager'
export { default as ActiveSessionsManager } from './system-settings/ActiveSessionsManager'

// Auth
export { default as Login } from './auth/Login'
