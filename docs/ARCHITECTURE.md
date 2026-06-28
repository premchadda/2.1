# Architecture

Complete architecture documentation for Trstprep V2.1 — quick reference, deployment, structure, workflows, and migration design.

---


## Quick Reference

*Source: `docs/ARCHITECTURE_QUICK_REFERENCE.md`*

## Trstprep V2.1 — Quick Architecture Reference

## Stack
- **Frontend:** React 18 + Vite + Tailwind + React Query + React Router v6
- **Admin Panel:** React 18 + Vite + Tailwind + React Query (separate app)
- **Backend:** Node.js 20 + Express + PostgreSQL (Supabase) + Redis (BullMQ) + Socket.IO
- **Database:** PostgreSQL via Supabase (RLS enabled)
- **Cache:** Redis (optional, graceful degradation)
- **Queue:** BullMQ (analytics, leaderboard, notifications, recommendations)
- **Storage:** S3 / Supabase Storage / local disk (configurable)
- **Email:** Nodemailer
- **Payments:** Razorpay
- **AI:** OpenRouter multi-provider (OpenAI, Anthropic, Gemini)

## Repo layout
```
apps/
  frontend/          - User-facing SPA (port 3000)
  admin-panel/       - Admin SPA (port 3002)
  backend/           - Express API (port 5001)
packages/
  shared-config/     - Shared constants (admin nav, coming-soon, etc.)
  shared-hooks/      - Shared React hooks
docs/                - Documentation
supabase_data/       - Scraped exam data (PYP, Mock Test)
graphify-out/        - Knowledge graph artifacts (do not deploy)
```

## Backend layers
```
apps/backend/src/
  app-port5001.js          - Single Express entrypoint (1644 lines)
  api/routes/              - 40+ router files (refactor in progress)
  modules/                 - Domain modules (auth, tests, attempts, ...)
    auth/
    tests/
    attempts/
    ...
  infrastructure/
    database/
      postgres-helpers.js  - ~3000 lines dbHelpers façade + initTables()
      migrations/          - 14 .sql files (003-017 missing!)
    cache/
    email/
    events/
    queue/
    storage/
    websocket/
  middleware/              - auth, csrf, error, origin, audit, etc.
  services/                - Business logic (analytics, leaderboard, etc.)
  data/
    models/                - MongoDB-like shims over PostgreSQL
  shared/
    config.js
    validation/
  __tests__/               - Jest tests
```

## Key data flows
- **Authentication:** httpOnly cookies + JWT (HS256) + CSRF tokens (DB-backed)
- **Real-time:** Socket.IO with JWT auth, session eviction
- **Background jobs:** BullMQ workers (testScheduler, outboxPoller, attemptCleaner)
- **File uploads:** Multipart → `/api/admin/assets/upload` → storage provider
- **Payments:** Razorpay order → verify signature → activate subscription

## Database
- ~79 tables in production
- 14 migrations on disk (003-017 are MISSING — must be recovered)
- 5 RPC functions called but NOT in migrations (must be created from `000_baseline_functions.sql`)
- 6 tables referenced but never created (see `030_create_missing_tables.sql`)
- RLS enabled on all tables but only 1 policy exists (service role only)

## Hot paths
- `/api/auth/*` — login, register, OAuth, password reset
- `/api/tests/:id/start|submit|result` — test lifecycle
- `/api/users/profile|enroll|attempts` — user state
- `/api/admin/*` — admin CRUD (CSRF + admin role)
- `/api/practice/*` — practice questions
- `/api/intelligence/*` — leaderboard, streak, top performers

## Common tasks
- **Add a new admin manager:** Create file in `apps/admin-panel/src/features/admin/<category>/`, add to `features/admin/index.js`, add route in `App.jsx`, add nav item in `shared/config/adminNavConfig.js`.
- **Add a new API endpoint:** Create or extend a router file in `apps/backend/src/api/routes/` or `apps/backend/src/modules/`, mount in `app-port5001.js`, add to docs/api/ if exists.
- **Add a new DB table:** Add to a new migration file `030_xxx.sql`, also add to `postgres-helpers.js` `initTables()` if needed.
- **Run a migration:** `node apps/backend/scripts/run-migration.js` (or restart the backend — `migrationRunner.js` runs on boot).

## Open issues (see AUDIT_REPORT.md)
- 5 critical blockers (secrets, missing migrations, missing functions, missing tables, is_active filter)
- 12 high priority
- 29 medium/low

## Deployment
- Frontend: built with Vite, deployed to Vercel/Netlify/Cloudflare Pages
- Admin Panel: same as frontend but on a separate domain
- Backend: Docker container, deployed to Railway/Render/Fly.io
- Database: Supabase managed
- Migrations: applied automatically on backend boot

---


## Deployment Guide

*Source: `docs/architecture/DEPLOYMENT.md`*

## Deployment Guide

**Trstprep V2.0 - Multi-Platform Deployment**

---

## Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   User Frontend     │    │    Admin Panel      │    │     Backend API     │
│   (Vercel)          │    │    (Vercel)         │    │     (Railway)       │
│   app.trstprep.com  │    │   admin.trstprep.com│    │   api.trstprep.com  │
└─────────┬───────────┘    └─────────┬───────────┘    └─────────┬───────────┘
          │                          │                          │
          │     All API requests     │     All API requests     │
          └──────────────────────────┼──────────────────────────┘
                                     │
                          ┌──────────┴───────────┐
                          │   PostgreSQL (Supabase) │
                          │   Redis (Upstash)       │
                          └─────────────────────────┘
```

---

## Phase 1: Backend Deployment (Railway/Render)

### 1.1 Prerequisites
- Supabase project with PostgreSQL database
- Upstash Redis account (for caching/queues)
- Railway or Render account

### 1.2 Environment Variables

Set these in your Railway/Render dashboard:

```bash
## Server
NODE_ENV=production
PORT=5001

## Database
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

## JWT (generate strong secret)
JWT_SECRET=<64-char-random-hex-string>

## CORS Origins
FRONTEND_URL=https://app.trstprep.com
ADMIN_PANEL_URL=https://admin.trstprep.com

## Optional: Admin API Key
ADMIN_API_KEY=<strong-random-secret>

## Email (configure your provider)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxx
FROM_EMAIL=noreply@trstprep.com

## SMS (configure your provider)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### 1.3 Deploy to Railway
1. Connect GitHub repo to Railway
2. Select `apps/backend` as root directory
3. Add environment variables
4. Deploy - Railway auto-detects Node.js

---

## Phase 2: User Frontend Deployment (Vercel)

### 2.1 Prerequisites
- Vercel account
- Backend API URL from Phase 1

### 2.2 Environment Variables
Set in Vercel project settings:

```bash
VITE_API_URL=https://api.trstprep.com
VITE_APP_NAME=Trstprep
VITE_ADMIN_URL=https://admin.trstprep.com
```

### 2.3 Deploy Steps
```bash
## Install Vercel CLI
npm i -g vercel

## Deploy frontend
cd apps/frontend
vercel --prod
```

### 2.4 Custom Domain
1. In Vercel dashboard, add domain `app.trstprep.com`
2. Update DNS records per Vercel instructions
3. Wait for SSL certificate provisioning

---

## Phase 3: Admin Panel Deployment (Vercel)

### 3.1 Environment Variables
Set in Vercel project settings (separate project):

```bash
VITE_API_URL=https://api.trstprep.com
VITE_ADMIN_URL=https://admin.trstprep.com
VITE_ADMIN_API_KEY=<same-as-backend-ADMIN_API_KEY>
```

### 3.2 Deploy Steps
```bash
## Deploy admin panel
cd apps/admin-panel
vercel --prod
```

### 3.3 Custom Domain
1. In Vercel dashboard, add domain `admin.trstprep.com`
2. Update DNS records
3. Verify X-Robots-Tag header is set (noindex, nofollow)

---

## Phase 4: Post-Deployment Checklist

### Security
- [ ] Database password rotated in Supabase
- [ ] JWT_SECRET is 64+ characters
- [ ] ADMIN_API_KEY set in both backend and admin panel
- [ ] CORS restricted to production domains only
- [ ] HTTPS enabled on all domains
- [ .env files NOT committed to git

### Testing
- [ ] User can register/login at app.trstprep.com
- [ ] Admin can login at admin.trstprep.com
- [ ] Admin API returns 403 when accessed from user frontend
- [ ] /admin/* redirects to admin panel URL
- [ ] All API endpoints respond correctly
- [ ] Email notifications working
- [ ] SMS OTP working

### Monitoring
- [ ] Error logging configured (Sentry/LogRocket)
- [ ] API health endpoint monitored (/api/health)
- [ ] Database backups automated
- [ ] SSL certificate expiry alerts set

---

## Troubleshooting

### CORS Errors
- Verify `FRONTEND_URL` and `ADMIN_PANEL_URL` match deployed domains exactly
- Check CORS headers in browser dev tools

### Admin Panel 403 Errors
- Verify `X-Admin-API-Key` header matches backend `ADMIN_API_KEY`
- Check admin user has `role: 'admin'` in database

### Frontend Build Failures
- Ensure all environment variables are set in Vercel
- Check `VITE_API_URL` uses HTTPS in production

---

## Quick Deploy Commands

```bash
## Deploy all
cd apps/backend && vercel --prod
cd ../frontend && vercel --prod
cd ../admin-panel && vercel --prod
```

---


## Project Structure

*Source: `docs/architecture/PROJECT_STRUCTURE.md`*

## Trstprep V2.1 - Project Structure

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

---


## Platform Hierarchy Design

*Source: `docs/architecture/platform_hierarchy_docs.md`*

## Trstprep Advanced Content Hierarchy & Interlinking (V2.0)

To compete with top-tier test prep platforms, Trstprep's architecture moves beyond a simple "Exam → Test Series" linear funnel into a **Topic-Centric Knowledge Graph** powered by analytics and adaptive recommendations.

## 1. The Core Advanced Hierarchy (The Topic Graph)

Instead of study materials isolated only to Test Series, everything routes through **Subjects and Topics**.

```mermaid
graph TD
    A[Exam <br> e.g. SSC CGL] -->|Has| H[Test Series Bundle]
    A -->|Informational Landing| I_H[Exam Info Hub]
    
    I_H -->|Details| I1[Notifications / Dates]
    I_H -->|Details| I2[Eligibility / Vacancy]
    I_H -->|Details| I3[Syllabus / Pattern]
    I_H -->|Details| I4[Salary / Cut-offs]
    
    H -->|Organized by| B[Stage / Tier <br> e.g. Tier 1]
    
    B -->|Categorized as| C1[Mock Tests]
    B -->|Categorized as| C2[PYQs]
    
    C1 -->|Subcategory| SC_L[Live Full Test]
    C1 -->|Subcategory| SC_FM[Mock Test]
    C1 -->|Subcategory| SC_MI[Mini Test]
    C1 -->|Subcategory| SC_MO[Module]
    C1 -->|Subcategory| SC_S[Sectional Test]
    C1 -->|Subcategory| SC_C[Chapter Test]
    
    C2 -->|Organized by| PYQ_Y[Year <br> e.g. 2024]
    PYQ_Y -->|Subcategory| PYQ_F[Full]
    PYQ_Y -->|Subcategory| PYQ_SH[Shift-wise]
    PYQ_Y -->|Subcategory| PYQ_MO[Module-wise]
    PYQ_Y -->|Subcategory| PYQ_S[Sectional]
    PYQ_Y -->|Subcategory| PYQ_C[Chapter-wise]
    
    SC_MO -->|Modules contain| SEC1[Section <br> e.g. Maths]
    SC_MO -->|Modules contain| SEC2[Section <br> e.g. Reasoning]
    PYQ_MO -->|Modules contain| SEC1
    
    A -->|Contains| SUB[Subject <br> e.g. Quant]
    I3 -->|Syllabus Maps to| SUB
    SUB -->|Contains| CHAP[Chapter <br> e.g. Percentage]
    CHAP -->|Breaks down to| TOPIC((Topic))
    
    CHAP -->|Learn| E[Study Notes & Videos]
    
    SEC1 -->|Questions Map to| TOPIC
    SC_S -->|Full Subject Test| SUB
    SC_C -->|Chapter Level Test| CHAP
    PYQ_S -->|Full Subject Test| SUB
    PYQ_C -->|Chapter Level Test| CHAP
```

---

## 2. Advanced Page & Route Architecture

### Level 1: Discovery & Exam Hubs
* **Global Hub:** `/exams` (Search and discover all exams)
### Level 2: The Exam Hub (The Pitch & Information Center)
* **Exam Hub:** `/exam/:examId` (e.g., `/exam/ssc-cgl`)
  * This is the master informative landing page for the exam, serving both SEO and user guidance before they enter the preparation loop.
  * **Core Exam Info Sub-Modules:**
    * **Overview:** General introduction and organizing body.
    * **Notifications & Updates:** Latest official news, admit card releases, and result announcements.
    * **Important Dates:** Application start/end, exam dates, interview dates.
    * **Eligibility:** Age limits, educational qualifications, physical standards (if any).
    * **Vacancies:** Year-wise, category-wise, and post-wise breakdown.
    * **Exam Pattern:** Stage-wise (Tier 1 vs Tier 2), marking scheme, negative marking, and duration.
    * **Syllabus:** Deep, topic-wise breakdown mapped directly to the active Chapters in the platform.
    * **Cut-offs:** Previous years' category-wise cut-off trends.
    * **Salary & Job Profile:** Pay scales (e.g., Level 7: ₹44,900-1,42,400), perks, and career growth.
  * **SEO Sub-pages:** `/exam/:examId/study-plan`, `/exam/:examId/analysis`, `/exam/:examId/preparation-strategy`

### Level 2: The Core Preparation Engine & Dashboard
* **Main Dashboard:** `/dashboard`
  * *Features:* "Continue Learning", "Daily Quiz", "Recommended for You" (based on recent test performance), and "Weak Topics".
* **Topic-Centric Learning:** `/topic/:topicId` (e.g., `/topic/percentage`)
  * A master page for a single topic showing *all* related Videos, Notes, PYQs, and Quizzes for that specific concept.

### Level 3: Previous Year Questions (PYQs)
* **Dedicated PYQ System:** `/pyq`
  * Discover by Exam & Year: `/pyq/ssc/cgl/2024`
  * **Granular PYQ Subcategories:**
    * *Full Paper:* The complete exam paper as originally presented.
    * *Shift-wise:* Broken down by morning/evening shifts if applicable.
    * *Module-wise:* Specific modules (e.g. Maths + Reasoning module).
    * *Sectional:* Organized by full subject (e.g. all 2024 Tier 1 Quant questions).
    * *Chapter-wise:* The deepest level (e.g. only Percentage PYQs from 2024).

### Level 4: Execution (Assessment)
* **Test Series:** `/test-series/:seriesId`
* **Test Interface:** `/test/:testId`
* **Daily Engagement:** `/daily-quiz`, `/current-affairs`, `/practice` 
  * Drives Daily Active Users (DAU) outside of premium mock tests.
* **Competition:** `/live-tests`, `/leaderboard`

### Level 5: Analytics & The Learning Loop
* **Performance Dashboard:** `/analysis`
  * *Features:* Accuracy, Time Management, Percentile, Rank, Improvement Trend.
* **The Weak Area Engine (Automated Diagnosis):**
  * After submitting a test `/test-result/:testId`, the system identifies weak topics (e.g., "Geometry").
  * **The Loop:** It immediately prompts the user to visit `/topic/geometry` to watch the concept video and take a targeted Topic Quiz.

### Level 6: Retention & Revision utilities
* **Bookmarks & Revision:** `/bookmarks`
  * Users can flag difficult questions during tests and review them here.
* **Content Tagging:** 
  * Under the hood, every question in the database must be tagged with `[exam, stage, subject, topic, difficulty, year]`. This drives the entire adaptive engine.

---

## 3. Monetization & Access Control

* **Free Layer:** Daily Quizzes, Current Affairs, Topic Study Notes, limited PYQs.
* **Premium Layer (Pro Pass):** Full Mock Tests, advanced Analytics/Diagnosis, complete Test Series bundles, and personalized Recommendation Engines.


*Last Updated: March 10, 2026 | Update date is (19:18)*

---


## Deployment Checklist

*Source: `docs/DEPLOYMENT_CHECKLIST.md`*

## Pre-Deployment Checklist — Trstprep V2.1

## CRITICAL — Must complete before deploy

### Secrets (B1)
- [ ] `apps/backend/.env` rotated — see `docs/SECURITY_INCIDENT_2026-06-14.md`
- [ ] `DATABASE_URL` rotated in Supabase
- [ ] `JWT_SECRET` rotated (generates new 64-char hex; invalidates all user sessions)
- [ ] `JWT_REFRESH_SECRET` rotated
- [ ] `RAZORPAY_WEBHOOK_SECRET` rotated in Razorpay dashboard
- [ ] `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` set (added to .env.example)
- [ ] `VITE_GOOGLE_CLIENT_ID` set in apps/frontend/.env and apps/admin-panel/.env (no more 'dummy-client-id' fallback)
- [ ] `VITE_RAZORPAY_KEY_ID` set in apps/frontend/.env
- [ ] `GOOGLE_CLIENT_ID` set in apps/backend/.env
- [ ] All other secrets in `.env` rotated
- [ ] `.env` removed from git history (`git filter-repo` or BFG)
- [ ] CI check added: fail if `.env` ever committed (workflow: .github/workflows/no-env.yml)
- [ ] All team members pull the new secrets from a password manager

### Database (B2, B3, B5, H1, H4, H5, M1, M3, M5, M6)
- [ ] Run `pg_dump --schema-only` from CURRENT Supabase project and commit missing migrations 003-017 to `apps/backend/src/infrastructure/database/migrations/`
- [ ] Apply new migration `000_baseline_functions.sql` (creates 5 missing functions)
- [ ] Apply `000_enable_rls_policies.sql`
- [ ] Apply `030_create_missing_tables.sql` (6 missing tables + _orphaned column)
- [ ] Apply `031_add_is_active_to_attempts.sql` (B4 fix)
- [ ] Apply `032_standardize_soft_delete.sql` (M1 fix)
- [ ] Apply `033_reconcile_subtopics.sql` (M3 fix)
- [ ] Apply `034_rename_notifications_read.sql` (H4 fix)
- [ ] Apply `035_add_jsonb_gin_indexes.sql` (M5 fix)
- [ ] Apply `036_add_check_constraints.sql` (status column constraints)
- [ ] Apply `037_add_csrf_expires_at_index.sql`
- [ ] Apply `038_create_remaining_missing_tables.sql` (12 tables: app_settings, navigation_menu, exam_seasons, coupons, promotions, discussions, study_groups, study_group_members, study_group_messages, referrals, achievement_definitions, user_achievements)
- [ ] Verify all migrations idempotent by re-running

### Frontend env vars
- [ ] `VITE_GOOGLE_CLIENT_ID` set to real Google OAuth client ID (currently falls back to 'dummy-client-id')
- [ ] `VITE_SOCKET_URL` set to backend WebSocket URL
- [ ] `VITE_ADMIN_URL` set to admin panel URL
- [ ] `VITE_API_URL` set to backend API URL
- [ ] `VITE_FRONTEND_URL` set to frontend URL

### Backend env vars (in addition to .env)
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` set to frontend domain
- [ ] `ADMIN_PANEL_URL` set to admin domain
- [ ] `ADMIN_API_KEY` set to strong secret
- [ ] CORS allowlist reviewed (no dev localhost ports in production)
- [ ] Auth rate limiter enabled (currently disabled in dev)

### Code cleanup (HIGH priority)
- [x] `Signup.jsx` @gmail.com filter removed
- [x] `GroupDetail.jsx` shows real Chat + Discussions (still relies on backend tables now created in 038)
- [x] `ExamInfoNew.jsx` hardcoded DEFAULT_CONTENT replaced with PLACEHOLDER_TEXT
- [x] `ExamInfoNew.jsx` hardcoded "Key Points" bullet list removed
- [x] `ExamInfoNew.jsx` hardcoded FAQ list now reads from `examData.faqs` (DB-driven)
- [x] `ExamInfoNew.jsx` hardcoded PYP year list now reads from API
- [x] `Profile.jsx` "Coming Soon" pills on Payment Methods removed (in two locations)
- [x] `Profile.jsx` "More languages coming soon" hint removed
- [x] `Profile.jsx` "More Features Coming Soon!" banner removed
- [x] `StudyMaterial.jsx` "popular" sort uses real views if available, falls back to content-depth and labels as "Featured"
- [x] `EmailTemplatesManager` test-send button enabled, calls /api/admin/email-templates/test (render-only) and shows rendered preview
- [x] `PromotionManager` and `QuizzesManager` demo toasts removed
- [ ] `ProtectedRoute` honors super_admin (frontend accepts only 'admin', admin panel accepts both)
- [ ] `SubscriptionPlansManager` polling reduced
- [x] `Login` redirects to /admin
- [x] `AuditLogViewer.jsx` deleted
- [x] `ExamSeasonsManager` backend now wired (table created in 038)
- [x] `ComingSoonManager` `/api/admin/coming-soon-config` endpoint exists and uses `app_settings` (table created in 038)
- [x] UnhandledRejection exits process in production

### Backend hardening
- [ ] `parseAssetId` deduplicated (single source of truth)
- [ ] `mapBulkRowToQuestionPayload` deduplicated
- [ ] `auth.middleware.js` isVerified default → false (not true)
- [ ] `csrf.middleware.js` memory fallback uses hashed key
- [ ] `uncaughtException` logs in production
- [ ] `unhandledRejection` exits in production (now wired in app-port5001.js)
- [ ] `/api/health` error message leak fixed
- [ ] Dead code `modules/tests/test.engine.routes.js` removed (moved to apps/backend/scratch/)
- [ ] Stub routes (testimonials, email-templates, roles, permissions, passages, backups) return 501 instead of fake data
- [ ] BACKUPS route returns 501 on serverless (VERCEL/AWS_LAMBDA/SERVERLESS=1) — no more failed pg_dump
- [ ] CORS dev origins removed for production
- [ ] `VITE_GOOGLE_CLIENT_ID` no longer falls back to 'dummy-client-id' (warns + disables Google button)

### Database hardening
- [ ] `attempts.is_active` column verified
- [ ] `_orphaned` column verified on tests/questions/test_series
- [ ] `subtopics` schema unified
- [ ] GIN indexes on JSONB columns
- [ ] CHECK constraints on status columns

## Post-deploy verification

- [ ] Sign up with a non-@gmail.com email works
- [ ] Google login works
- [ ] All 5 critical RPC functions callable: `SELECT update_updated_at_column(); SELECT log_audit_event(1, 'test', 'user', 1, 'desc'); SELECT update_study_material_counts(1);`
- [ ] All 6 missing tables exist: `\dt current_affairs community_comments question_tag_map attempt_section_scores leaderboard_snapshots email_templates`
- [ ] `attempts.is_active` filter works: `SELECT COUNT(*) FROM attempts WHERE is_active = true;`
- [ ] RLS policies exist: `SELECT * FROM pg_policies;`
- [ ] No .env in git: `git log --all --full-history -- apps/backend/.env`
- [ ] No "demo" toasts in admin panel
- [ ] No "Coming Soon" placeholders in critical user flows
- [ ] `npm run lint` passes
- [ ] `npm test` passes (where tests exist)
- [ ] No `Math.random()` in any page initial state
- [ ] No hardcoded `5 Lakh+` stats shown to users

## Rollback plan

If a critical issue is found post-deploy:
1. Revert via Supabase point-in-time recovery
2. Revert backend to previous container
3. Revert frontend CDN to previous build
4. Communicate to users via status page
5. Post-mortem within 24 hours

---


## Workflow Charts

*Source: `docs/workflow-chart.md`*

## Trstprep Platform — Workflow Chart Map

## 1. System Architecture

```mermaid
flowchart TB
    subgraph Users["👤 Users"]
        V[Visitor / Learner]
        P[Pro / Paid User]
        A[Admin]
    end

    subgraph Frontend["Frontend Layer"]
        FA["apps/frontend (React 18, Vite, port 3000)"]
        AD["apps/admin-panel (React 18, Vite, port 3002)"]
    end

    subgraph Backend["Backend API Layer"]
        EX["Express Server (port 5001)"]
        WS["WebSocket (Socket.IO)"]
        WK["BullMQ Worker"]
    end

    subgraph Data["Data & Infrastructure"]
        PG[("PostgreSQL / Supabase")]
        RD[("Redis — Cache + Queue")]
        FS[("File Storage<br/>Local / S3 / Supabase")]
        EM[("Email — SendGrid / SES / Nodemailer")]
        SMS[("SMS — Twilio")]
        PYM[("Payments — Razorpay")]
    end

    V --> FA
    P --> FA
    A --> AD
    FA --> EX
    AD --> EX
    FA <--> WS
    AD <--> WS
    EX --> PG
    EX --> RD
    EX --> FS
    EX --> EM
    EX --> SMS
    EX --> PYM
    WK --> RD
    WK --> PG
```

---

## 2. Authentication & Session Flow

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend API
    participant DB as PostgreSQL
    participant R as Redis

    alt Email / Password
        U->>F: Enter email + password
        F->>B: POST /api/auth/login
        B->>DB: Verify credentials (bcrypt compare)
        alt Valid
            DB-->>B: User record
            B->>B: Generate JWT (access + refresh)
            B->>R: Store refresh token / session
            B-->>F: Set cookie + return tokens
            F-->>U: Redirect to Dashboard
        else Invalid
            B-->>F: 401 Error
            F-->>U: Show error message
        end
    else Google OAuth
        U->>F: Click "Sign in with Google"
        F->>F: Google OAuth popup
        F->>B: POST /api/auth/google (id_token)
        B->>B: Verify Google token
        B->>DB: Find or create user
        B-->>F: JWT tokens set
        F-->>U: Redirect
    else Phone OTP
        U->>F: Enter phone number
        F->>B: POST /api/auth/phone/send-otp
        B->>R: Store OTP (5-min TTL)
        B-->>SMS: Send OTP via Twilio
        U->>F: Enter OTP
        F->>B: POST /api/auth/phone/verify-otp
        B->>R: Verify OTP
        B-->>F: JWT tokens
        F-->>U: Authenticated
    end
```

---

## 3. Learner User Journey

```mermaid
flowchart LR
    %% Top-level flow segments
    A("{/}<br/>Home") --> B("Browse Exams<br/>/exams, /test-series, /study")
    B --> C{"Register / Login?"}
    C -->|No| D["Public Access Only<br/>View content, take<br/>free tests"]
    C -->|Yes| E["Email/Google/Phone<br/>Authentication"]
    E --> F["Learner Dashboard<br/>/dashboard"]

    F --> G{"Choose Activity"}
    G --> H["📝 Test Series<br/>/test-series"]
    G --> I["📚 Study Material<br/>/study"]
    G --> J["🎥 Video Lectures<br/>/videos"]
    G --> K["📰 Current Affairs<br/>/current-affairs"]
    G --> L["📊 Practice / Quizzes<br/>/practice"]
    G --> M["🏆 Leaderboard<br/>/leaderboard"]

    H --> N["Test Details Page<br/>/test-series/:id"]
    N --> O{Is Premium?}
    O -->|Yes| P{Subscribed?}
    O -->|Free| Q["Start Test"]
    P -->|No| R["Subscribe / Purchase"]
    R --> F
    P -->|Yes| Q

    Q --> S["Test Instructions<br/>/test/:id/instructions"]
    S --> T["⚠️ Test Interface<br/>(Fullscreen, Timer,<br/>Section Navigation)"]
    T --> U{"Submit or<br/>Time Up?"}
    U -->|Submit| V["Processing<br/>(Auto-evaluate)"]
    U -->|Pause/Resume| T
    V --> W["📊 Test Results<br/>/test-result/:id"]
    W --> X["🔍 Test Review<br/>/test-review/:id"]
    W --> Y["Analysis Dashboard<br/>/analysis"]
    W --> F
```

---

## 4. Test Attempt Lifecycle (Backend Detail)

```mermaid
stateDiagram-v2
    [*] --> Instructions: User clicks "Start"
    Instructions --> InProgress: User accepts
    InProgress --> Paused: User pauses
    Paused --> InProgress: User resumes
    InProgress --> Submitted: User submits
    InProgress --> TimeUp: Timer expires
    Submitted --> Evaluating: Queue job dispatched
    TimeUp --> Evaluating: Queue job dispatched
    Evaluating --> ResultsComputed: Auto-evaluate answers
    ResultsComputed --> LeaderboardUpdated: Recalculate rankings
    LeaderboardUpdated --> AnalyticsGenerated: Aggregate stats
    AnalyticsGenerated --> NotificationsSent: Push result alert
    NotificationsSent --> [*]

    state InProgress {
        [*] --> Section1
        Section1 --> Section2: Navigate
        Section2 --> SectionN: Navigate
        SectionN --> [*]
    }

    state Evaluating {
        [*] --> ScoreCalculation
        ScoreCalculation --> SectionWiseBreakdown
        SectionWiseBreakdown --> TimeAnalysis
        TimeAnalysis --> [*]
    }
```

---

## 5. Backend Request Processing Pipeline

```mermaid
flowchart LR
    REQ["HTTP Request"] --> H1

    subgraph MW["Middleware Pipeline (in order)"]
        H1["1️⃣ Helmet<br/>(Security Headers)"]
        CORS["2️⃣ CORS<br/>(Origin Allowlist)"]
        RL["3️⃣ Rate Limiter<br/>(3 tiers)"]
        CP["4️⃣ Cookie Parser"]
        MG["5️⃣ Morgan<br/>(Request Logging)"]
        MON["6️⃣ Monitoring<br/>(Timing Metrics)"]
        PID["7️⃣ Public ID<br/>(ID transform)"]
        CC["8️⃣ Cache Control"]
        AUTH["9️⃣ Auth Middleware<br/>(optionalAuth / protect / admin)"]
        CSRF["🔟 CSRF Middleware<br/>(Mutations only)"]
        VAL["1️⃣1️⃣ Validation<br/>(Joi schemas)"]
    end

    subgraph Handler["Route Handler"]
        DIR["Controller Layer"]
        SVC["Service Layer"]
        REPO["dbHelpers / Repository"]
    end

    subgraph Response["Response"]
        RES["JSON Response"]
    end

    REQ --> H1
    H1 --> CORS
    CORS --> RL
    RL --> CP
    CP --> MG
    MG --> MON
    MON --> PID
    PID --> CC
    CC --> AUTH
    AUTH --> CSRF
    CSRF --> VAL
    VAL --> DIR
    DIR --> SVC
    SVC --> REPO
    REPO --> RES
```

---

## 6. Admin Panel Workflow

```mermaid
flowchart TB
    subgraph AdminAuth["Authentication"]
        AL["/admin/login"] --> ADASH
    end

    ADASH["/admin Dashboard"] --> ASEL{"Select Module"}

    ASEL --> ASSESS["📝 Assessments"]
    ASEL --> EXAM["📋 Exams & Categories"]
    ASEL --> STUDY["📚 Study Materials"]
    ASEL --> USERS["👥 Users"]
    ASEL --> ANALYTICS["📊 Analytics"]
    ASEL --> NOTIF["🔔 Notifications"]
    ASEL --> SUB["💳 Subscriptions"]
    ASEL --> SYS["⚙️ System Settings"]

    ASSESS --> QMAN["Manage Questions<br/>CRUD, Bulk Import"]
    ASSESS --> TMAN["Manage Tests<br/>Create, Configure"]
    ASSESS --> SSEC["Manage Sections<br/>Timing, Questions"]
    ASSESS --> SERIES["Test Series Admin"]

    EXAM --> CAT["Exam Categories"]
    EXAM --> INFO["Exam Info / Seasons"]
    EXAM --> STG["Stages"]

    STUDY --> SUBJ["Subjects"]
    STUDY --> TOP["Topics / Chapters"]
    STUDY --> VID["Videos"]
    STUDY --> CA["Current Affairs"]

    USERS --> ULIST["User List"]
    USERS --> ENRL["Enrollments"]
    USERS --> ROLES["Roles & Permissions"]

    ANALYTICS --> DA["Deep Analytics"]
    ANALYTICS --> LB["Leaderboards"]
    ANALYTICS --> AUDIT["Audit Trail"]

    NOTIF --> NMAN["Push Notifications"]
    NOTIF --> BANNER["Banners"]
    NOTIF --> FAQ["FAQs"]

    SUB --> PLANS["Subscription Plans"]
    SUB --> COUPONS["Coupons"]
    SUB --> PROMO["Promotions"]

    SYS --> SETT["Platform Settings"]
    SYS --> BACKUP["Backups"]
    SYS --> SESS["Active Sessions"]
    SYS --> BIN["Recycle Bin"]
```

---

## 7. Real-Time & Background Job Flow

```mermaid
flowchart LR
    subgraph Events["Trigger Events"]
        T1["Test Submitted"]
        T2["Live Test Started"]
        T3["Scheduled Reminder"]
        T4["User Action<br/>(enroll, purchase, etc.)"]
    end

    subgraph Backend["Backend Processing"]
        direction LR
        WS["WebSocket<br/>(Socket.IO)"]
        QM["Queue Manager<br/>(BullMQ)"]
    end

    subgraph Workers["Background Workers"]
        W1["🧪 Test Evaluation<br/>(auto-grade, scores)"]
        W2["📧 Email Sender<br/>(transactional)"]
        W3["🔔 Notifications<br/>(in-app + push)"]
        W4["🏆 Leaderboard<br/>(recalc rankings)"]
        W5["📈 Analytics<br/>(aggregate stats)"]
        W6["⏰ Reminders<br/>(upcoming tests)"]
    end

    subgraph Frontend["Client Updates"]
        F1["Live Leaderboard<br/>Live Test Monitor"]
        F2["Realtime Sync<br/>(cache invalidation)"]
        F3["Toast Notifications"]
    end

    T1 --> QM
    T2 --> WS
    T3 --> QM
    T4 --> WS
    T4 --> QM

    QM --> W1
    QM --> W2
    QM --> W3
    QM --> W4
    QM --> W5
    QM --> W6

    WS --> F1
    WS --> F2
    W3 --> F3
```

---

## 8. Complete Route Map

```mermaid
mindmap
  root(("Trstprep Routes"))
    Auth
      /login
      /signup
      /verify-email
      /forgot-password
      /reset-password
    Public
      /[Home]
      /about
      /contact
      /terms
      /privacy
      /refund
      /faq
      /blog
      /blog/:id
      /search
      /tag/:tag
      /pass
    Exams
      /exams
      /exams/category/:catId
      /exams/category/:catId/exam/:examId
      /exams/category/:catId/exam/:examId/year/:year
      /exam/:examId
      /exam/:examId/updates
      /exam/:examId/year/:year
      /exam/:examId/compare
    Tests
      /test-series
      /test-series/:seriesId
      /test-series/:id/leaderboard
      /test/:seriesId/:testId/instructions
      /test/:seriesId/:testId
      /test-result/:seriesId/:testId
      /test-review/:seriesId/:testId
      /live-tests
      /live-tests/:id
      /live-test-results/:id
      /live-tests/:id/leaderboard
      /live-tests/:id/review
      /previous-year-papers
      /pyp/:pypId/test
      /practice
      /quizzes
      /leaderboard
    Study
      /study
      /study/:subjectId
      /study/:subjectId/:chapterId
      /videos
      /videos/:subjectSlugOrId
      /current-affairs
      /current-affairs/:caId
    Dashboard
      /dashboard
      /profile
      /analysis
      /bookmarks
      /attempted-tests
      /notifications
      /achievements
      /settings
      /refer-and-earn
    Community
      /community
      /community/groups/:id
      /doubts --> community
      /study-groups --> community
    Errors
      /*
      /error-500
    Admin
      /admin/* --> Redirect
```

---

## 9. API Route Map (Backend)

```mermaid
mindmap
  root(("API Endpoints"))
    /api/auth
      POST /login
      POST /signup
      POST /google
      POST /phone/send-otp
      POST /phone/verify-otp
      POST /logout
      POST /refresh
    /api/admin
      [Nested admin CRUD routes]
    /api/users
      GET/PUT /profile
      GET /:id
    /api/tests
      GET / (list)
      GET /:id
      POST /
      PUT /:id
    /api/attempt
      POST /:testId/start
      POST /:id/submit
      GET /:id/result
      GET /:id/review
    /api/questions
      GET / (list, filter)
      POST /
      PUT /:id
      DELETE /:id
    /api/exams
      GET / (categories)
      GET /:id
      GET /:id/seasons
      GET /:id/yearly
    /api/series
      GET / (list)
      GET /:id
    /api/payments
      POST /create-order
      POST /verify
      GET /history
    /api/study
      GET /subjects
      GET /subjects/:id/chapters
      GET /chapters/:id/content
    /api/practice
      GET /questions
      POST /answer
    /api/current-affairs
      GET / (list)
      GET /:id
    /api/community
      GET /groups
      POST /groups
      POST /groups/:id/join
    /api/blog
      GET / (list)
      GET /:id
    /api/search
      GET /?q=:query
    /api/intelligence
      GET /recommendations
      GET /weak-areas
    /api/subscriptions
      GET /plans
      POST /subscribe
    /api/notifications
      GET / (list)
      PUT /:id/read
    /api/bookmarks
      GET / (list)
      POST /
      DELETE /:id
    /api/leaderboard
      GET / (global)
      GET /test/:testId
    /api/health
    /api/metrics
```

---


## Phase 1 Workflow

*Source: `docs/phase1-workflow.md`*

## Phase 1 Workflow Map

```mermaid
flowchart TB
  subgraph Question_Lifecycle["Question Lifecycle"]
    QC[Create Question] --> QV1[Version 1 Created]
    QE[Edit Question] --> QVN[N+1 Created]
    QV1 --> QV_Set{Current?}
    QVN --> QV_Set
    QV_Set -->|Yes| QV_IsCurrent[is_current=true]
    QV_Set -->|No| QV_Depr[is_current=false]
    QS[Submit for Review] --> QR_Pend[moderation_status=pending_review]
    QR_Pend -->|Approve| QR_App[moderation_status=approved]
    QR_Pend -->|Request Changes| QR_Chg[moderation_status=changes_requested]
    QR_Pend -->|Reject| QR_Rej[moderation_status=rejected]
    QR_Chg -->|Re-submit| QR_Pend
  end

  subgraph Test_State_Machine["Test State Machine"]
    TS_D[draft] -->|Submit for Review| TS_R[review]
    TS_R -->|Send Back| TS_D
    TS_R -->|Schedule| TS_Sch[scheduled]
    TS_R -->|Publish Direct| TS_P[published]
    TS_Sch -->|Scheduled Date Reached| TS_P
    TS_Sch -->|Archive| TS_A[archived]
    TS_P -->|Go Live| TS_L[live]
    TS_P -->|Archive| TS_A
    TS_L -->|End Date| TS_E[expired]
    TS_E -->|Archive| TS_A
    TS_A -->|Restore| TS_D
  end

  subgraph Moderation_Pipeline["Content Moderation Pipeline"]
    MP_Creator[Creator] -->|Submit| MP_PR[pending_review]
    MP_PR -->|Assign| MP_Reviewer[Reviewer]
    MP_Reviewer -->|Approve| MP_App[approved]
    MP_Reviewer -->|Request Changes| MP_Chg[changes_requested]
    MP_Reviewer -->|Reject| MP_Rej[rejected]
    MP_Chg -->|Re-submit| MP_PR
    MP_Rej -->|Re-submit| MP_PR
  end

  subgraph Attempt_Lifecycle["Attempt Lifecycle"]
    AL_Start[POST /:testId/start] -->|Create Attempt| AL_Att[Attempt: in_progress]
    AL_Att -->|Snapshot Questions| AL_Snap[attempt_question_snapshots]
    AL_Snap -->|Record Versions| AL_VMap[question_version_id mapped]
    AL_Att -->|Autosave| AL_Auto[PUT /:testId/autosave]
    AL_Att -->|Submit| AL_Sub[PUT /:testId/submit]
    AL_Sub -->|Per-Question Scoring| AL_Score[Score from snapshots.marks]
    AL_Sub -->|Store Answers| AL_Done[Attempt: completed]
    AL_Done -->|Read Result| AL_Res[GET /:testId/result/:attemptId]
  end

  subgraph Rate_Limiting["Per-Module Rate Limiting"]
    RL_Auth[auth] -->|5/min| RL_Strict[strict]
    RL_Pay[payments/phone] -->|5/min| RL_Strict
    RL_User[users/bookmarks/notifications] -->|30/min| RL_Mod[moderate]
    RL_Doubt[doubts/study-groups] -->|30/min| RL_Mod
    RL_Attempt[attempt/practice] -->|30/min| RL_Mod
    RL_Quest[questions/test-categories] -->|60/min| RL_Rel[relaxed]
    RL_Admin[admin/subscriptions] -->|60/min| RL_Rel
    RL_Gen[tests/exams/study/blogs] -->|1000/15min| RL_GenT[generous]
  end

  subgraph Scheduler["Background Scheduler (60s interval)"]
    SCH_Check[Check scheduled tests] -->|scheduledAt reached| SCH_Live[→ live]
    SCH_Check2[Check live tests] -->|expiredAt reached| SCH_Exp[→ expired]
  end

  Question_Lifecycle -->|Questions Linked To| Test_State_Machine
  Moderation_Pipeline -->|Gate to| Test_State_Machine
  Attempt_Lifecycle -->|Reads Versions| Question_Lifecycle
  Attempt_Lifecycle -->|Reads Snapshots| Question_Lifecycle
  Rate_Limiting -->|Protects Routes| Attempt_Lifecycle
  Rate_Limiting -->|Protects Routes| Test_State_Machine
  Scheduler -->|Auto-Transitions| Test_State_Machine
```

## Data Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Routes
    participant SM as State Machine
    participant M as Moderation
    participant Q as Questions
    participant V as Question Versions
    participant S as Snapshots
    participant DB as Database
    participant SCH as Scheduler

    C->>R: POST /test/:id/start
    R->>Q: Load test questions
    Q->>V: ensureVersion() per question
    V->>DB: question_versions
    R->>S: Insert snapshots per question
    S->>DB: attempt_question_snapshots
    R->>DB: Insert attempt (in_progress)

    C->>R: PUT /test/:id/autosave
    R->>DB: Update attempt.answers

    C->>R: PUT /test/:id/submit
    R->>S: Load snapshots for attempt
    S->>DB: SELECT attempt_question_snapshots
    R->>R: Score using snapshot marks
    R->>DB: Update attempt (completed)

    C->>R: GET /test/:id/result/:attemptId
    R->>S: Load snapshots
    R->>DB: Load attempt
    R->>C: Return result payload

    Note over SCH: Every 60s
    SCH->>DB: Find scheduled tests
    SCH->>DB: Update status → live
    SCH->>DB: Find live tests
    SCH->>DB: Update status → expired

    Note over C,R: Admin flows
    C->>R: POST /question/:id/submit-for-review
    R->>M: moderation_status = pending_review
    C->>R: PUT /question/:id/review
    R->>M: moderation_status = approved/rejected/changes_requested

    C->>R: PUT /test/:id/state
    R->>SM: validateTransition()
    SM->>R: Allowed?
    R->>DB: Update test status
```

## Table Relationships

```mermaid
erDiagram
    questions ||--o{ question_versions : "has versions"
    questions ||--o{ attempt_question_snapshots : "snapshotted by"
    questions ||--o{ question_attempts : "attempted in"
    questions {
        int id PK
        text question_text
        float marks
        float negative_marks
        string moderation_status
    }
    question_versions {
        int id PK
        int question_id FK
        int version_number
        float marks
        float negative_marks
        boolean is_current
        string snapshot_type
    }
    attempts ||--o{ question_attempts : "has"
    attempts ||--o{ attempt_question_snapshots : "snapshotted at"
    attempts {
        int id PK
        int user_id FK
        int test_id FK
        string status
        float score
        jsonb answers
    }
    tests {
        int id PK
        string status
        string moderation_status
        timestamp scheduled_at
        timestamp live_at
        timestamp expired_at
    }
    attempt_question_snapshots {
        int id PK
        int attempt_id FK
        int question_id FK
        int question_version_id FK
        float marks
        float negative_marks
        jsonb options
        int correct_answer
    }
    question_attempts {
        int id PK
        int attempt_id FK
        int question_id FK
        int question_version_id FK
        int selected_option
        boolean is_marked_for_review
    }
```

## Migration Order

```
019 → 020 → 021 → 022 → 023
│      │      │      │      │
│      │      │      │      └─ Content moderation columns
│      │      │      └──────── Test state machine columns + indexes
│      │      └─────────────── Attempt question snapshots table
│      └────────────────────── Question versioning enhancements
└──────────────────────────── Base schema fixes
```

---


## Migration Architecture

*Source: `docs/database/MIGRATION_ARCHITECTURE.md`*

## Migration Architecture Guide

## Overview

Trstprep V2.1 uses a **dual schema source** approach:

1. **SQL Migrations** (`apps/backend/src/infrastructure/database/migrations/`) — 49 files (000-048)
2. **Runtime DDL** (`apps/backend/src/infrastructure/database/postgres-helpers.js`) — `initTables()` runs on every startup

## Why This Exists

The original schema was created via a database dump, not SQL migrations. Migrations 003-017 were never committed to git. The core tables (`users`, `exams`, `stages`, `subjects`, `chapters`, `topics`, `tests`, `questions`, `attempts`, `test_series`, `test_sections`, `test_questions`, `question_options`, `subscriptions`, `results`, `bookmarks`, `notifications`, etc.) are created by `postgres-helpers.js:initTables()` at application startup using `CREATE TABLE IF NOT EXISTS`.

## Table Ownership

### Tables Created by SQL Migrations (canonical)
| Migration | Tables Created |
|-----------|---------------|
| 000 | Extensions + baseline RPC functions |
| 000a | RLS policies for core tables |
| 001 | permissions, roles, user_roles, role_permissions, audit_logs, email_templates, navigation_config, coming_soon_features, ai_api_usage |
| 018 | test_attempts, daily_quizzes, daily_quiz_attempts, pro_passes, user_topic_stats, study_streaks, revision_queue, wrong_questions, banners, promotions, blogs, referrals, assets, enrollments, leaderboard_entries, messages, affiliates, study_groups, subject_videos, subject_pdfs, topic_tests |
| 019 | study_materials, test_category_series, quizzes, ca_quizzes, exam_yearly_data, exam_updates |
| 020 | question_versions (enhanced) |
| 021 | attempt_question_snapshots |
| 025 | user_answers, user_topic_performance, import_logs |
| 026 | subtopics, question_assets, topic_resources |
| 027 | test_templates, ai_generation_logs, question_search_index |
| 029 | transactions |
| 030 | current_affairs, community_comments, question_tag_map, attempt_section_scores, leaderboard_snapshots, email_templates (recreated) |
| 038 | doubt_replies, subject_relations, study_progress, user_history_archive |
| 039 | attempt_answers, passages, community_votes, content_moderation_queue, ai_logs |
| 041 | tags, test_state_machine |
| 043 | exam_rooms |
| 044-045 | live_tests |
| 046 | app_settings, navigation_menu, exam_seasons, coupons, promotions (recreated), discussions, study_groups (recreated), study_group_members, study_group_messages, referrals (recreated), achievement_definitions, user_achievements |

### Tables Created by `postgres-helpers.js:initTables()` (runtime)
These tables are created via `CREATE TABLE IF NOT EXISTS` at startup:

- `users`, `exams`, `stages`, `subjects`, `chapters`, `topics`
- `tests`, `questions`, `question_options`
- `test_series`, `test_categories`, `test_sections`, `test_questions`
- `attempts`, `question_attempts`, `attempt_events`
- `subscriptions`, `subscription_plans`, `subscription_features`
- `results`, `bookmarks`, `notifications`
- `doubts`, `practice_questions`, `practice_answers`
- `user_sessions`, `login_attempts`, `activity_logs`
- `leaderboards`, `faqs`, `testimonials`, `page_content`
- `platform_stats`, `quick_access`, `media`, `backups`
- `exam_info`, `ui_tag_configs`, `pyp_papers`, `pyp_attempts`
- `group_messages`, `group_posts`, `group_post_comments`, `group_post_likes`
- `user_achievements`, `achievements`

## Key Migrations That Modify Existing Tables

| Migration | Changes |
|-----------|---------|
| 024 | Re-adds audit_logs columns lost by 019 |
| 025 | Adds exam_id, subject_id, topic_id FKs to core tables |
| 028 | Adds topic_id to user_topic_stats |
| 031 | Adds is_active to attempts |
| 032 | Adds is_deleted, deleted_at, deleted_by to 70+ tables |
| 034 | Ensures is_read on notifications |
| 035 | Adds 40+ GIN indexes on JSONB columns |
| 036 | Adds CHECK constraints on status columns |
| 037 | Adds index on csrf_tokens.expires_at |
| 039 | Consolidates test_attempts → view, creates ENUM types |
| 040 | Adds users.full_name, fixes exam_seasons.exam_id type |
| 047 | Enables RLS on 80+ tables |
| 048 | Adds RLS policies for all tables |

## Important Notes

1. **Never drop `postgres-helpers.js:initTables()`** — it's the actual schema source for core tables
2. **Migrations are idempotent** — most use `IF NOT EXISTS` / `IF EXISTS` guards
3. **No down migrations exist** — manual rollback required
4. **`test_attempts` is a VIEW** — created by migration 039, not a real table
5. **`audit_logs` was dropped and recreated** — data loss risk if re-running migration 019

---
