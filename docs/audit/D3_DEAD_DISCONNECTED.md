# D3 — Dead / Unused / Disconnected Inventory (Aug 14, 2026)

## 1. Endpoints called by frontend that DO NOT exist on backend

| Caller | Call | Backend reality |
|---|---|---|
| Pass.jsx:197 (user frontend) | `POST /api/payments/apply-coupon` | **404** — only `/api/payments/validate-coupon` exists (payments.js:102) |
| adminAPI.js:220-224 (admin-panel) | `GET/POST/PUT/DELETE /admin/live-tests` + `/admin/live-tests/bulk` | **404** — no route file matches; only `GET /live-tests` exists at public-data.routes.js:503 (different mount); real admin create is `POST /api/live-tests` (liveMock.routes.js:49) which adminAPI never calls |
| Admin LiveTestMonitor | socket.io `admin:live-tests:subscribe` (LiveTestMonitor.jsx:72) | Works only if backend socket adapter handles it — verify separately; REST methods are dead regardless |

## 2. Backend routes/files with no callers (dead or shadowed)

| Item | Evidence |
|---|---|
| `test-series-public.js` (`/api/test-series`) | Mounted at public-routes-index.js:30 but **zero frontend callers** — user frontend uses `/api/series` everywhere; candidate for removal |
| `live-tests-public.js` (`/api/live-tests` GET) | Fully **shadowed**: liveMockRoutes mounted first (app-port5001.js:752-753 vs mountExtractedRoutes :791). Dead code — reads `tests` table, never reachable |
| `subscriptions.js` `/analytics/:testId?` (:212) | No frontend caller found (attempt-history :121, reattempt :148, weak-topics :197 ARE used — ReattemptOptions.jsx:30/48/230) |

## 3. Tables with no writers (orphans) or broken read paths

| Table | Writers | Readers | Impact |
|---|---|---|---|
| `webhook_events` | **NONE anywhere in backend** | admin-payments.js:252 (try/catch fallback), API_ENDPOINTS.md:283 | Admin "Webhooks" page permanently empty; payment webhook (payments.js:413) writes only transactions/users/coupons |
| `results` | **NONE** | test.routes.js:1354, achievements.js:291, leaderboards-public.js:27 | Public leaderboard always `source:'empty'`; achievements/streaks zeroed (see D1-W1) |
| `test_questions` | testBuilder.service.js:326, test.repository.js:70, questionBuilder.service.js, question.service.js, question.repository.js, importers, admin duplicate path (admin-tests.js:572) | TestAttemptController.js:92, test.routes.js question fetch paths | **No admin-API writer**: admin-questions.js:533 writes only `questions` → 1575 questions vs 1375 junction rows; per-question attempt state missing for admin-created questions |
| `leaderboards` | leaderboardService.js:200/235 (recalculate on submit via test_submitted event) | leaderboards-public.js:19/122 | Works — written by submit event; only recalc latency matters |
| `attempt_answers` | attempt.routes.js (save-answer) | Not read by W1 flow (answers live in `attempts.answers` JSONB) | Redundant write path; verify reader or merge |

## 4. Admin-panel dead/unused surfaces

| Item | Evidence |
|---|---|
| `adminAPI.getLiveTests/createLiveTest/updateLiveTest/deleteLiveTest/bulkUploadLiveTests` | Defined (adminAPI.js:220-224), never called from any component (grep: only LiveTestMonitor socket usage) AND would 404 — fully dead |

## 5. Legacy/ghost data

| Item | Evidence |
|---|---|
| `test_attempts` (528 rows) | Read ONLY by admin-stats.js:18 for "Tests Attempted" card → admins see 528 vs 22 real attempts (24x inflation); legacy table from pre-migration era |
| `db_live_inventory.txt` (repo root) | Failed `pg` run log — not an inventory; misleading artifact |

## 6. Verified-CLEAN (checked, no issues)

- `practice.js` (40 routes) — all practiceAPI.js calls matched 1:1 (W5)
- `intelligence.js` — all routes use live services; no stubs (only `recalculate` is admin-gated, correct)
- `achievements.js` — no dead routes (broken only via `results` reads, D3-3)
- user.routes.js — all 13 routes have frontend callers (profile, attempts, analytics, enrolled-series, sessions, incomplete, top-performers)
- adminAPI.getTestSeries / getTestCategories — used (TestSeriesManager.jsx:253, CategoriesManager.jsx:493, QuestionsManager.jsx:573-575)
- ReattemptOptions.jsx:30/48/230 → `/api/subscriptions/attempt-history|reattempt|weak-topics` — all exist (subscriptions.js:121/148/197)
- examCategory.routes.js / examInfo.routes.js — all called by Exams.jsx:229 / ExamInfoManager
- `subscription-plans-public.js` — mounted; admin panel SubscriptionPlansManager hits `/admin/subscription-plans` which exists in BOTH admin.js:2943 and admin-commerce.js:253 (duplicate route, harmless)