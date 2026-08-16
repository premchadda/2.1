# Trstprep — Site Readiness & Linkage Audit (fresh, independent)

Generated: 2026-08-14. Method: fresh source audit (existing audit docs NOT trusted). Four
subsystem deep-dives + manual cross-verification. Entry point: `apps/backend/src/app-port5001.js`
(port 5001; there is no `app.js`). ~966 backend endpoints across 81 route files + 31 module
route files.

Legend: 🔴 broken/blocking · 🟠 risky/partial · 🟢 wired/OK. `⚠` = table never created by any
migration (runtime risk). Auth: PUB / USER / SOFT(optional) / ADMIN.

---

## 1. Database Schema & Tables

### 1.1 Scale
~136 tables defined across ~107 migration files in
`apps/backend/src/infrastructure/database/migrations/`. Migrations `004–017` are MISSING
(numbering jumps 003 → 018; confirmed by `098_reconstructed_baseline.sql`).

### 1.2 🔴 Core tables are NOT created by any migration
`users`, `exams`, `subjects`, `stages`, `test_series`, `exam_categories`, `sections`,
`units`, `chapters`, `topics`, `subject_parts` receive heavy ALTERs (025,026,032,039,040,047,
049,056b,061,077,081,082,086,088,096...) but have **zero `CREATE TABLE`** in all 105 files.
They exist only because the now-dead `initTables()` (`postgres-helpers.js:568`) created them
in the live DB. **A fresh DB built purely from migrations is missing the entire core.** The
existing DB still has them, so prod works — but any fresh deploy does not.

### 1.3 🔴 24 tables referenced by code but never created by migrations
`users`, `exams`, `exam_categories`, `stages`, `test_series`, `subscription_plans`,
`subjects`, `subject_chapters`, `subject_topics`, `subject_units`, `subject_subtopics`,
`faqs`, `testimonials`, `attempt_events`, `question_attempts`, `payments`, `practice_attempts`,
`subscription_features`, `webhook_events`, `media`, `backups`, `audit_trail`,
`ui_tag_configs`, `subject_parts`.

Key runtime-fatal references:
- `attempt_events` — `attempt.repository.js:138` INSERT; ALTERed in 032/039/048/056a/085 but never created.
- `question_attempts` — used by `test.routes submit`, `practice.js`, `topicAnalytics`, `weakArea`.
- `subscription_plans` — used by `subscriptions.js`, `admin-commerce`, `subscription-plans-public`.
- `payments` — runtime DDL only in `admin-payments.js:20` (bypasses migrations).
- `media`, `faqs`, `pyp_papers`, `pyp_attempts`, `testimonials`, `backups`, `news`, `badges`, `points_log`.
- `subject_units/chapters/topics/subtopics` — the camelCase `tableMap`
  (`postgres-helpers.js:214–268`) maps `subjectTopics→subject_topics` etc., but migrations
  create plain `topics`/`chapters`/`units`/`subtopics`. **Code queries tables that don't exist**
  (practice.js, study.js, embeddingService, QuestionSearchIndex — ~20 files).

### 1.4 🔴 Broken SQL (fresh-DB blocking)
| Migration | Problem |
|---|---|
| `095` L236 | `INSERT INTO app_settings (id, site_name, is_active)` — canonical `app_settings` (068) has **no `site_name` column** → fails |
| `097` L15/L21 | `e.exam_id::text` — `exams` has no `exam_id` column (only id/slug) → "column does not exist" |
| `105` L12/L16 | `CREATE INDEX ... ON users(...)` and `ON payments(...)` — both tables never created → **migration throws, migrationRunner.js:126 halts backend startup on fresh DB** |
| `060` L11 | `exam_id VARCHAR NOT NULL REFERENCES exams(id)` — `exams.id` is INTEGER → FK type mismatch |
| `099` L36+ | RLS `user_id::text = auth.uid()::text` on INTEGER `user_id` → text-cast never equals uuid → **owner access blocked** |
| `067` L41 | Drops `question_options` (created 061) → net absence; 072/096 still touch it |

### 1.5 🟠 Duplicate / conflicting table definitions
- `user_sessions`: 3 migration shapes (003 SERIAL+UUID, 065 VARCHAR(255), 098 SERIAL+INTEGER) + runtime DDL (`session.controller.js:93`). Net shape depends on apply order.
- `app_settings`: 046 singleton JSONB vs 060/068 key/value vs 095 seeds `site_name`.
- `promotions`, `referrals`, `study_groups`: **5 competing definitions each** (018/046/060/068/100).
- `discussions` (3), `email_templates` (create/drop/create cycle), `exam_seasons` (3), `user_achievements`/`achievement_definitions` (3, 101 consolidates), `daily_quizzes`/`study_streaks`/`transactions`/`attempt_answers`/`daily_quiz_questions`/`navigation_config`/`test_sections` (paired 018-or-039 + 098).
- `test_attempts`: table → **dropped** → recreated as a **VIEW** (039/048/056a).

### 1.6 🟠 `tables.json` is stale / wrong
`apps/backend/tables.json` lists only 4 tables: `users`, `user_achievements`,
`user_topic_stats`, `user_recommendations`. `user_recommendations` is **never created
anywhere** (only INSERT in `recommendationService.js:32`).

---

## 2. Backend — Endpoints, Auth, Tables

### 2.1 Mount overview (app-port5001.js)
Admin chain per `/api/admin/*` request:
`restrictAdminOrigin → validateAdminApiKey → protect → admin → loadAdminPermissions →
requireAdminPermission → auditMiddleware` (admin-routes-index.js:64-66) — guard rails intact.

### 2.2 🔴 Critical backend bugs
1. **Duplicate mount block (verified).** `app-port5001.js:727–739` and `:780–792` are
   byte-identical — 13 routers (`/api/intelligence`, `/api/discussions`, `/api/promotions`,
   `/api/tag-configs`, `/api/pyps`, `/api/leaderboards`, `/api/enrollments`, `/api/community`,
   `/api/analytics`, `/api/admin/audit-logs`, `/api/fortspy`, `/api/import`, `/api/embeddings`)
   registered **twice** → double CSRF validation + duplicate middleware runs. Delete one block.
2. **Public `/api/leaderboards` unreachable.** `leaderboards-admin.js:8-10` applies
   `protect`+`admin` to the whole router, mounted at `/api/leaderboards` BEFORE
   `leaderboards-public.js`. Anonymous `GET /api/leaderboards` → **401 for everyone**. Public
   leaderboard list/detail is dead.
3. **Double admin chain.** `mountAdminRoutes` + `admin.js` both mount ~20 identical routers
   at `/api/admin` → every request traverses both: **double audit-log writes**, double RBAC,
   double rate-limit, double CSRF. Index copy wins on matching paths.
4. **🔴 Unauthenticated write — test categories.** `api/routes/testCategories.js` imports
   NO auth middleware at all. `GET /orphaned/list` (`:140`) and **`PUT /orphaned/reassign`**
   (`:154`, bulk-writes `testSeriesId` onto arbitrary category IDs) are fully anonymous.
5. **Missing admin live-tests API.** Frontend `adminAPI.js:107-111` calls
   `GET/POST/PUT/DELETE /api/admin/live-tests` + `/bulk` — **no backend router exists** → all 5 calls 404.
6. **CamelCase table failures** (relation "X" does not exist): `examSeasons`
   (admin-exams.js 437,480,488,508,522), `subjectParts` (admin-curriculum, dynamic-content:76),
   `questionVersions`, `studyProgress` (study-material-enrollment), `questionDiscussions` /
   `discussionReplies` / `discussionVotes` (discussions.js — real tables
   `discussions/discussion_replies/discussion_votes` exist but queries use camelCase).
7. **`/api/exams/:id/compare` dual handlers** — `exam.routes.js:143` (slug) shadows
   `exams-public.js:99` (numeric id); different semantics, public one unreachable.
8. **`/api/current-affairs` public router** fully shadowed by `currentAffairs.js`.
9. **`/api/sections` admin-on-non-admin-path** — admin chain applied at `/api/sections`
   outside `/api/admin` (inconsistent, requires admin key on non-admin path).
10. **Backup manifest wrong table names** — `admin-backups.js:168` `"examSeasons"`,
    `:171` `"liveTests"` (dump would fail).

### 2.3 🟠 Public/unauthenticated writes (inventory)
- `videos-public.js` `POST /:id/view` (:84), `POST /:id/progress` (:99), `GET /:id/progress` (:121) — all PUBLIC writes.
- `referrals.js` `POST /` (:95) — create referral, no auth.
- `examInfo.routes.js` `POST /report-error` (:43) — PUBLIC write.
- `currentAffairs.js` `GET /:id/quiz` + `POST /:id/quiz/attempt` — SOFT auth (technically unauthenticated-capable).
- `testCategories.js` `GET /orphaned/list` + `PUT /orphaned/reassign` — no auth (see 2.2.4).

### 2.4 🟠 Response-shape inconsistency
Convention `{ success, data }` (887/897 `res.json` include `success`) but global `errorHandler`
returns `{ success:false, error:{code,message} }` (different key than inline handlers'
`{ success:false, message }`); health returns `{ status:"ok" }` (206 when Redis down);
`/metrics` and `/api/admin/analytics/export` return text/CSV.

### 2.5 Dead / orphaned backend modules
- `modules/test-series/test-series.routes.js` (+controller/service/repository) — never mounted (dead).
- `api/routes/public-data.routes.js` — monolithic public router, never imported (superseded by public-routes-index split).
- Shadowed-but-mounted: `leaderboards-public.js`, `current-affairs-public.js`, `exams-public.js` `GET /:examId/compare`, ~120 `admin.js` endpoints.

### 2.6 🔴 Live-tests: the ENTIRE REST surface is broken except the list
Backend implements live sessions under `/api/live-mock` (`liveMock.routes.js`): `GET /upcoming`,
`GET /active`, `GET /:id`, `POST /` (admin), `POST /:id/register`, `POST /:id/start`,
`POST /:id/submit`, `GET /:id/leaderboard`, `GET /:id/results`. `GET /api/live-tests` works
(list of live-flagged `tests` only). **Frontend calls `/api/live-tests/:id/*` which does not
exist:**

| Frontend call | Backend reality | Status |
|---|---|---|
| `GET /api/live-tests` (LiveTests.jsx:25) | live-tests-public `GET /` | 🟢 |
| `POST /api/live-tests/:id/register` (LiveTests.jsx:116, LiveTestInterface.jsx:67) | only `/api/live-mock/:id/register` | 🔴 404 |
| `GET /api/live-tests/:id` (LiveTestInterface.jsx:66) | only `/api/live-mock/:id` | 🔴 404 |
| `POST /api/live-tests/:id/attempt` (LiveTestInterface.jsx:46) | none | 🔴 404 |
| `GET /api/live-tests/:id/live-rank` (LiveTestInterface.jsx:31) | none | 🔴 404 |
| `POST /api/live-tests/:id/save-answer` (LiveTestInterface.jsx:277) | none | 🔴 404 |
| `GET /api/live-tests/:id/leaderboard` (LiveTestLeaderboard.jsx:20) | only `/api/live-mock/:id/leaderboard` | 🔴 404 |
| `GET /api/live-tests/:id/result` (LiveTestResults.jsx:19, LiveTestReview.jsx:15) | only `/api/live-mock/:id/results` (singular vs plural) | 🔴 404 |
| `GET/POST/PUT/DELETE /api/admin/live-tests` + `/bulk` (adminAPI.js:107-111) | no router | 🔴 404 |

Fix options: (a) mount `liveMock.routes.js` at `/api/live-tests` + add aliases
`/attempt|save-answer|live-rank|result`, or (b) point the frontend at `/api/live-mock`.

---

## 3. Frontend — Site Readiness (routes × sections × forms × endpoints)

All routes wrapped in `RouteErrorBoundary` (local, App.jsx:130) + global
`ErrorBoundary`/`MaintenanceMode`. Lazy pages: all except Home/Dashboard/Login (Suspense →
PageSkeleton). Auth popup renders as overlay.

### 3.1 Route → component → guard → endpoints → status
(🟢 = endpoint exists & matches backend · 🔴 = 404 · 🔒 = auth-gated)

| Route | Component | Guard | Status |
|---|---|---|---|
| `/` | Home | public | 🟢 |
| `/login` `/signup` `/forgot-password` `/reset-password` `/verify-email` | auth pages | public | 🟢 |
| `/dashboard`, `/dashboard/ai-planner`, `/ai-tutor`, `/dashboard/insights`, `/dashboard/rankings` | Dashboard, AIStudyPlanner, PerformanceInsights | 🔒 | 🟢 |
| `/analysis`, `/attempted-tests`, `/profile`, `/settings`, `/notifications`, `/bookmarks` | Analysis, AttemptedTests, Profile, Settings, Notifications, Bookmarks | 🔒 | 🟢 |
| `/achievements` (+FeatureGate), `/spaced-repetition` | Achievements, SpacedRepetition | 🔒+FG | 🟢 |
| `/live-tests/:liveTestId(+/leaderboard|/review)` `/live-test-results/:liveTestId` | LiveTestInterface, LiveTestLeaderboard, LiveTestReview, LiveTestResults | 🔒 | 🔴 (all `/api/live-tests/:id/*` 404, §2.6) |
| `/pyp/:pypId/test` | PYPTest | 🔒 | 🟢 |
| `/practice` | PracticeLab | 🔒 | 🟢 |
| `/test-series` `/test-series/:seriesId(+/tests)` `/my` variants `/test-series/:id/leaderboard` | TestSeries, SeriesLeaderboard | mixed | 🟢 |
| `/tests` (alias), `/test-series/:seriesId/tests/:testId(+/instructions|/result|/review)` + legacy `/test/...` | TestDetails, TestInstructions, TestInterface, TestResult, TestReview | 🔒 | 🟢 |
| `/study(+/:subjectId|/:subjectId/:chapterId)` | StudyMaterial, StudyMaterialDetail, StudyMaterialChapter | public | 🟢 |
| `/exams` `/exams/category/:categoryId(+/exam/:examId|/year/:year)` | Exams, ExamCategory, ExamDetails | public | 🟢 |
| `/exam/:examId(+/updates|/year/:year|/compare)` | ExamDetails, ExamUpdates, ExamYear, ExamCompare | public | 🟢 |
| `/tag/:tag` `/tag/pyps|pyq|previous-year-papers` | TagPage | public | 🟢 |
| `/videos/:subjectSlug/:chapterSlug/:videoId` `/videos/:id` | Videos, VideoDetail, VideoPlayer | FG(videos) | 🟢 (but writes PUBLIC §2.3) |
| `/pass` | Pass | public | 🟢 |
| `/about` `/contact` `/terms` `/privacy` `/refund` `/faq` `/blog(+/:id)` | public pages | public | 🟠 Contact broken (§3.3) |
| `/search` | SearchPage | public | 🟢 |
| `/current-affairs/:caId` | CurrentAffairs, CurrentAffairsDetail | FG+public | 🟢 |
| `/previous-year-papers` `/pyps` `/pyps/:examCategory` | PreviousYearPapers, PypsLanding, PypsExam | public | 🟢 |
| `/leaderboard` | Leaderboard | public | 🟠 (backend `/api/leaderboards` 401, §2.2.2) |
| `/refer-and-earn` | ReferAndEarn | FG+🔒 | 🟢 |
| `/community` `/community/groups/:id` | Community | FG | 🟠 messaging broken (§3.3) |
| `/error-500`, `*`→NotFound | ServerError, NotFound | public | 🟢 |
| `/admin/*` | — | cross-origin redirect | 🟢 |

### 3.2 Forms inventory (per page)
- **Auth**: Login (login + 2FA), Signup, ForgotPassword, ResetPassword, EmailVerification.
- **Community** (6): askDoubt, createGroup, reply, sendMessage, addComment, createPost.
- **ExamInfoNew**: report-error form (backed by `POST /api/exam-info/report-error`, PUBLIC write §2.3).
- **PracticeWorkspace**: approach textarea (`POST /api/practice/questions/:id/approaches`).
- **CurrentAffairsDetail**: quiz (button, not `<form>`, SOFT auth).
- **Contact**: broken (see §3.3). **Blog**: newsletter form is static (no handler).
- Profile cover/avatar uploads; Settings tabbed forms; SpacedRepetition "Generate AI Plan" button.

### 3.3 🔴 Frontend → no backend route (404)
1. **Live-test flow** — entire `/api/live-tests/:id/*` surface (§2.6).
2. `GET /api/faqs` (Faq.jsx) — only admin routes exist.
3. `POST /api/contact` (Contact.jsx) — no contact route at all.
4. `GET /api/site-settings` (Contact.jsx) — only `/api/settings/public` exists.
5. `POST /api/notifications/subscribe` (ComingSoon "Notify Me") — real route is `/api/notifications-pref/subscribe`.
6. Community messaging: `/api/study-groups/:groupId/messages|/posts|/posts/:postId/like|/comments|/pin` — don't exist in studyGroups.js.

### 3.4 Orphaned frontend components (no route, no import)
`pages/exams/ExamsNew.jsx`, `pages/exams/ExamDetails.jsx`, `pages/dashboard/UserLeaderboard.jsx`
(exported via pages/index.js only). Confirmed non-orphans (used as sub-components): PypsExam,
RecentActivity, TopPerformers, ProfilePrimitives, QuestionPalette, SettingsContent.

### 3.5 🟢 Runtime-hazard screening
All risky renders are guard-protected (PYPTest:232, LiveTestInterface:325, TestInterface:1306/1332,
CurrentAffairsDetail:81/85, TestInstructions:420/442, TestDetails:1185, BlogDetail:44, TagPage:163,
SeriesLeaderboard:106, LiveTests:137, PreviousYearPapers:176, TestReview:56, TestResult:199,
LiveTestResults:33, LiveTestReview:21, PracticeLab dashboard:774).

---

## 4. Admin Panel — Site Readiness (routes × sections × forms × endpoints)

All 38 sidebar nav items map 1:1 to routes in `apps/admin-panel/src/App.jsx` — no dead nav links.
Every page renders real UI (tables/forms/modals/drawers); **no page is a stub**. ~95% of wired
endpoints verified against backend.

### 4.1 Nav → page → endpoints → status
| Nav | Component | Verdict |
|---|---|---|
| Dashboard, Analytics, Deep Analytics | AdminDashboard, AdminAnalytics, DeepAnalytics | 🟢 |
| Leaderboards | LeaderboardResultsUnified | 🟢 |
| Exam Categories, Exam Info, Stages, Categories, Sections, Tag Configs, Test Series | respective managers | 🟢 |
| Tests, Questions | TestsManager, QuestionsManager | 🟠 (hazards §4.3) |
| Quizzes | QuizzesManager | 🔴 (AI gen 404 + bulk 404, §4.3) |
| Practice Questions, Study Materials, Current Affairs, Content Management | respective managers | 🟢 |
| Email Templates, Notifications, Banners, FAQs, Subscription Plans, Coupons, Promotions | respective managers | 🟢 |
| Payments, Moderation | PaymentsManager, ModerationManager | 🟢 |
| Users (+Roles), Enrollments, Sessions | UsersPermissions, EnrollmentsManager, ActiveSessionsManager | 🟢 |
| Live Monitor, Activity Log, Audit Trail, Recycle Bin | LiveTestMonitor (WebSocket), UserActivityLog, AuditTrailManager, RecycleBin | 🟢 |
| System Health, Backups, Settings, Navigation, Two-Factor | SystemHealthMonitor, BackupsManager, AdminSettings, NavigationManager, TwoFactorManager | 🟢 |

Read-only pages (intentional): EnrollmentsManager, UserActivityLog, AuditTrailManager,
SystemHealthMonitor, LiveTestMonitor, AdminDashboard, DeepAnalytics, AdminAnalytics.

### 4.2 Forms (confirmed `<form onSubmit>`)
ExamInfoManager:435 · PromotionManager:472 · CurriculumBuilder:702 · QuizzesManager:250/278/421 ·
TestsManager:2140 · QuestionsManager:1048 · RolePermissionsManager · ContentManagement ·
NotificationsManager · EmailTemplatesManager · Banner/Faq/CurrentAffairs/TagConfigs/Navigation/
TwoFactor/SubscriptionPlans/Coupons/Moderation/PracticeQuestions/AdminSettings/ComingSoon managers.

### 4.3 🔴 Admin runtime hazards (4, verified)
1. **TypeError — bulk delete questions** — `QuestionsManager.jsx:1124` calls
   `adminAPI.bulkDeleteQuestions(selectedIds)`; method does NOT exist in `adminAPI.js`
   (backend `DELETE /admin/questions/bulk` exists → fix = add wrapper).
2. **TypeError — import history** — `ImportHistoryModal.jsx:15` calls
   `adminAPI.getImportHistory(20)`; not in `adminAPI.js` (backend `GET /admin/import/history` exists).
3. **404 — AI question generation** — `QuizzesManager.jsx:396` posts to
   `/admin/ai/generate-questions`; **no such backend route exists** (AI routers are
   `/api/ai/mentor`, `/api/ai/explanation`, `/api/ai/logs`). Bulk "generate with AI" fails.
4. **404 — bulk quiz upload** — `adminAPI.js:34` `bulkUploadQuizzes` → `/admin/quizzes/bulk`;
   backend only has `/quizzes`, `/quizzes/:id`, `/quizzes/:id/duplicate`.

### 4.4 🟠 Orphan / dead admin code
- Routes in App.jsx with NO nav entry (direct-URL only): `/admin/roles-permissions`,
  `/admin/topics`, `/admin/curriculum`, `/admin/results`, `/admin/coming-soon`.
- Dead utilities (no consumers): `useGenericCRUD.js`, `useFormManager.js`, `useTests.js`,
  `PageComingSoon.jsx`, `ComingSoon.jsx`.
- Redirect-only compat: `/admin/subjects`, `/admin/subject-relations`, `/admin/section`.
- Duplicate mount: `admin-deep-analytics.js` + `admin-analytics.js` both register
  `/funnel|/cohort|/engagement` (first wins, identical).

---

## 5. Cross-cutting linkage summary (Page → Endpoint → Table)

| Domain | Wired chain | Broken link |
|---|---|---|
| Auth (login/register/2FA/reset/me) | auth.routes → users, user_sessions, two_factor_secrets, login_attempts | — |
| Tests + attempts | test.routes/attempt.routes → tests, attempts, results, question_attempts⚠ | attempt_events⚠ never created |
| Exams + PYP | exam*.routes, pyp-hierarchy → exams⚠, exam_categories⚠, exam_yearly_data | core exam tables not in migrations |
| Study/syllabus | study.js, admin-content/curriculum → study_materials, subject_*⚠ | **subject_chapters/topics/units/subtopics never created** |
| Practice | practice.js → practice_sessions, practice_answers, question_attempts⚠ | practice_attempts⚠ raw SQL (practice.js:420) |
| **Live tests** | liveMock.routes → live_tests, attempts, tests | **frontend + admin use `/api/live-tests/:id/*` → 404** |
| Commerce | payments/subscriptions → transactions, coupons, subscription_plans⚠, webhook_events⚠ | subscription_plans/payments/webhook_events not in migrations |
| Community | doubts/studyGroups/community → doubts, doubt_replies, study_groups, group_posts | **discussions.js camelCase → relation does not exist** |
| Admin CMS | admin-* routers → content tables | admin live-tests 404; AI-gen 404; bulk quiz 404 |
| AI/Node engine | aiMentor/aiExplanation/nodeEngine → ai_conversations, nodes, embeddings | — |

---

## 6. Readiness verdict

**🟠 NOT production-ready as-is.** Structure is solid (all pages render, ~90% of endpoints
wired, admin guard chain intact), but these block the "go-live" bar:

**P0 (broken user-facing flows):**
1. Entire Live-Tests REST surface 404 (frontend + admin) — §2.6 / §3.3.1.
2. Public `/api/leaderboards` 401 for everyone — §2.2.2 (breaks Leaderboard, SeriesLeaderboard, dashboard rankings).
3. Unauthenticated `PUT /api/test-categories/orphaned/reassign` (security) — §2.2.4.
4. Admin: AI question-gen 404, bulk quiz upload 404, 2 missing adminAPI wrappers — §4.3.
5. Discussions camelCase table queries → relation does not exist (doubt/community feature) — §2.2.6.

**P1 (fresh-deploy / data integrity):**
6. 24 code-referenced tables absent from migrations (core hierarchy + subject_* + payments + faqs + ...) — §1.2/§1.3.
7. 3 migrations (095, 097, 105) fail on fresh DB; 099 RLS blocks owners — §1.4.
8. Duplicate mount block + double admin chain (double audit writes) — §2.2.1/§2.2.3.

**P2 (harden):** unauthenticated public writes (videos, referrals, report-error) — §2.3;
camelCase tableMap consistency; `tables.json` refresh; response-shape normalization;
placeholder/orphan cleanup (frontend 3, admin 5); stale backup manifest table names.

Next suggested step: fix P0 items first (smallest surface, highest user impact), then produce a
migration to create the 24 missing tables + fix 095/097/105 so fresh deploys work, then run
`scripts/run-database-audit.js` against the live DB to reconcile actual shapes.
