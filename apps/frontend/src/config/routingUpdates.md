# Frontend Route Map (generated from `src/App.jsx`)

> Last verified: 2026-09-06 against `apps/frontend/src/App.jsx` + `src/app/routes.jsx`.
> This file documents the CURRENT routes. There is nothing to add — do not treat
> this as a to-do list. If you need a new route, add it in `App.jsx` following
> the architecture in §3, then update the table below.

## 1. Current route map

Columns: path → component → protected → gate (`pageKey` / `featureKey`) → notes.
All layout routes render inside `<Layout />`. Auth modal routes (`/login`,
`/signup`) render `<Home />` + modal overlay. `*` renders `NotFound`.

### Standalone routes (outside `<Layout />`)

| Path                                      | Component         | Protected | Notes               |
| ----------------------------------------- | ----------------- | --------- | ------------------- |
| `/verify-email`                           | EmailVerification | no        | —                   |
| `/:seriesSlug/tests/:testId/instructions` | TestInstructions  | yes       | slug-style test URL |
| `/:seriesSlug/tests/:testId/result`       | TestResult        | yes       | —                   |
| `/:seriesSlug/tests/:testId/review`       | TestInterface     | yes       | review mode         |
| `/:seriesSlug/tests/:testId`              | TestInterface     | yes       | —                   |
| `/test/:seriesId/:testId/instructions`    | TestInstructions  | yes       | id-style test URL   |
| `/test/:seriesId/:testId`                 | TestInterface     | yes       | —                   |
| `/test-result/:seriesId/:testId`          | TestResult        | yes       | —                   |
| `/test-review/:seriesId/:testId`          | TestInterface     | yes       | review mode         |

### Layout routes (inside `<Layout />`)

| Path                                                  | Component                               | Protected | Gate                      | Notes                                                     |
| ----------------------------------------------------- | --------------------------------------- | --------- | ------------------------- | --------------------------------------------------------- |
| `/`                                                   | Home                                    | no        | —                         | `RootRoute`: authenticated users redirect to `/dashboard` |
| `/login`                                              | Home + Login modal                      | no        | —                         | overlay via background location                           |
| `/signup`                                             | Home + Signup modal                     | no        | —                         | overlay via background location                           |
| `/dashboard`                                          | Dashboard                               | yes       | —                         | —                                                         |
| `/dashboard/ai-planner`                               | AIStudyPlanner                          | yes       | —                         | —                                                         |
| `/ai-tutor`                                           | AIStudyPlanner                          | yes       | —                         | alias of the planner                                      |
| `/dashboard/insights`                                 | PerformanceInsights                     | yes       | `featureKey: analytics`   | —                                                         |
| `/dashboard/rankings`                                 | Leaderboard                             | yes       | —                         | —                                                         |
| `/test-series`                                        | TestSeries                              | no        | —                         | canonical listing                                         |
| `/tests`                                              | TestSeries                              | no        | —                         | alias → same component                                    |
| `/live-tests`                                         | LiveTests                               | no        | —                         | listing                                                   |
| `/live`                                               | → `/live-tests`                         | no        | —                         | redirect                                                  |
| `/pricing`                                            | → `/pass`                               | no        | —                         | redirect                                                  |
| `/results`                                            | → `/attempted-tests`                    | no        | —                         | redirect                                                  |
| `/test-series/:seriesId`                              | TestDetails                             | no        | —                         | —                                                         |
| `/test-series/:seriesId/my`                           | TestDetails                             | no        | —                         | —                                                         |
| `/:examSlug/test-series/my`                           | TestDetails                             | no        | —                         | exam-scoped                                               |
| `/:examSlug/test-series/:seriesId`                    | TestDetails                             | no        | —                         | exam-scoped                                               |
| `/test-series/:id/leaderboard`                        | SeriesLeaderboard                       | no        | —                         | —                                                         |
| `/study`                                              | StudyMaterial                           | no        | —                         | —                                                         |
| `/study/:subjectId`                                   | StudyMaterialDetail                     | no        | —                         | —                                                         |
| `/study/:subjectId/:chapterId`                        | StudyMaterialChapter                    | no        | —                         | —                                                         |
| `/exams`                                              | Exams                                   | no        | —                         | canonical                                                 |
| `/exams-old`                                          | → `/exams`                              | no        | —                         | redirect                                                  |
| `/exams/category/:categoryId`                         | ExamCategory                            | no        | —                         | —                                                         |
| `/exams/category/:categoryId/exam/:examId`            | ExamInfoNew                             | no        | —                         | —                                                         |
| `/exams/category/:categoryId/exam/:examId/year/:year` | ExamYear                                | no        | —                         | —                                                         |
| `/exam/:examId`                                       | ExamInfoNew                             | no        | —                         | canonical short form                                      |
| `/exam-old/:examId`                                   | → `/exam/:examId`                       | no        | —                         | `LegacyExamRedirect`                                      |
| `/exam/:examId/updates`                               | ExamUpdates                             | no        | —                         | —                                                         |
| `/exam/:examId/year/:year`                            | ExamYear                                | no        | —                         | —                                                         |
| `/exam/:examId/compare`                               | ExamCompare                             | no        | —                         | —                                                         |
| `/tag/:tag`                                           | TagPage                                 | no        | —                         | —                                                         |
| `/videos`                                             | Videos                                  | no        | `pageKey: videos`         | gated via `FeatureGate`/coming-soon                       |
| `/videos/:subjectSlug/:chapterSlug/:videoId`          | VideoDetail                             | no        | —                         | —                                                         |
| `/videos/:id`                                         | VideoDetail                             | no        | —                         | short form                                                |
| `/analysis`                                           | Analysis                                | yes       | `featureKey: analytics`   | —                                                         |
| `/attempted-tests`                                    | AttemptedTests                          | yes       | —                         | —                                                         |
| `/pass`                                               | Pass                                    | no        | —                         | pricing/membership                                        |
| `/profile`                                            | Profile                                 | yes       | —                         | —                                                         |
| `/settings`                                           | Settings                                | yes       | —                         | —                                                         |
| `/about`                                              | About                                   | no        | —                         | —                                                         |
| `/contact`                                            | Contact                                 | no        | —                         | —                                                         |
| `/terms`                                              | Terms                                   | no        | —                         | —                                                         |
| `/privacy`                                            | Privacy                                 | no        | —                         | —                                                         |
| `/refund`                                             | Refund                                  | no        | —                         | —                                                         |
| `/faq`                                                | Faq                                     | no        | —                         | —                                                         |
| `/search`                                             | SearchPage                              | no        | —                         | —                                                         |
| `/forgot-password`                                    | ForgotPassword                          | no        | —                         | —                                                         |
| `/reset-password`                                     | ResetPassword                           | no        | —                         | —                                                         |
| `/live-test-results/:liveTestId`                      | LiveTestResults                         | yes       | —                         | singular `live-test-results` is correct here              |
| `/live-tests/:liveTestId/leaderboard`                 | LiveTestLeaderboard                     | yes       | —                         | —                                                         |
| `/live-tests/:liveTestId`                             | LiveTestInterface                       | yes       | —                         | canonical live-test runner (plural)                       |
| `/live-tests/:liveTestId/review`                      | LiveTestReview                          | yes       | —                         | —                                                         |
| `/spaced-repetition`                                  | SpacedRepetition                        | yes       | —                         | —                                                         |
| `/current-affairs`                                    | CurrentAffairs                          | no        | `pageKey: currentAffairs` | —                                                         |
| `/current-affairs/:caId`                              | CurrentAffairsDetail                    | no        | —                         | —                                                         |
| `/previous-year-papers`                               | PreviousYearPapers                      | no        | —                         | canonical PYP listing                                     |
| `/pyps`                                               | PypsLanding                             | no        | —                         | landing                                                   |
| `/pyps/:examCategory/:examSlug`                       | → `/pyps/:examSlug`                     | no        | —                         | `LegacyPypsExamRedirect`                                  |
| `/pyps/:examCategory`                                 | PypsLanding                             | no        | —                         | —                                                         |
| `/tag/pyps`, `/tag/pyq`, `/tag/previous-year-papers`  | PypsLanding                             | no        | —                         | tag aliases                                               |
| `/pyp/:pypId/test`                                    | PYPTest                                 | yes       | —                         | PYP runner                                                |
| `/leaderboard`                                        | Leaderboard                             | no        | —                         | —                                                         |
| `/refer-and-earn`                                     | ReferAndEarn                            | no        | `pageKey: referAndEarn`   | —                                                         |
| `/practice`                                           | PracticeLab                             | yes       | —                         | practice experience                                       |
| `/quizzes`                                            | TagPage (`tagProp="quizzes"`)           | no        | —                         | —                                                         |
| `/blog`                                               | Blog                                    | no        | —                         | —                                                         |
| `/blog/:id`                                           | BlogDetail                              | no        | —                         | —                                                         |
| `/community`                                          | Community                               | no        | `pageKey: doubtForum`     | —                                                         |
| `/community/groups/:id`                               | Community                               | no        | `pageKey: studyGroups`    | —                                                         |
| `/notifications`                                      | Notifications                           | yes       | —                         | —                                                         |
| `/bookmarks`                                          | Bookmarks (`pages/dashboard/Bookmarks`) | yes       | —                         | —                                                         |
| `/achievements`                                       | Achievements                            | yes       | `pageKey: achievements`   | —                                                         |
| `/error-500`                                          | ServerError                             | no        | —                         | —                                                         |

## 2. Do NOT add these (stale proposals with correct alternatives)

| Do NOT add                                                                                                | Why                                                                | Use instead                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pyp`, `/pyp/:id`                                                                                        | never existed in `App.jsx`                                         | `/previous-year-papers`, `/pyps…`, `/pyp/:pypId/test` (protected)                                                                                          |
| `/live-test/:id` (singular)                                                                               | no such route; runner is plural                                    | `/live-tests/:liveTestId` (protected); results at `/live-test-results/:liveTestId`                                                                         |
| `/admin/*` in the frontend                                                                                | admin is a separate app (`:3002`); no `/admin` routes in `App.jsx` | admin-panel repo routes                                                                                                                                    |
| `pages/public/PracticeQuestions`                                                                          | file does not exist                                                | `pages/tests/PracticeLab` at `/practice` (protected)                                                                                                       |
| `pages/MyBookmarks`                                                                                       | file does not exist                                                | `pages/dashboard/Bookmarks` at `/bookmarks` (protected)                                                                                                    |
| `pages/public/CurrentAffairs(Detail)`, `pages/public/LiveTests`, `pages/public/LiveTestInterface/Results` | wrong locations                                                    | `pages/study/CurrentAffairs`, `pages/tests/LiveTests`, `pages/tests/LiveTestInterface`, `pages/tests/LiveTestResults`, `pages/public/CurrentAffairsDetail` |
| `pages/exams/PreviousYearPapers`, `pages/exams/PYPTest`                                                   | wrong locations                                                    | `pages/tests/PreviousYearPapers`, `pages/tests/PYPTest`, `pages/pyps/PypsLanding`                                                                          |

## 3. Routing architecture

- **Code splitting:** pages load via `lazyWithRetry` (`src/shared/utils/lazyWithRetry`)
  — lazy + automatic retry, cutting the initial bundle ~30–50%. Layout-level
  components (`Layout`, `ScrollToTop`, `ErrorBoundary`, `MaintenanceMode`,
  `PwaUpdatePrompt`) stay eager.
- **Route factory:** `createRoute(path, element, opts)` (`src/app/routes.jsx`)
  de-duplicates route setup; `wrapElement(element, { protected, featureKey, pageKey })`
  composes `<RouteErrorBoundary>` + optional `<ProtectedRoute>` + optional
  `<FeatureGate>` around every page.
- **`RootRoute`:** `/` waits for auth resolution (`PageSkeleton` meanwhile) so
  logged-in users go straight to `/dashboard` without a Home flash.
- **Gating:** `featureKey` (e.g. `analytics`) checks feature flags;
  `pageKey` (e.g. `videos`, `currentAffairs`, `referAndEarn`, `achievements`,
  `doubtForum`, `studyGroups`) links routes to `comingSoonConfig` so ungated
  pages can render `PageComingSoon` (`src/shared/components/common/FeatureGate.jsx`,
  `PageComingSoon.jsx`, `src/shared/config/comingSoonConfig.js`).
- **Conventions:** list pages stay public; runners/results stay protected;
  legacy paths use `<Navigate replace />` redirects, never duplicate components.
