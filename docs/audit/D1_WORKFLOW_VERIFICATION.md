# D1 — End-to-End Workflow Verification (re-verified 2026-09-06)

Supersedes the Aug-23-2026 pass. Spot-checked against live code today (`apps/backend/src`,
`apps/frontend/src`). The Aug-23 break points are largely FIXED; residual caveats are
marked 🟡 (legacy-data only) or UNCLEAR (needs one mapping check).

Legend: ✅ works end-to-end · 🟡 works; residual caveat noted · ❌ broken (none open)

Line-number note: backend routes were split out of the old `test.routes.js` monolith
(no `test.routes.js` file exists on disk anymore — refs to it below are drifted Aug-23
citations; the live equivalents are cited instead).

---

## W1 — Student test-taking flow (list → details → instructions → attempt → result → review)

| Step                   | Frontend                                                                                                                     | Backend route                                                                                                                                                                     | Tables                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Login                  | `authAPI.login`                                                                                                              | `POST /api/auth/login` → users lookup, bcrypt, token                                                                                                                              | `users`                                                              |
| Dashboard staged fetch | `Dashboard.jsx` (test series, tests, attempts, exams, enrolled series)                                                       | `GET /api/series`, `GET /api/tests`, `GET /api/users/attempts`, `GET /api/exams`, `GET /api/users/enrolled-series`                                                                | `test_series`, `tests`, `attempts`, `exam_categories`, `user_series` |
| Test list filter       | `testsAPI.getAll`                                                                                                            | `tests` WHERE `is_active=true AND status='published'`                                                                                                                             | `tests`                                                              |
| Test details           | `TestDetails.jsx` (series match by slug → fallback `getTestSeriesById` → `getTestsBySeriesId`, dedupe by id; drafts dropped) | `GET /api/series/:slug`, `GET /api/series/:slug/tests`, `GET /api/tests/:id`                                                                                                      | `tests`, `test_series`, `series_tests`                               |
| Instructions           | `TestInstructions.jsx` (real slug fallback; single truthful "Full Test" section)                                             | test details route                                                                                                                                                                | `tests`                                                              |
| Start attempt          | `TestInterface.jsx` → `POST /api/tests/:id/start`                                                                            | `TestAttemptController.createAttempt` (user lock, attempt-number, `INSERT INTO attempts`, `initializeQuestionStates`)                                                             | `attempts`, `question_attempts`                                      |
| Autosave               | `TestInterface.jsx` → `PUT /api/tests/:id/autosave`                                                                          | `updateAttemptState`: UPDATE `attempts` + UPDATE `question_attempts`                                                                                                              | `attempts` (answers JSONB), `question_attempts`                      |
| Submit                 | `TestInterface.jsx` → `PUT /api/tests/:id/submit`                                                                            | `attempt.service.js` submit (row lock, UPDATE `attempts SET status='completed', score…`, **dual-write `INSERT INTO results` `:346-372`**, section scores, `test_submitted` event) | `attempts`, `results`, `attempt_section_scores`                      |
| Result                 | `TestResult.jsx` → `/result/:attemptId` else `/result`                                                                       | Result readers over `results` with `attempts` fallback                                                                                                                            | `results`, `attempts`                                                |
| Review                 | `TestReview.jsx` → `GET /api/tests/:id/result`                                                                               | Same result path                                                                                                                                                                  | `results`, `attempts`                                                |

**Verdict: ✅ WORKS. Closed Aug-23 break points:**

1. **`results` dual-write FIXED** — `attempt.service.js:346-372` persists
   `attempt_id/user_id/test_id/series_id/score/total_marks/percentage/time_taken` inside
   the submit transaction (best-effort, warns on failure). Public leaderboard now resolves
   `leaderboards → results → attempts` (`leaderboards-public.js:19-35`) instead of always
   `source:'empty'`. 🟡 Caveat: `achievements.js:289-308` reads `results` with camelCase
   flags (`userId/isCompleted/isActive`) — UNCLEAR whether `dbHelpers` maps them to
   snake_case; verify the mapping or stats stay zeroed despite written rows.
2. **Junction gap FIXED for new writes** — `admin-questions.js:63-97`
   (`syncTestQuestionsJunction`) inserts the `test_questions` row on admin question
   create. `TestAttemptController.js:120-130` is still junction-only by design;
   residual = legacy rows predating the helper (optional backfill, not a code bug).
3. **TestInstructions loop FIXED** — real `/test/:seriesId/:testId/instructions` fallback,
   named online/offline handler cleanup (see fix log).
4. **`test_attempts` stats PARTIAL** — `admin-stats.js:72` primary counts `attempts`;
   `:107` fallback still counts legacy `test_attempts`. Correct on primary; keep fallback
   until no deployment needs it.

---

## W2 — Admin flow (create series → create test → add questions → assign → publish → visible)

| Step                  | Frontend (admin-panel)                                    | Backend route                                                                                                       | Tables                        |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Login                 | `authAPI.login`; `role==='admin'` gate                    | `POST /api/auth/login`; `protect → admin` gates `/api/admin`                                                        | `users`                       |
| Create test series    | `TestSeriesManager.jsx` → `adminAPI.createTestSeries`     | `POST /api/admin/test-series`                                                                                       | `test_series`                 |
| Create test (draft)   | `TestsManager.jsx` → `adminAPI.createTest`                | `POST /api/admin/tests` (draft default)                                                                             | `tests`                       |
| Add questions         | `QuestionsManager.jsx` → `adminAPI.createQuestion`        | `POST /api/admin/questions` — writes `questions` **+ syncs `test_questions` junction** (`admin-questions.js:63-97`) | `questions`, `test_questions` |
| Assign series         | `TestSeriesManager.jsx` → `PUT /admin/tests/:id/reassign` | `admin-tests.js` reassign                                                                                           | `tests.series_id`             |
| Publish               | `TestsManager.jsx` → `adminAPI.publishTest`               | `POST /api/admin/tests/:id/publish` (validates duration, question count, then `published` + active)                 | `tests`                       |
| Student visibility    | `testsAPI.getAll`                                         | published + active filter                                                                                           | `tests`                       |
| Student question load | `questionsAPI.getByTestId`                                | `GET /api/questions/test/:testId` (`questions` WHERE `test_id`, active)                                             | `questions`                   |

**Verdict: ✅ WORKS.** Junction is now maintained on the admin write path; publish,
reassign, stats, and visibility verified.

---

## W3 — Payments flow (plans → order → verify → webhook)

| Step                   | Frontend                                                                                              | Backend route                                                                                                                                          | Tables                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Plans display          | `Pass.jsx:117-152` — live `GET /api/subscriptions/plans` (no hardcoded plans; empty state on failure) | `SubscriptionService` reads `subscription_plans WHERE is_active ORDER BY sort_order`                                                                   | `subscription_plans`                                 |
| Admin plan mgmt        | `SubscriptionPlansManager` → `/admin/subscription-plans`                                              | Exists in `admin.js` + `admin-commerce.js`                                                                                                             | `subscription_plans`                                 |
| Coupon apply           | `Pass.jsx:176` → `POST /api/payments/apply-coupon`                                                    | ✅ Alias exists (`payments.js:235-272`, same helper as `/validate-coupon` `:194-233`)                                                                  | `coupons`                                            |
| Create order           | `Pass.jsx:226-238` → `POST /api/payments/create-order`                                                | `payments.js:277+`; mock order ONLY when `NODE_ENV !== "production"` (`:354-355`)                                                                      | orders (mock in non-prod)                            |
| Verify                 | Real Razorpay Checkout (`checkout.js` `:202`, handler `:302-310`) → `POST /api/payments/verify`       | HMAC verification; mock bypass ONLY non-prod (`:441-442`); entitlement derived from server order, not client `planId`                                  | `users`, `transactions`, `coupons`                   |
| Webhook (real capture) | —                                                                                                     | `payments.js:711+` — raw-body HMAC, idempotency via transactions lookup, **`persistWebhookEvent` (`:750+`) writes `webhook_events`** (migration `120`) | `users`, `transactions`, `coupons`, `webhook_events` |
| Admin view             | Transactions page → `/admin/payments/transactions`; Webhooks page                                     | Reads `transactions` + `webhook_events`                                                                                                                | `transactions`, `webhook_events`                     |

**Verdict: ✅ WORKS for real money.** Coupon alias + real Checkout + non-prod-gated mock

- persisted webhooks close all four Aug-23 break points. Sandbox mock payloads
  (`pay_mock_*`/`sig_sandbox_*`, `Pass.jsx:270-275`) fire only on the mock branch.

---

## W4 — Live mock tests flow

| Step                      | Frontend                                                            | Backend route                                                                                                           | Tables                                                  |
| ------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| List live/upcoming/ended  | `LiveTests.jsx` → `GET /api/live-tests`                             | `live-tests-public.js` (SQL-level live/quiz filtering + read replica + cache) composed with session routes (`:162-163`) | `tests`, `test_series`, `attempts` (participant counts) |
| Active / register / start | `LiveTestInterface` → `/:id/register`, `/:id/start`, `/:id/attempt` | `liveMock.routes.js` → `liveMockService` (register dedupe corrected, `INSERT/UPDATE attempts`)                          | `attempts`                                              |
| Save answer               | `LiveTestInterface` → `POST /:id/save-answer`                       | ✅ Persists via `liveMockService.saveAnswer` (`liveMock.routes.js:129-142`)                                             | `attempts`                                              |
| Submit                    | → `POST /api/live-tests/:id/submit`                                 | `liveMockService.submitAttempt`                                                                                         | `attempts`                                              |
| Live rank                 | `LiveTestInterface` → `GET /:id/live-rank`                          | ✅ Real computed rank; 404 until a completed result exists (`liveMock.routes.js:145-163`)                               | `attempts` (+ leaderboards)                             |
| Leaderboard / results     | `LiveTestLeaderboard` / `LiveTestResults`                           | `GET /:id/leaderboard`, `/:id/results`, `/:id/result`                                                                   | `attempts` (+ leaderboards)                             |
| Admin create/edit         | `adminAPI` live-tests methods                                       | ✅ `api/routes/admin-live-tests.js` (CRUD + bulk + proctoring), mounted at `/admin/live-tests` (`admin.js:60,122`)      | `live_tests`, `tests`                                   |

**Verdict: ✅ WORKS.** All five Aug-23 break points closed: save-answer persists, list
covers live/upcoming/ended via composed filtering, rank is real, register dedupe
corrected, admin CRUD routable behind the full admin chain.

---

## W5 — Practice Lab flow

Unchanged: tree/subjects/topics → sessions → questions → check/skip/complete →
bookmarks/mistakes/dashboard/fundamentals/vault/AI-tutor all map 1:1 to `practice.js`
routes over the deliberately separate `practice_*` tables.

**Verdict: ✅ FULLY WIRED (still green).**

---

## Cross-cutting verdicts

| Area             | Verdict                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| W1 student tests | ✅ works via `attempts` + `results` dual-write (one `dbHelpers` mapping check open) |
| W2 admin content | ✅ works; junction maintained on write path (legacy rows residual only)             |
| W3 payments      | ✅ real purchases complete; coupon alias + Checkout + webhook persistence live      |
| W4 live mocks    | ✅ save-answer persists; real rank; admin CRUD routable                             |
| W5 practice      | ✅ complete                                                                         |
