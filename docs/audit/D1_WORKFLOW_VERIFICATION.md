# D1 — End-to-End Workflow Verification (Aug 23, 2026)

Verified against live code (`E:\Tech\Testprep\Trstprep V2.1`). Live DB facts supplied by
user: results=0 rows, attempts=22, questions=1575, test_questions=1375, tests=26,
test_series=3, users=11. `db_live_inventory.txt` at repo root is a FAILED run log
(`ERR_MODULE_NOT_FOUND: Cannot find package 'pg'`) — unusable.

Legend: ✅ works end-to-end · ⚠️ works but partial/broken path · ❌ broken

---

## W1 — Student test-taking flow (list → details → instructions → attempt → result → review)

| Step | Frontend | Backend route | Tables |
|---|---|---|---|
| Login | authAPI.login | `POST /api/auth/login` (auth.controller.js:82) → findOne users (96), bcrypt (128), token (275) | users |
| Dashboard staged fetch | Dashboard.jsx:86-91 (getTestSeries, getTests, userAPI.getAttempts, getExams, getEnrolledSeries) | `GET /api/series` (series.js:163), `GET /api/tests` (test.routes.js:543), `GET /api/users/attempts` (user.routes.js:929), `GET /api/exams` (examCategory.routes.js:13), `GET /api/users/enrolled-series` (user.routes.js:593) | test_series, tests, attempts, exam_categories, user_series |
| Test list filter | testsAPI.getAll | test.routes.js:543 — `SELECT * FROM tests WHERE is_active=true AND status='published'` | tests |
| Test details | TestDetails.jsx:920-965 (series match by slug/subcategory/category → fallback getTestSeriesById → getTestsBySeriesId, dedupe by id) | `GET /api/series/:slug` (series.js:238), `GET /api/series/:slug/tests` (series.js:358), `GET /api/tests/:id` (test.routes.js:700) | tests, test_series, series_tests |
| Instructions | TestInstructions.jsx:161 getTestById, fallback :168 getTestsBySeriesId; start countdown :264-270 | test.routes.js:700 | tests |
| Start attempt | TestInterface.jsx:372 → `POST /api/tests/:id/start` | test.routes.js:785 → TestAttemptController: attempt exists check (:29), `INSERT INTO attempts` (:47), `INSERT INTO question_attempts` per junction row (:89-114) | attempts, question_attempts |
| Autosave | TestInterface.jsx:606/762 → `PUT /api/tests/:id/autosave` | test.routes.js:927 → updateAttemptState (:149-196): UPDATE attempts + UPDATE question_attempts (:187) | attempts (answers JSONB), question_attempts |
| Submit | TestInterface.jsx:1262 → `PUT /api/tests/:id/submit` | test.routes.js:970 → submitAttempt (row lock :225, UPDATE attempts SET status='completed', score… :278) | attempts |
| Result | TestResult.jsx:121-122 → `/result/:attemptId` else `/result` | test.routes.js:1283 (computes from attempts.answers JSONB) / :1340 (union of results:1354 + attempts:1363) | attempts |
| Review | TestReview.jsx:32 → `GET /api/tests/:id/result` (state-based if available) | test.routes.js:1340 | attempts |

**Verdict: ⚠️ WORKS (attempts table is the single source of truth), with these break points:**

1. **`results` table is NEVER written anywhere in the backend** (0 rows; only readers:
   test.routes.js:1354, achievements.js:291, leaderboards-public.js:27, analyticsService).
   Everything user-facing still works because `/result` falls back to `attempts`, but:
   - `GET /api/leaderboards` (public) returns `source:'empty'`, `data: []` always
     (leaderboards-public.js:29-31).
   - Achievements are broken: calculateUserStats (achievements.js:278-308) reads
     `results` → `testsCompleted: 0`, `dayStreak: 0` for every user despite attempts.
2. **Per-question state for admin-created questions**: TestAttemptController
   initializeQuestionStates (TestAttemptController.js:89-114) loads questions ONLY from
   the `test_questions` junction — questions inserted via admin `POST /admin/questions`
   (which writes only `questions`, see W2) never get `question_attempts` rows, so
   marked-for-review/resume state is silently missing for them (answers still persist
   via attempts.answers JSONB, so the core loop works).
3. **TestInstructions fallback navigation** (TestInstructions.jsx:287-289): if
   `series.slug` is unresolved it navigates to `/test/:seriesId/:testId/instructions`
   — re-entering the same page (possible redirect loop; low severity, only with
   malformed series records).
4. `test_attempts` (528 rows, legacy) is a *different* table — read only by admin stats
   (admin-stats.js:18); the student `attempts` table (22 rows) is what W1 actually uses.

---

## W2 — Admin flow (create series → create test → add questions → assign → publish → visible)

| Step | Frontend (admin-panel) | Backend route | Tables |
|---|---|---|---|
| Login | authAPI.login; isAdmin check `user?.role==='admin'` (AuthContext.jsx:324) | `POST /api/auth/login`; `admin` middleware gates `/api/admin` (app-port5001.js:696) | users |
| Create test series | TestSeriesManager.jsx → adminAPI.createTestSeries | `POST /api/admin/test-series` (admin-test-series.js:128) | test_series |
| Create test (draft) | TestsManager.jsx:2143 → adminAPI.createTest | `POST /api/admin/tests` (admin-tests.js:415, status:'draft' default :467) | tests |
| Add questions | QuestionsManager.jsx (page/limit 50, :547/568/1056) → adminAPI.createQuestion | `POST /api/admin/questions` (admin-questions.js:533) — auto question_number (MAX+1), `insertOne` into **`questions` ONLY** (:601). **Does NOT write `test_questions` junction** | questions |
| Assign series | TestSeriesManager.jsx:518 → PUT `/admin/tests/:id/reassign` | admin-tests.js:913 | tests.series_id |
| Publish | TestsManager.jsx:2246 → adminAPI.publishTest | `POST /api/admin/tests/:id/publish` (admin-tests.js:730) — validates duration>0, question count via `questions` WHERE test_id AND is_active, then status='published', is_active=true | tests |
| Student visibility | testsAPI.getAll | test.routes.js:543 (needs published+is_active) | tests |
| Student question load | questionsAPI.getByTestId | `GET /api/questions/test/:testId` (questions.js:45) — reads `questions` WHERE test_id AND is_active=true (works without junction) | questions |

**Verdict: ⚠️ WORKS for the user-facing read path, with one structural gap:**

- **`test_questions` junction is NOT written by the admin question create/edit/delete
  endpoints.** Evidence: junction writers are testBuilder.service.js:326,
  test.repository.js:70, questionBuilder.service.js, importers, and the duplicate-test
  path (admin-tests.js:572) — but NOT admin-questions.js. Live row counts back this up:
  1575 questions vs 1375 junction rows (≈200 admin-created questions absent).
  Consequence: student sees the questions (`GET /api/questions/test/:testId` reads
  `questions.test_id`), but the attempt engine never initializes their
  `question_attempts` state (TestAttemptController.js:92 — junction-only join) →
  mark-for-review/resume/timer state broken for those questions (answers still saved to
  `attempts.answers` JSONB). Publish validation can't detect this: it counts
  `questions` rows, not junction rows.
- Series/tests/questions/publish/reassign all verified working; admin stats card
  "Tests Attempted" reads `test_attempts` (528 legacy rows) not `attempts` (22) —
  number shown to admins is inflated ~24x vs actual attempts.

---

## W3 — Payments flow (plans → order → verify → webhook)

| Step | Frontend | Backend route | Tables |
|---|---|---|---|
| Plans display | Pass.jsx:21-89 — **hardcoded DEFAULT_PLANS** (no API call) | (never hit) — `GET /api/subscriptions/plans` exists (subscriptions.js:10 → SubscriptionService.js:215-220 reads subscription_plans WHERE is_active ORDER BY sort_order) | subscription_plans |
| Admin plan mgmt | SubscriptionPlansManager → `/admin/subscription-plans` | EXISTS — admin.js:2943-2985 AND admin-commerce.js:253-283 (both mounted) ✅ | subscription_plans |
| Coupon apply | Pass.jsx:197 → `POST /api/payments/apply-coupon` | **❌ NO SUCH ROUTE** — backend has `POST /api/payments/validate-coupon` (payments.js:102, reads coupons.code+isActive+validFrom) | coupons |
| Create order | Pass.jsx:226-238 → `POST /api/payments/create-order` | payments.js:129; non-prod → **mock order** `order_${Date.now()}` (:183-194) | (mock, no write) |
| Verify | Pass.jsx:239-245 — sends **fake** `razorpay_payment_id: pay_${Date.now()}_${userId}` + **fake** `razorpay_signature: sig_sandbox_${Date.now()}` | payments.js:242 — signature validation **bypassed for mock orders** (:254-258) | — |
| Webhook (real capture) | — | payments.js:413 — RAZORPAY_WEBHOOK_SECRET via timingSafeEqual; idempotency via transactions lookup (:462); updates users (isProUser, pro_expiry), transactions, coupons. **Does NOT write webhook_events** | users, transactions, coupons |
| Admin view | Transactions page → `/admin/payments/transactions` (admin-payments.js:56); Webhooks page (:249) | reads webhook_events with try/catch fallback (:252-254) → **always empty** | transactions, webhook_events (never written) |

**Verdict: ❌ BROKEN for real money in production:**

1. **A production purchase can never complete.** Pass.jsx:239-245 fabricates the
   Razorpay payment id and signature client-side. The backend's real signature check
   (payments.js:245-253) will always reject them; only the *mock-order bypass*
   (:254-258) accepts them, and that path exists for non-prod testing. With real
   Razorpay keys set, every verify fails. There is **no Razorpay Checkout UI anywhere**
   in the codebase.
2. **Coupon apply is a guaranteed 404** (`/apply-coupon` doesn't exist; frontend never
   calls `/validate-coupon`). Discount codes are dead in the user flow.
3. **webhook_events is an orphan table** — never written; the admin Webhooks page is
   permanently empty (only `GET /api/admin/payments/webhooks` reads it,
   admin-payments.js:249-254).
4. **Plans page ignores the DB**: Pass.jsx renders hardcoded prices; changes to
   `subscription_plans` via admin UI never reach users.

---

## W4 — Live mock tests flow

| Step | Frontend | Backend route | Tables |
|---|---|---|---|
| List upcoming | LiveTests.jsx → `GET /api/live-tests` | liveMock.routes.js:8 → liveMockService.getUpcoming (:54-75) — JOIN tests + test_series, **WHERE lt.is_active AND lt.start_time > NOW()** | live_tests, tests, test_series |
| Active test | (depends on page) | `GET /api/live-tests/active` (liveMock.routes.js:28 → getActive :80-100) | live_tests, tests |
| Register | LiveTestInterface → `POST /api/live-tests/:id/register` | liveMock.routes.js:58 → register (:128-170) — **dedupe check queries `attempts.test_id = $liveTestId` but INSERTs `attempts.test_id = session.test_id` (:135 vs :163) — mismatched columns**; inserts status='registered' | attempts |
| Start | → `POST /api/live-tests/:id/start` | liveMock.routes.js:67 → startAttempt (:175+) | attempts |
| Save answer | LiveTestInterface.jsx:277 calls `POST /:id/save-answer` on every selection | **❌ STUB — liveMock.routes.js:98-100 returns `{success:true}`, performs NO DB write** | (none) |
| Submit | → `POST /api/live-tests/:id/submit` | liveMock.routes.js:76 → submitAttempt (:246+) | attempts |
| Live rank | LiveTestInterface | `GET /:id/live-rank` (liveMock.routes.js:103-110) — **fake fallback `{rank:1, totalParticipants:1}`** | (fake) |
| Leaderboard / results | LiveTestLeaderboard / LiveTestResults | `GET /:id/leaderboard` (:112), `GET /:id/results` (:121), `GET /:id/result` (:131) | attempts (+ leaderboards) |
| Admin create/edit | adminAPI.getLiveTests/createLiveTest/updateLiveTest/deleteLiveTest (adminAPI.js:220-224) | **❌ NO backend route exists** — only `GET /live-tests` at public-data.routes.js:503 (different mount); the mounted modular routes (liveMock.routes.js:49) are under `/api/live-tests`, not `/api/admin/live-tests` | — |

**Verdict: ⚠️ PARTIAL / ❌ at the edges:**

1. **Answers are silently discarded**: save-answer is a stub; the live-test attempt UI
   appears to save but nothing is persisted per-question (final submit only carries the
   aggregate payload — check LiveTestInterface submit for whether answers are included
   at submit; if not, results are empty/mock).
2. **Live list hides running tests**: getUpcoming filters `start_time > NOW()` — a live
   test disappears from `/api/live-tests` the moment it starts. There is no "live now"
   section fed by this endpoint (getActive exists but is a separate call).
3. **live-rank is fake** (rank 1 / 1 participant) unless live_rankings table has rows.
4. **Register dedupe bug**: checks the wrong column (live_tests.id vs tests.id), so
   re-registration creates duplicate `attempts` rows.
5. **Admin live-test management is dead**: all five adminAPI live-tests methods (220-224)
   target `/admin/live-tests` — 404 (the real admin create route is POST `/api/live-tests`
   liveMock.routes.js:49, which adminAPI never calls; the admin UI uses socket.io events
   `admin:live-tests:subscribe` in LiveTestMonitor.jsx:72).
6. `live-tests-public.js` (GET /, reads `tests`) is **fully shadowed** by liveMockRoutes
   (mounted at app-port5001.js:752-753 BEFORE mountExtractedRoutes :791) — dead file.

---

## W5 — Practice Lab flow

| Step | Frontend | Backend route | Tables |
|---|---|---|---|
| Tree/subjects/topics | PracticeLab.jsx:726 getTree, :266 getSubjects, :504 getChapterTopics | `GET /api/practice/tree` (practice.js:239), `/subjects` (:331), `/chapters/:id/topics` (:397), `/topics/:id/stats` (:493) | subject_topics, subjects, topics |
| Start session | PracticeLab.jsx:79 startSession | `POST /api/practice/sessions` (practice.js:535) | practice_sessions |
| Load question | PracticeSessionCanvas → `GET /sessions/:id/questions/:idx` | practice.js:728 | practice_sessions (questions) |
| Check answer | → `POST /sessions/:id/questions/:idx/check` | practice.js:748 — writes practice_answers + updates practice_sessions counters (NOT question_attempts) | practice_answers, practice_sessions |
| Skip | → `POST .../skip` | practice.js:825 | practice_sessions |
| Complete | → `POST /sessions/:id/complete` | practice.js:656 | practice_sessions, practice_streaks |
| Bookmarks | → `/bookmarks` (885), `/bookmarks/count` (913), POST/DELETE `/bookmarks/:questionId` (925/940) | all exist | question_bookmarks |
| Mistakes | `/mistakes` (957), `/mistakes/count` (990) | exist | practice_answers |
| Dashboard | PracticeLab.jsx:720 getDashboard | `GET /api/practice/dashboard` (practice.js:1010, cached 60s) | practice_streaks, practice_answers, practice_sessions, question_bookmarks |
| Fundamentals | FundamentalsGym → `/fundamentals/categories` (:1355), `/drill` (:1393), `/submit` (:1435) | all exist | fundamentals tables |
| Knowledge vault | KnowledgeVaultModal → `/vault/save` (:1603), `/vault/items` (:1623) | exist | vault tables |
| AI tutor | → `/ai/tutor` (:1644) | exists | practice_ai_cache |

**Verdict: ✅ FULLY WIRED** — every practiceAPI.js call maps 1:1 to a live route
(practice.js:239-1644). No dead endpoints, no hardcoded data, consistent table usage
(practice_* tables; deliberately separate from the test-attempt tables).

---

## Cross-cutting verdicts

| Area | Verdict |
|---|---|
| W1 student tests | ⚠️ works via `attempts`; `results`/achievements/leaderboard broken by missing writes |
| W2 admin content | ⚠️ works user-visible; `test_questions` junction never maintained by admin APIs (1575 vs 1375 rows) |
| W3 payments | ❌ cannot complete a real purchase; coupon 404; webhook_events orphan |
| W4 live mocks | ❌ save-answer stub discards answers; list hides live tests; fake rank; admin CRUD 404s |
| W5 practice | ✅ complete |