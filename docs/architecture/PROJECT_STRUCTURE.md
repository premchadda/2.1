# Trstprep V2.1 - Project Structure

## 📁 Root Directory

```text
Trstprep V2.1/
├── .gitignore
├── README.md
├── deploy.sh
├── package.json
├── package-lock.json
├── qms.jsx
├── transform.cjs
├── turbo.json
│
├── apps/
│   ├── backend/               # Express.js API Server (Port 5001)
│   ├── frontend/              # React + Vite Application (User-facing)
│   └── admin-panel/           # React + Vite Application (Admin-only)
│
├── dev-tools/                 # Development utilities & scripts
│   ├── add-pass-type.js       # Add pass type to tests
│   ├── alter_banners.js       # Modify banner schema
│   ├── check_schema.js        # Validate database schema
│   ├── check_tables.js        # Check table structures
│   ├── create-leaderboard.js  # Create leaderboard entries
│   ├── migrate-admin-panel.bat # Windows migration script
│   ├── migrate-admin-panel.sh # Unix migration script
│   ├── verify-indexes.js      # Verify database indexes
│   ├── backups/               # Database backups
│   └── scripts/               # Additional dev utility scripts
│
├── docs/                      # Documentation hub
│   ├── api/                   # API documentation
│   ├── architecture/          # System architecture docs
│   ├── database/              # Database schema & exports
│   ├── development/           # Development notes
│   ├── features/              # Feature documentation
│   ├── security/              # Security reports
│   ├── analysis/              # Performance & competitor analysis
│   └── archive/               # Historical documentation
│
└── packages/                  # Shared monorepo packages (empty)
```

---

## 📦 Backend (`apps/backend/`)

**Core Technologies:** Node.js, Express.js, PostgreSQL (Supabase), JWT, Redis, BullMQ, WebSockets

### Entry Point
```
apps/backend/src/
├── app-port5001.js            # Main Express server entry point
```

### API Routes (`src/api/routes/`)
26 route files handling all API endpoints:

| Route File | Mount Path | Description |
|------------|------------|-------------|
| `achievements.js` | `/api/achievements` | User achievements |
| `admin.js` | `/api/admin` | Admin panel operations |
| `blog.js` | `/api/blogs` | Blog content |
| `bookmarks.js` | `/api/bookmarks` | User bookmarks |
| `currentAffairs.js` | `/api/current-affairs` | Current affairs articles |
| `discussions.js` | `/api/discussions` | Question discussions |
| `doubts.js` | `/api/doubts` | Doubt forum |
| `intelligence.js` | `/api/intelligence` | AI recommendations |
| `liveTests.js` | `/api/live-tests` | Live test events |
| `notifications.js` | `/api/notifications` | User notifications |
| `notificationsPref.js` | `/api/notifications-pref` | Notification preferences |
| `payments.js` | `/api/payments` | Payment processing |
| `phoneAuth.js` | `/api/auth/phone` | Phone OTP authentication |
| `practice.js` | `/api/practice` | Practice questions |
| `promotions.js` | `/api/promotions` | Promotional offers |
| `pyp.js` | `/api/pyp` | Previous year papers |
| `questions.js` | `/api/questions` | Question management |
| `referrals.js` | `/api/referrals` | Referral system |
| `series.js` | `/api/series` | Test series |
| `stages.js` | `/api/stages` | Exam stages |
| `study.js` | `/api/study` | Study materials |
| `studyGroups.js` | `/api/study-groups` | Study groups |
| `subscriptions.js` | `/api/subscriptions` | User subscriptions |
| `subscriptions-admin.js` | `/api/admin/subscriptions` | Admin subscription management |
| `tagConfigs.js` | `/api/tag-configs` | Tag configurations |
| `testCategories.js` | `/api/test-categories` | Test categories |

### Modules (`src/modules/`)
Domain-driven module structure:

```
src/modules/
├── analytics/                 # Analytics services
├── attempts/
│   └── attempt.routes.js      # Test attempt management
├── auth/
│   ├── auth.routes.js         # Authentication routes
│   └── auth.service.js        # Auth business logic
├── community/                 # Community features
├── exams/
│   ├── exam.routes.js         # Exam routes
│   ├── examCategory.routes.js # Exam category routes
│   ├── examInfo.routes.js     # Exam info routes
│   └── examYearly.routes.js   # Yearly exam data
├── questions/                 # Question modules
├── study/                     # Study modules
├── subscriptions/             # Subscription modules
├── tests/
│   ├── test.routes.js         # Test routes
│   ├── test.engine.routes.js  # Test engine routes
│   └── test.helpers.js        # Test utilities
└── users/
    └── user.routes.js         # User routes
```

### Data Layer (`src/data/`)

```
src/data/
├── database/
│   └── db.js                  # Database connection helper
├── migrations/
│   └── fix-test-series-mapping.js
├── models/                    # Data models
│   ├── CurrentAffair.js
│   ├── ExamUpdate.js
│   ├── Leaderboard.js
│   ├── LiveTest.js
│   ├── Notification.js
│   ├── Stage.js
│   ├── StudyMaterial.js
│   ├── Video.js
│   ├── attempt/
│   │   ├── Enrollment.js
│   │   ├── Result.js
│   │   └── SectionAttempt.js
│   ├── exam/
│   │   ├── Exam.js
│   │   ├── ExamCategory.js
│   │   ├── ExamSubCategory.js
│   │   └── ExamYearlyData.js
│   ├── question/
│   │   ├── Passage.js
│   │   └── Question.js
│   ├── subscription/
│   │   ├── Coupon.js
│   │   └── SubscriptionPlan.js
│   ├── syllabus/
│   │   ├── Chapter.js
│   │   ├── Subject.js
│   │   └── Topic.js
│   ├── test/
│   │   ├── Test.js
│   │   ├── TestCategory.js
│   │   └── TestSeries.js
│   └── user/
│       └── User.js
├── repositories/              # Repository pattern
│   ├── BaseRepository.js
│   ├── QuestionRepository.js
│   ├── TestAttemptRepository.js
│   ├── TestRepository.js
│   ├── TestSeriesRepository.js
│   └── UserRepository.js
└── seeds/                     # Database seeding
    ├── SeedService.js
    ├── comprehensiveSeed.js
    ├── hardcodedDataSeed.js
    ├── seed-2026-exams.js
    ├── seed-comprehensive-test.js
    └── seedData.js
```

### Services (`src/services/`)

```
src/services/
├── EmailService.js            # Email sending (SendGrid/SES/SMTP)
├── SmsService.js              # SMS sending (Twilio/AWS SNS)
├── SubscriptionService.js     # Subscription management
└── core/
    ├── analyticsService.js    # Analytics calculations
    ├── common.js              # Common utilities
    ├── leaderboardService.js  # Leaderboard management
    ├── learningService.js     # Learning path generation
    ├── notificationService.js # Notification handling
    ├── rankPredictionService.js # Rank predictions
    ├── recommendationService.js # AI recommendations
    └── testEngineService.js   # Test engine logic
```

### Infrastructure (`src/infrastructure/`)

```
src/infrastructure/
├── cache/
│   ├── cacheService.js        # Caching abstraction
│   └── redisClient.js         # Redis connection
├── database/
│   └── postgres-helpers.js    # PostgreSQL query helpers
├── email/
│   └── emailService.js        # Email provider integration
├── events/
│   └── eventBus.js            # Event system
├── queue/
│   └── queueManager.js        # BullMQ job queues
├── storage/
│   ├── storageProvider.js     # File storage abstraction
│   └── upload.js              # File upload handling
└── websocket/
    └── websocketManager.js    # WebSocket server
```

### Middleware (`src/middleware/`)

```
src/middleware/
├── asyncHandler.js            # Async error wrapper
├── auth.middleware.js         # JWT authentication
├── csrf.middleware.js         # CSRF protection
├── error.middleware.js        # Global error handler
├── monitoring.js              # Request monitoring
└── validation/
    └── inputValidation.js     # Input validation
```

### Shared Utils (`src/shared/`)

```
src/shared/
├── constants/                 # App constants
├── utils/
│   ├── attempt-limits.js      # Attempt limit logic
│   ├── attempt-utils.js       # Attempt utilities
│   ├── db-utils.js            # Database utilities
│   ├── stats-validation.js    # Stats validation
│   ├── test-utils.js          # Test utilities
│   └── user-utils.js          # User utilities
└── validators/                # Validation schemas
```

---

## 📦 Frontend (`apps/frontend/`)

**Core Technologies:** React 18, Vite, Tailwind CSS, Axios, Lucide Icons, TanStack Query

### Entry Points

```
apps/frontend/src/
├── App.jsx                    # Main app component with routes
├── main.jsx                   # React DOM entry point
├── index.html                 # HTML template
```

### Pages (`src/pages/`)

```
src/pages/
├── auth/
│   ├── EmailVerification.jsx
│   ├── ForgotPassword.jsx
│   └── ResetPassword.jsx
├── community/
│   ├── DoubtForum.jsx
│   └── StudyGroups.jsx
├── dashboard/
│   ├── Achievements.jsx
│   ├── Analysis.jsx
│   ├── AttemptedTests.jsx
│   ├── Bookmarks.jsx
│   ├── Dashboard.jsx
│   ├── Notifications.jsx
│   ├── Profile.jsx
│   ├── ReferAndEarn.jsx
│   └── Settings.jsx
├── errors/
│   ├── NotFound.jsx
│   └── ServerError.jsx
├── exams/
│   ├── ComingSoon.jsx
│   ├── ExamCategory.jsx
│   ├── ExamCompare.jsx
│   ├── ExamDetails.jsx
│   ├── ExamInfoNew.jsx
│   ├── ExamSubCategory.jsx
│   ├── ExamUpdates.jsx
│   ├── ExamYear.jsx
│   ├── Exams.jsx
│   ├── ExamsNew.jsx
│   └── PreviousYearPapers.jsx
├── public/
│   ├── About.jsx
│   ├── Blog.jsx
│   ├── BlogDetail.jsx
│   ├── ComingSoon.jsx
│   ├── Contact.jsx
│   ├── CurrentAffairsDetail.jsx
│   ├── Faq.jsx
│   ├── Home.jsx
│   ├── Pass.jsx
│   ├── Privacy.jsx
│   ├── Refund.jsx
│   ├── SearchPage.jsx
│   ├── TagPage.jsx
│   └── Terms.jsx
├── study/
│   ├── ComingSoon.jsx
│   ├── CurrentAffairs.jsx
│   ├── StudyMaterial.jsx
│   ├── StudyMaterialChapter.jsx
│   ├── StudyMaterialDetail.jsx
│   └── Videos.jsx
└── tests/
    ├── ComingSoon.jsx
    ├── Leaderboard.jsx
    ├── LiveTestInterface.jsx
    ├── LiveTestResults.jsx
    ├── LiveTests.jsx
    ├── PYPTest.jsx
    ├── PracticeQuestions.jsx
    ├── PreviousYearPapers.jsx
    ├── SeriesLeaderboard.jsx
    ├── TestDetails.jsx
    ├── TestInstructions.jsx
    ├── TestInterface.jsx
    ├── TestResult.jsx
    ├── TestReview.jsx
    └── TestSeries.jsx
```

### Features (`src/features/`)

```
src/features/
├── auth/
│   ├── index.js
│   ├── Login.jsx
│   └── Signup.jsx
├── dashboard/                 # Dashboard-related components
├── exams/                     # Exam-related components
├── study-materials/           # Study material components
└── test-series/               # Test series components
```

### Shared Components (`src/shared/`)

```
src/shared/
├── api/
│   └── adminApi.js            # Admin API client
├── components/
│   ├── LanguageSwitcher.jsx   # i18n switcher
│   ├── ProPass.jsx            # Pro pass component
│   ├── ReattemptOptions.jsx   # Reattempt options
│   ├── admin/
│   │   ├── AdminLayout.jsx    # Admin layout wrapper
│   │   └── AdminPageHeader.jsx # Admin page header
│   ├── auth/
│   │   └── ProtectedRoute.jsx # Auth route guard
│   ├── common/
│   │   ├── AnimatedHero.jsx
│   │   ├── Breadcrumb.jsx
│   │   ├── ComingSoon.jsx
│   │   ├── ContentReader.jsx
│   │   ├── ErrorMessage.jsx
│   │   ├── HorizontalScroll.jsx
│   │   ├── LoadingSkeleton.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── PDFViewer.jsx
│   │   ├── SuccessMessage.jsx
│   │   └── VideoPlayer.jsx
│   ├── layout/
│   │   ├── BottomNav.jsx
│   │   ├── Layout.jsx
│   │   ├── LeftSidebar.jsx
│   │   ├── Navbar.jsx
│   │   └── Sidebar.jsx
│   └── test/
│       ├── TestCard.jsx
│       └── TestSeriesCard.jsx
├── config/
│   └── adminNavConfig.js      # Admin navigation config
├── context/
│   └── ThemeContext.jsx        # Dark/light theme
├── hooks/
│   ├── useDraggableScroll.js   # Draggable scroll
│   ├── useExamCategories.js    # Exam categories hook
│   ├── useProPass.js           # Pro pass hook
│   ├── useStages.js            # Stages hook
│   ├── useTestCategories.js    # Test categories hook
│   └── useWebSocket.js         # WebSocket hook
├── lib/
│   ├── api.js                 # API client base
│   ├── apiBase.js             # API base URL
│   ├── dataService.js         # Data fetching service
│   └── sanitizeHtml.js        # HTML sanitization
├── providers/
│   └── AuthContext.jsx         # Authentication context
└── utils/
    └── pass-helpers.js        # Pass utility functions
```

---

## 📦 Admin Panel (`apps/admin-panel/`)

**Core Technologies:** React 18, Vite, Tailwind CSS, Axios, Lucide Icons

### Entry Points

```
apps/admin-panel/
├── index.html                 # HTML template
├── package.json               # Dependencies
├── vite.config.js             # Vite configuration
├── tailwind.config.js         # TailwindCSS config
├── postcss.config.js          # PostCSS config
├── vercel.json                # Vercel deployment
└── src/
    ├── App.jsx                # Main app component
    ├── main.jsx               # Entry point
    ├── features/
    │   └── admin/             # 43 admin management components
    │       ├── index.js
    │       ├── ActivityOrderReport.jsx
    │       ├── AdminAnalytics.jsx
    │       ├── AdminDashboard.jsx
    │       ├── AdminSettings.jsx
    │       ├── BackupsManager.jsx
    │       ├── BannerManager.jsx
    │       ├── CategoriesManager.jsx
    │       ├── ComingSoonManager.jsx
    │       ├── ContentManagement.jsx
    │       ├── CouponsManager.jsx
    │       ├── CurrentAffairsManager.jsx
    │       ├── CurriculumBuilder.jsx
    │       ├── EnrollmentsManager.jsx
    │       ├── ExamCategoriesManager.jsx
    │       ├── ExamInfoManager.jsx
    │       ├── FaqManager.jsx
    │       ├── LeaderboardResultsUnified.jsx
    │       ├── LiveTestsManager.jsx
    │       ├── MediaLibrary.jsx
    │       ├── NavigationManager.jsx
    │       ├── NotificationsManager.jsx
    │       ├── PracticeQuestionsManager.jsx
    │       ├── PromotionManager.jsx
    │       ├── PYPManager.jsx
    │       ├── QuestionsManager.jsx
    │       ├── QuizTab.jsx
    │       ├── RecycleBin.jsx
    │       ├── ResultsManager.jsx
    │       ├── StagesManager.jsx
    │       ├── StudyMaterialsManager.jsx
    │       ├── SubjectsManager.jsx
    │       ├── SubscriptionPlansManager.jsx
    │       ├── SystemHealthMonitor.jsx
    │       ├── TagConfigsManager.jsx
    │       ├── TestSeriesManager.jsx
    │       ├── TestsManager.jsx
    │       ├── TestsTab.jsx
    │       ├── TopicsManager.jsx
    │       ├── UserActivityLog.jsx
    │       ├── UsersManager.jsx
    │       └── VideosManager.jsx
    └── shared/
        ├── components/
        └── api/
```

---

## 📊 Database Statistics

| Table Category | Count |
|----------------|-------|
| **Total Tables** | **78** |
| User & Auth | 4 |
| Tests & Series | 12 |
| Study Materials | 10 |
| Exams | 8 |
| Engagement | 9 |
| Commerce | 6 |
| Content & Media | 11 |
| Analytics & Misc | 18 |

---

## 🔌 API Endpoints Summary

| Category | Count | Auth Required |
|----------|-------|---------------|
| Authentication | 10 | Partial |
| Public Endpoints | 30+ | No |
| Protected Endpoints | 25+ | Yes |
| Admin Endpoints | 40+ | Admin |
| Stages | 6 | Partial |
| Tag Configs | 6 | Partial |

**Total:** 100+ API endpoints

---

*Last Updated: March 31, 2026*
*Documented from actual codebase structure*
