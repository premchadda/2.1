# Unused Imports Integration Plan

## Executive Summary
Found **150+ unused imports** across the codebase that need to be integrated rather than removed.

---

## Category 1: Icon Imports (Lucide React)
**Count:** ~80 unused icons

### Frontend - Pages needing icons:

| File | Import | Action |
|------|--------|--------|
| pages/dashboard/ReferAndEarn.jsx | ArrowRight | Add to "Refer Now" button icon |
| pages/exams/ExamCategory.jsx | Link | Add to external links |
| pages/exams/ExamCompare.jsx | Calendar, Users, Clock, FileText, Check, X | Add to comparison table |
| pages/exams/ExamInfoNew.jsx | getTests | Integrate test data display |
| pages/exams/ExamMasterPage.jsx | ComingSoon | Show on upcoming exams |
| pages/exams/ExamsNew.jsx | SearchBox | Add search functionality |
| pages/public/Blog.jsx | Tag | Add to blog tags |
| pages/public/BlogDetail.jsx | ThumbsUp, MessageCircle | Add engagement buttons |
| pages/public/Contact.jsx | Loader2 | Add loading state |
| pages/public/Faq.jsx | PageComingSoon | Show when no FAQs |
| pages/public/SearchPage.jsx | SearchBox, Breadcrumb, User | Add search + user display |
| pages/public/TagPage.jsx | Link | Add to tag links |
| pages/study/CurrentAffairs.jsx | BookOpen, Search | Add to study materials |
| pages/study/Videos.jsx | SearchBox | Add video search |
| pages/tests/Leaderboard.jsx | Medal, Crown, Filter, Lock, AlertCircle, Award, Star, Shield | Add to leaderboard badges |
| pages/tests/LiveTestLeaderboard.jsx | Users | Add live user count |
| pages/tests/MockTests.jsx | Link | Add external test links |
| pages/tests/PracticeQuestions.jsx | Clock, XCircle, Search | Add timer + navigation |
| pages/tests/PreviousYearPapers.jsx | Target, SearchBox | Add search to papers |

### Admin Panel - Pages needing icons:

| File | Import | Action |
|------|--------|--------|
| features/admin/analytics-insights/DeepAnalytics.jsx | LineChart, Line, RadarChart, Radar, PolarGrid, etc. | Add advanced charts |
| features/admin/assessments-quizzes/QuizzesManager.jsx | Link | Add navigation |
| features/admin/audit-compliance/ResultsManager.jsx | Filter | Add filter panel |
| features/admin/exams-categories/CategoriesManager.jsx | Copy, ClipboardList | Add copy functionality |
| features/admin/exams-categories/ExamCategoriesManager.jsx | ChevronDown, ChevronRight, FolderOpen | Add tree navigation |
| features/admin/exams-categories/ExamInfoManager.jsx | X, ExternalLink, Clock, Zap, Layers, ChevronRight | Add exam details UI |
| features/admin/notifications-comms/BannerManager.jsx | GripVertical | Add drag handle |
| features/admin/study-materials/MediaLibrary.jsx | Filter | Add filter panel |
| features/admin/system-settings/AdminSettings.jsx | X, CheckCircle, AlertTriangle, Users, Lock | Add settings UI |
| features/admin/users-enrollments/UserActivityLog.jsx | Link | Add navigation |

---

## Category 2: API/Function Imports
**Count:** ~25 unused functions

### Frontend - Integrate:

| File | Import | Action |
|------|--------|--------|
| App.jsx | Toaster | Add toast notifications globally |
| pages/dashboard/Dashboard.jsx | api | Add data fetching |
| pages/dashboard/Profile.jsx | getTestSeries | Display user's test series |
| pages/public/Pass.jsx | formatRemainingDays | Show pass validity countdown |
| shared/components/test/TestSeriesCard.jsx | getTestTypeEmoji | Add emoji to test cards |
| shared/config/assetConfig.js | getValidThumbnail, getCategoryImage | Use in image rendering |
| shared/config/assets-config.js | getPlaceholderImage | Add default images |
| shared/config/index.js | getAssetUrl | Use asset URL builder |
| shared/lib/data-fetcher.js | NetworkError | Handle network errors |
| shared/lib/dataService.js | mapUserToFrontend | Transform user data |
| shared/providers/WebSocketProvider.jsx | useNotificationContext | Add notifications |

### Admin Panel - Integrate:

| File | Import | Action |
|------|--------|--------|
| features/admin/analytics-insights/DeepAnalytics.jsx | Target | Add analytics targets |
| features/admin/system-settings/AdminSettings.jsx | apiClient | Add API caller |
| shared/config/assetConfig.js | getValidThumbnail, getCategoryImage | Use in image rendering |
| shared/config/index.js | getAssetUrl | Use asset URL builder |
| shared/hooks/useStages.js | adminAPI | Add admin API |
| shared/lib/queryClientRegistry.js | QueryClient | Register query client |

---

## Category 3: Component Imports
**Count:** ~15 unused components

### Frontend - Integrate:

| File | Import | Action |
|------|--------|--------|
| App.jsx | Navigate | Add navigation component |
| components/exams/StaticContent.jsx | Clock, Award | Add content metadata |
| components/exams/YearComparison.jsx | ChevronDown, ChevronUp | Add year navigation |
| pages/dashboard/Achievements.jsx | Download, Clock | Add achievement display |
| pages/dashboard/Dashboard.jsx | TestSeriesCard | Render test series cards |
| pages/tests/TestDetails.jsx | ComingSoon | Show when no details |
| shared/components/common/PDFViewer.jsx | ZoomIn, ZoomOut | Add zoom controls |
| shared/components/common/AdminTable.jsx | MoreVertical | Add more options |
| shared/components/test/TestSeriesCard.jsx | ChevronDown, Lock | Add card controls |

### Admin Panel - Integrate:

| File | Import | Action |
|------|--------|--------|
| App.jsx | useLocation | Use for routing |
| shared/components/AdminLayout.jsx | API_BASE_URL | Add API config |
| shared/components/common/PDFViewer.jsx | ZoomIn, ZoomOut | Add zoom controls |
| shared/components/common/AdminTable.jsx | MoreVertical | Add more options |

---

## Category 4: Package Imports
**Count:** ~5

| File | Import | Action |
|------|--------|
| packages/shared-config/src/index.js | getPlaceholderImage | Export from index |

---

## Implementation Priority

### Phase 1 (Week 1): Critical Icons
- Add missing icons to leaderboard (Leaderboard.jsx)
- Add search boxes to search pages
- Add chart components to analytics (DeepAnalytics.jsx)

### Phase 2 (Week 2): API Integration
- Integrate api and dataService functions
- Add toast notifications globally (Toaster)
- Connect adminAPI in hooks

### Phase 3 (Week 3): Component Integration
- Add ComingSoon to empty states
- Add PDF zoom controls
- Integrate query client registry

### Phase 4 (Week 4): Cleanup & Verify
- Test all integrations
- Remove truly unused (after verification)
- Document usage patterns

---

## Estimated Impact

| Category | Items | Effort |
|----------|-------|--------|
| Icons | 80 | Medium |
| API Functions | 25 | High |
| Components | 15 | Medium |
| Packages | 5 | Low |

**Total estimated development time:** 4-6 weeks for full integration