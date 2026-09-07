# D3 — Dead / Unused / Disconnected Inventory (re-verified 2026-09-06)

Supersedes the Aug-23-2026 pass. Spot-checked against live code today; §1 is fully
FIXED and most of §3 is reconnected. Remaining flags are marked ⏳ (genuine) or LOW.

Regen: `grep -rn "apply-coupon\|admin/live-tests\|analytics/:testId" apps/backend/src apps/frontend/src apps/admin-panel/src`

## 1. Endpoints called by frontend that DO NOT exist on backend

| Caller                                | Call                                              | Status 2026-09-06                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/public/Pass.jsx:176`           | `POST /api/payments/apply-coupon`                 | ✅ FIXED — alias exists (`api/routes/payments.js:235-272`, delegates to the same `validateCouponHelper` as `/validate-coupon`)                                                                        |
| `admin-panel/.../adminAPI.js:220-224` | `GET/POST/PUT/DELETE /admin/live-tests` + `/bulk` | ✅ FIXED — routable via `api/routes/admin-live-tests.js` (list/create/bulk/get/update/delete + proctoring), mounted at `/admin/live-tests` (`api/routes/admin.js:60,122`) behind the full admin chain |

## 2. Backend routes/files with no callers (dead or shadowed)

| Item                                                  | Status 2026-09-06                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test-series-public.js` (`/api/test-series`)          | LOW dedupe candidate, NOT dead — live caller `pages/public/Home.jsx:262` (`fetch("/api/test-series?limit=6")`); long-term consider unifying with `/api/series`                                                                       |
| `live-tests-public.js` (`/api/live-tests` GET)        | ✅ FIXED via composition — `live-tests-public.js:162-163` does `router.use("/", liveMockRoutes)`; single mount at `app-port5001.js:1022` serves list + session routes together (`/api/live-mock` at `:1021` is the standalone alias) |
| `subscriptions.js` `/analytics/:testId?` (`:231-232`) | ⏳ UNCLEAR — still no frontend caller found (siblings `attempt-history/:testId` `:129`, `reattempt` `:154`, `weak-topics/:testId?` `:214` ARE used). Keep flagged; either wire a caller or remove                                    |

## 3. Tables with no writers (orphans) or broken read paths

| Table             | Writers                                                                                                                              | Readers                                                                                                                                              | Status 2026-09-06                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webhook_events`  | ✅ `persistWebhookEvent` (`payments.js:750+`, called on received/delivered/failed paths) + migration `120_create_webhook_events.sql` | `admin-payments.js` webhooks view                                                                                                                    | ✅ FIXED (was orphan)                                                                                                                                                     |
| `results`         | ✅ dual-write on submit (`modules/attempts/attempt.service.js:346-372`, best-effort inside the submit transaction)                   | `leaderboards-public.js:27` → `results` → `attempts` fallback chain; `achievements.js:302-306`                                                       | ✅ FIXED (was orphan). Caveat: achievements reads with camelCase flags (`userId/isCompleted/isActive`) — verify `dbHelpers` maps them to snake_case or flag stays UNCLEAR |
| `test_questions`  | ✅ junction sync helper (`admin-questions.js:63-97`) + builder/importer/duplicate-test paths                                         | `TestAttemptController.js:120-130` (junction-only join)                                                                                              | ✅ FIXED for new writes (was admin-API gap). Residual = legacy rows predating the helper; backfill optional                                                               |
| `leaderboards`    | `leaderboardService.js` (recalculate on submit via `test_submitted` event)                                                           | `leaderboards-public.js`                                                                                                                             | ✅ Connected (recalc latency only)                                                                                                                                        |
| `attempt_answers` | `attempt.routes.js` save-answer paths + `attempt.repository.js:63`                                                                   | ✅ CONNECTED — readers: `attempt.service.js:465`, `SubscriptionService.js:255-291`, `questionDifficulty.service.js:431`, `attempt.repository.js:105` | ✅ Resolved (was UNCLEAR); no merge needed                                                                                                                                |

## 4. Admin-panel dead/unused surfaces

| Item                                                                                     | Status 2026-09-06                                                                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `adminAPI.getLiveTests/createLiveTest/updateLiveTest/deleteLiveTest/bulkUploadLiveTests` | ✅ Routable — backend `/admin/live-tests` exists (see §1); verify each method is now called from a component on next UI pass |

## 5. Legacy/ghost data

| Item                                              | Status 2026-09-06                                                                                                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test_attempts` (legacy, ~528 rows at last count) | 🟡 PARTIAL — `admin-stats.js:72` primary query now counts `attempts`; `:107` fallback still counts legacy `test_attempts`. Numbers are correct on the primary path; remove the fallback only after confirming no deployment still needs it |
| `db_live_inventory.txt` (repo root, if present)   | Failed `pg` run log, not an inventory — regenerate or delete                                                                                                                                                                               |

## 6. Verified-CLEAN (checked, no issues) + admin-chain note

- `practice.js` (40 routes) — all `practiceAPI.js` calls matched 1:1 (W5 still green).
- `intelligence.js` — all routes use live services; no stubs (only `recalculate` is admin-gated, correct).
- `achievements.js` — no dead routes (reads `results`, now written — see §3 caveat).
- `user.routes.js` — all routes have frontend callers (profile, attempts, analytics, enrolled-series, sessions, incomplete, top-performers).
- `adminAPI.getTestSeries / getTestCategories` — used (`TestSeriesManager.jsx:253`, `CategoriesManager.jsx:493`, `QuestionsManager.jsx:573-575`).
- `ReattemptOptions.jsx` → `/api/subscriptions/attempt-history|reattempt|weak-topics` — all exist (`subscriptions.js:129/154/214`).
- `examCategory.routes.js` / `examInfo.routes.js` — called by `Exams.jsx` / `ExamInfoManager`.
- `subscription-plans-public.js` — mounted; admin `SubscriptionPlansManager` hits `/admin/subscription-plans` (exists in both `admin.js` and `admin-commerce.js` — duplicate route, harmless).
- Admin middleware chain (do not bypass): `normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect → admin → validateCsrfToken → loadAdminPermissions → requireAdminPermission → auditMiddleware` (`api/routes/admin.js:65-80`).
