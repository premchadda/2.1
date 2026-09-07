# Trstprep V2.1 — Development Guide

> **As-of:** 2026-09-06. Ports: frontend **3000**, admin-panel **3002**, backend **5001**.
> Package manager: **pnpm 11.25** (workspaces) + **turbo ^2.10.12**; Python tooling via **uv**.
> Never use npm. No secrets in this file — names only.
> Counts regen: `node scripts/run-database-audit.js`,
> `dir /b apps\backend\src\api\routes\*.js`, `/graphify --update`.

---

## 1. Prerequisites

- Node.js 20 (`.nvmrc`), `pnpm 11.25`, `uv` (Python), Docker (for Postgres/Redis or deploy), Git + Husky.
- PostgreSQL (Supabase) + Redis reachable via env names `DATABASE_URL` / `DATABASE_READ_URL` / `REDIS_URL`.
- Install: `pnpm install` (repo root). Python tools: `uv sync` (`.venv`).

---

## 2. Run it

| App           | Command                                                                                                           | URL                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Backend       | `pnpm --filter backend dev` (watches `src/api`, `src/modules`, `src/services`, … per `apps/backend/package.json`) | `:5001` (`src/app-port5001.js` — the ONLY entry; there is no `app.js`) |
| Frontend      | `pnpm --filter frontend dev` (waits for backend via `scripts/wait-for-backend.mjs`, then `vite`)                  | `:3000` — **not 5173** (`apps/frontend/vite.config.js`: `port: 3000`)  |
| Admin panel   | `pnpm --filter admin-panel dev`                                                                                   | `:3002`                                                                |
| All (ordered) | `node scripts/dev-sequential.mjs`                                                                                 | boots backend → frontend → admin-panel                                 |

Build all: `pnpm build` (turbo). Lint/format via Husky pre-commit + lint-staged.

---

## 3. Scripts directory (canonical — `dev-tools/` does NOT exist)

All ops scripts live in `scripts/`. Do not reference `dev-tools/` (removed).

| Script                          | Purpose                                                                   |
| ------------------------------- | ------------------------------------------------------------------------- |
| `scripts/run-database-audit.js` | **Run BEFORE any migration/DDL** — live-schema ground truth (~154 tables) |
| `scripts/dev-sequential.mjs`    | Ordered multi-app dev boot                                                |
| `scripts/wait-for-backend.mjs`  | Gate frontend/admin dev servers on backend readiness                      |
| `scripts/sync-repo-brain.mjs`   | Refresh `docs/REPO_BRAIN.html` markers (`--check` for CI staleness guard) |

---

## 4. Repo paths that matter (correct as of 2026-09-06)

```text
apps/frontend/src/                    User SPA (87 pages)
apps/admin-panel/src/features/admin/  Admin UI — 60+ components (THIS is the path)
apps/backend/src/app-port5001.js      Single Express entrypoint
apps/backend/src/api/routes/          80+ route files (admin-* split routers + public)
apps/backend/src/api/routes/admin.js  Admin aggregator + full middleware chain (:65-80)
apps/backend/src/modules/             Domain modules (auth, tests, attempts, live, ai…)
apps/backend/src/services/core/       TestPolicyEngine, studyRoadmap/socraticHint/examReadiness
apps/backend/src/constants/lifecycle.constants.js   Lifecycle enums (source of truth in code)
apps/backend/src/infrastructure/database/migrations/ 000–135 (next 136_*)
packages/shared-config/src/           apiClient, logger, errors, coming-soon-config, csrf-token-store
packages/shared-hooks/                useAuth, useProPass
```

> `apps/frontend/src/features/admin/` does **NOT** exist. All admin UI paths are
> `apps/admin-panel/src/features/admin/`.

---

## 5. Admin panel implementation (60+ components, 13 groups)

Count regen: `dir /s /b apps\admin-panel\src\features\admin\*.jsx | find /c`.

- **Dashboard & analytics (3):** `AdminDashboard.jsx` (`GET /admin/stats`), `AdminAnalytics.jsx`, `DeepAnalytics.jsx` (funnel/cohort/engagement).
- **Content & assessments (12+):** `ContentManagement.jsx`, `TestSeriesManager.jsx`, `TestsManager.jsx`, `QuestionsManager.jsx` (+ bulk import/restore), `SubjectHierarchyManager.jsx` (curriculum tree), quiz/test-category managers.
- **Live & proctoring:** `LiveProctoringConsole.jsx` (waves 19–20), live-test managers.
- **Commerce:** coupon/plan/order managers (`GET /admin/...`, Razorpay verify server-side).
- **System:** `ServerLogsManager.jsx` (log stream/export/fingerprint), backups, settings, moderation, recycle bin (soft-delete restore), roles/permissions (`superAdmin` exists above `admin`).
- **Nav:** 38 nav items from `adminNavConfig` — KNOWN DUPLICATION across `packages/shared-config` + both apps (see `docs/ARCHITECTURE.md` §7); consolidate deliberately, don't hand-diverge.
- **Routing:** React Router v6; **API client:** Axios 1.18 (`apiClient`, baseURL `/api`, httpOnly cookies + CSRF).

---

## 6. Backend admin routers (split — no monolith)

`apps/backend/src/api/routes/admin.js` aggregates ~40 modular routers:
`admin-questions.js`, `admin-tests.js`, `admin-test-series.js`, `admin-catalog.js`,
`admin-categories.js`, `admin-curriculum.js`, `admin-sections.js`, `admin-stages.js`,
`admin-exams.js`, `admin-content.js`, `admin-commerce.js`, `admin-payments.js`,
`admin-users.js`, `admin-roles.js`, `admin-enrollments.js`, `admin-analytics.js`,
`admin-deep-analytics.js`, `admin-activity.js`, `admin-audit.js`, `admin-logs.js`,
`admin-moderation.js`, `admin-import.js`, `admin-bulk-ops.js`, `admin-realtime.js`,
`admin-recycle-bin.js`, `admin-sessions.js`, `admin-settings.js`, `admin-stats.js`,
`admin-assets.js`, `admin-backups.js`, `admin-coming-soon.js`, `admin-dynamic-content.js`,
`admin-email-templates.js`, `admin-navigation*.js`, `admin-live-tests.js`,
`leaderboards-admin.js`, … (regen: `dir /b apps\backend\src\api\routes\admin-*.js`).

Every `/api/admin/*` request passes (in order):
`normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect → admin →
validateCsrfToken → loadAdminPermissions → requireAdminPermission → auditMiddleware`
(`admin.js:65-80`). Guard rails: respect `aiRateLimiter`, publish via `MessageBroker`
(Redis Pub/Sub + BullMQ), write `audit_trail` entries.

---

## 7. Former debt — now SHIPPED (invert any old notes claiming otherwise)

| Item                          | Status 2026-09-06                                                                |
| ----------------------------- | -------------------------------------------------------------------------------- |
| CSRF protection               | SHIPPED (`csrf.middleware.js`, `validateCsrfToken` in admin chain)               |
| Refresh-token rotation        | SHIPPED                                                                          |
| Email (spool + retry)         | SHIPPED (Nodemailer 9.x / SendGrid / SES)                                        |
| Razorpay verify               | SHIPPED (server-side `orders.fetch`)                                             |
| Socket.IO realtime            | SHIPPED (4.x + Redis adapter)                                                    |
| Redis / BullMQ                | SHIPPED (queues: analytics, leaderboard, notifications, recommendations, outbox) |
| 2FA                           | SHIPPED (migration `064`)                                                        |
| Audit trail                   | SHIPPED (`auditMiddleware` + `audit_trail` table)                                |
| `superAdmin` role             | EXISTS                                                                           |
| Live-tests alias              | FIXED (`live-tests-public.js:162-163`)                                           |
| Leaderboards public           | FIXED (`leaderboards-public.js:10` optionalAuth)                                 |
| testCategories reassign guard | FIXED (`testCategories.js:140` protect+admin)                                    |
| Avatar 404 / prop-types build | FIXED                                                                            |

---

## 8. Database workflow

1. `node scripts/run-database-audit.js` — ground truth first (~154 tables live).
2. Migrations `000`–`135` on disk; baseline via `003` + `098_reconstructed_baseline.sql` + `108` + `121`. Next file: `136_*`.
3. Write pool = `DATABASE_URL`, read pool = `DATABASE_READ_URL` (fallback: primary).
4. Migration `008` notes: `user_id` UUID→INTEGER standardisation, `test_category_series` junction, soft-delete pattern, audit trail. RLS policies consolidated in `099`/`116` (still under review — see living scorecard).
5. Never log/echo/commit secrets. PII guard: CI `data-guard.yml` fails on PII keys.

---

## 9. Test lifecycle enforcement (for devs)

Contract: `docs/test-quiz-lifecycle.md`. Code:
`src/constants/lifecycle.constants.js:6-107` (enums + `ATTEMPT_STATE_TRANSITIONS` +
`isValidAttemptTransition`), `src/services/core/TestPolicyEngine.js`.
Tests: `attemptLifecycle` / `testPolicyEngine` / `mockTestEngineSimulation`.
`TEST_STATES` wire values are **lowercase** (`draft`, `published`, `live`, …);
attempt states are 10 incl. `abandoned`.

---

## 10. AI surface (for devs)

Shipped: `POST /api/ai/mentor`, `/api/ai/explanation` (`app-port5001.js:1015-1016`),
`/api/ai/logs`, intelligence router (`api/routes/intelligence.js` →
`studyRoadmapService` / `socraticHintService` / `examReadinessService`).
Gateway: OpenRouter (`OPENROUTER_*`); limits: `AI_RATE_LIMIT_*` + `aiRateLimiter`.
Node Engine truth table in `docs/AI_PROMPTS.md` — V3–V6 is vision (`docs/vision/`).

---

## 11. Troubleshooting

| Symptom                              | Check                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Frontend shows 5173 anywhere         | Stale doc — real port is **3000** (`vite.config.js`)                                  |
| `dev-tools/...` path fails           | Removed — use `scripts/...`                                                           |
| Admin 403 from localhost             | `restrictAdminOrigin` + `validateAdminApiKey` — set admin origin/key env (names only) |
| Admin 403 with valid login           | Missing RBAC grant (`loadAdminPermissions`/`requireAdminPermission`) or CSRF token    |
| Fresh-DB missing core tables         | Expected history — baseline via 003/098/108/121; run DB audit first                   |
| Backend won't start on fresh DB      | Check migration runner halt (historical: `105` index-on-missing-table class of error) |
| `features/admin` missing in frontend | Correct — it lives in **admin-panel**, not frontend                                   |
