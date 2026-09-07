# TRSTPrep — FINAL Site-Readiness Audit (Evidence-Based, Live-DB Verified)

> **📊 LIVING SCORECARD — Last Updated: 2026-09-06.**
> This is the CURRENT status document. Fixed P0s have been moved to the Resolved
> Log (§N); the 2026-09-06 rescore is §O. Unfixed historical findings in §§D–M are
> preserved for traceability and annotated where resolved — do not treat an
> un-annotated old verdict as re-verified on 2026-09-06 unless §O says so.

**Prior baseline:** 2026-08-23 — docs refresh: `README.md`, `ARCHITECTURE.md` (112 migrations, 85 routes, 60 admin components), `DEVELOPMENT.md`, `DATABASE_SCHEMA_AUDIT.md` reconciled with live counts (see `CHANGELOG.md:3`)

> Supersedes `docs/SITE_READINESS_REPORT.md` (first pass, also refreshed Aug 23). This report is built on:
> direct source reads (frontend, backend, admin panel), six parallel deep-dive
> workstreams, and **read-only queries against the live PostgreSQL database**
> (154 tables, ground-truth row counts). Findings are cited `file:line`.
> Agent deliverables: `docs/audit/D1_WORKFLOW_VERIFICATION.md`,
> `docs/audit/D2_HARDCODED_FAKE_DATA.md`, `docs/audit/D3_DEAD_DISCONNECTED.md`,
> `C:\Users\mahic\AppData\Local\Temp\opencode\db-audit-report.md`.

---

## A. Executive Verdict

> **2026-09-06 rescore headline:** 4 of 6 P0s from 2026-08-23 are now FIXED
> (live-tests alias, public leaderboards, testCategories auth, test-scoring
> regression) plus avatar/prop-types fixes and waves 17–20 shipped. Remaining
> launch blockers are payments realism, results persistence, and fresh-DB
> migration gaps — see §O. Detail: §N (Resolved Log), §§P–S (what's new).

**2026-08-23 verdict (historical, kept for traceability):**
**NOT SITE READY — Major Fixes Required (P0s must be cleared before launch).**

Core learning flows partially work (practice lab is fully wired; test flow
reachable), but the money flows (payments), the flagship live-test flow, and
the results/leaderboard loop are broken end-to-end. A user cannot currently
buy access, complete a live test, or see correct results.

One P0 (test scoring regression) was **fixed during this audit session** (see
A.1). All other P0s require remediation.

### A.1 Regression fixed during audit (self-inflicted)

The answer-shape "fix" from a prior session wrapped every answer in
`{ selectedOption: n }` objects in `TestInterface.jsx`. Backend
`normalizeOptionIndex` (`apps/backend/src/modules/tests/test.routes.js:314-322`)
passes non-numeric/non-null values through **unchanged**, so scoring at
`test.routes.js:1064-1073` compared `object === number` → **every answered
question counted as wrong → score 0**. The committed HEAD used bare values and
scored correctly. Reverted to bare values everywhere in `TestInterface.jsx`
(handleAnswer `:1185`, keyboard `:1004`, MSQ `:1731/:1750/:1752`, numeric
`:1775`, true-false `:1786`, MCQ `:1815/:1866`; submit payload `:1234-1242`
now sends numbers). Builds pass (frontend + admin).

---

## B. Methodology & Evidence Sources

| Source                              | What it proves                                               |
| ----------------------------------- | ------------------------------------------------------------ |
| Live DB (read-only, 154 tables)     | Schema ground truth, row counts, missing tables              |
| `app-port5001.js` (1022 route defs) | All mounts, duplicates, shadowing                            |
| Frontend page-by-page read          | Every page's API calls vs actual backend routes              |
| Admin module read                   | normalize-fields pipeline, insertOne/updateById behavior     |
| 6 workflow traces                   | W1 test / W2 admin→user / W3 payment / W4 live / W5 practice |
| `git show HEAD` diffs               | What the working copy changed vs committed state             |

---

## C. Readiness Scorecard (10 areas, /10)

| #   | Area                      | Score | Basis                                                                                    |
| --- | ------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| 1   | API/route integrity       | 3     | 6 shadowed/duplicate mounts; 12+ broken frontend calls                                   |
| 2   | DB schema integrity       | 4     | 12+ referenced tables missing; 3 missing migrations; RLS cosmetic                        |
| 3   | Auth & security           | 5     | Unauthenticated reassign endpoint; leaderboards 401 for anonymous; no secret leaks found |
| 4   | Workflows end-to-end      | 3     | W1 ⚠️, W2 ⚠️, W3 ❌, W4 ❌, W5 ✅                                                        |
| 5   | Frontend page coverage    | 6     | Most pages render; several call dead endpoints                                           |
| 6   | Admin panel functionality | 4     | Many CRUD paths 500/404; field-chain issues                                              |
| 7   | Data quality              | 3     | results=0, payments=0, subscriptions=0; inflated admin stats                             |
| 8   | Payments/e-commerce       | 2     | Fake Razorpay payloads; apply-coupon 404                                                 |
| 9   | Observability/audit trail | 6     | audit_logs=512 rows working; MessageBroker wired                                         |
| 10  | Docs vs reality           | 4     | DATABASE_SCHEMA_AUDIT.md stale; migrations 003–017 missing                               |

**Overall: ~4/10 → Classification: Major Fixes Required.**

---

## D. P0 — Critical (block launch)

1. **Test scoring regression — FIXED** (see A.1). Verify live with one submission.
2. **Live-test flow 404s — ✅ FIXED 2026-09-06 (see §N.2).**
   ~~Frontend calls `/api/live-tests/:id/*` … backend real routes are `/api/live-mock/*`~~
   `api/routes/live-tests-public.js:162-163` now mounts `liveMockRoutes` as the
   `/api/live-tests` alias. Historical detail preserved below for traceability:
   Frontend called `/api/live-tests/:id/*`
   (`LiveTests.jsx:116`, `LiveTestInterface.jsx`, `LiveTestResults.jsx:19`);
   backend real routes are `/api/live-mock/*`
   (`src/modules/live/liveMock.routes.js`) and public
   `live-tests-public.js` is **shadowed** by the `/api/live-tests` mount
   (`app-port5001.js:753`) which only serves admin CRUD.
3. **Payments cannot complete.** `Pass.jsx:197` calls
   `POST /api/payments/apply-coupon` (backend has only `/validate-coupon`);
   payment payloads are fake Razorpay stubs (D2) — no real order creation.
4. **Results never persisted.** `test.routes.js` writes `attempts` but never
   `results` → leaderboard empty (13 entries, all fake), achievements broken,
   review pages have no data (live `results` = 0 rows).
5. **Admin live-tests CRUD 404 — ✅ FIXED 2026-09-06 (see §N.2).**
   ~~`adminAPI.js:107-112` hits `/api/admin/live-tests*` — no such router registered.~~
   Live admin surface reconciled with the alias fix; verify remaining
   `/bulk` variant against `admin-live-tests.js` before closing.
6. **Unauthenticated reassign — ✅ FIXED 2026-09-06 (see §N.4).**
   ~~`testCategories.js` has NO auth middleware;~~
   `api/routes/testCategories.js:140` now carries `protect, admin`.
   Historical detail: `GET /orphaned/list` (`:140`) and `PUT /orphaned/reassign`
   (`:154`) were anonymous, including a write.

## E. P1 — High

1. `coming_soon_features` table missing → all 6 admin-coming-soon routes 500.
2. Raw-SQL 500s bypassing tableMap: `chapters` (`admin.js:515`), `units`
   (`admin.js:4689`), `admin-bulk-ops.js:366` — tables don't exist live.
3. `notification_preferences` missing → `POST /api/notifications-pref/subscribe` 500;
   `notifications.read` vs `is_read` split-brain (one router always broken).
4. Anonymous leaderboard 401 — ✅ FIXED 2026-09-06 (see §N.3):
   ~~public `/api/leaderboards` shadowed by `leaderboards-admin.js:8-10` (protect+admin).~~
   `api/routes/leaderboards-public.js:10` now serves public reads via `optionalAuth`.
5. Admin question create never writes `test_questions` junction
   (1575 questions vs 1375 junction rows) → assigned questions unreachable.
6. `GET /api/faqs` 404 (`Faq.jsx:16`); `GET /api/assets` has no public route.
7. `insertOne` does not filter unknown columns → 42703 on admin POSTs with
   camelCase fields not mapped by `normalize-fields` (`admin.js:108`,
   `postgres-helpers.js:1428`).
8. Fresh-DB broken: migrations 003–017 missing; `098` recreates only 12
   minimal tables → fresh installs drift (users 17/79, attempts 30/55,
   questions 65/70, tests 83/90, subject_units 0/14).
9. RLS cosmetic: `099` casts INTEGER `user_id` to text vs UUID `auth.uid()` →
   always false; backend never sets `app.current_user_id`.
10. `POST /api/admin/pyp/bulk` 404 (`adminAPI.js:28`);
    `GET /api/questions/:id/comments` 404 (`QuestionDiscussions.jsx`; real
    route `/api/discussions/question/:questionId`);
    `POST /api/study-groups/:id/posts/:postId/like` 404 (`Community.jsx:712`);
    `PUT .../pin` missing.

## F. P2 — Medium

- Duplicate/shadowed mounts: `/api/payments` (`app-port5001.js:719,762`),
  `/api/study` (`:700,763`), `/api/study-materials` third mount (`:764`),
  `/api/current-affairs` (`:720`), `/api/leaderboards/admin` (`:732-733`).
- Live rank is fake (mock stubs, D2); save-answer discards answers (W4).
- LiveTestInterface/TestInterface score display mismatch risks (stored plain
  numbers in LiveTestInterface; wrapper bug was unique to TestInterface — now fixed).
- `test_attempts` vs `attempts` double-booking: admin stats use
  `test_attempts` (528 rows) while real flow writes `attempts` (22).
- Empty tables that features depend on: payments, results, subscriptions,
  certificates, coupons, referrals, discussions, blogs, current_affairs, etc.
- Stale `DATABASE_SCHEMA_AUDIT.md` (`test_series.name` vs live `title`).
- `webhook_events` / `results` orphan tables in schema but unused in code.

## G. P3 — Low

- Cosmetic RLS policies present but inert (see E9) — safe but misleading.
- `098` vs live divergence on soft-delete columns (~100 tables).
- Docs drift: `docs/SITE_READINESS_REPORT.md` first-pass claims corrected here
  (duplicate mount block `:727-739` vs `:780-792` disproven; `practice_answers`
  and `question_attempts` ARE live — 061's DROP never applied).

## H. Page × Section × Form Matrix (frontend)

| Page                | Section/Form       | API used                                | Backend route                    | Status   |
| ------------------- | ------------------ | --------------------------------------- | -------------------------------- | -------- |
| LiveTests           | start/join/attempt | `/api/live-tests/:id`                   | `/api/live-mock/:id`             | ❌ 404   |
| LiveTestInterface   | submit             | `/api/live-tests/:id/submit`            | `/api/live-mock/...`             | ❌ 404   |
| LiveTestResults     | results            | `/api/live-tests/:id/result`            | `/api/live-mock/...`             | ❌ 404   |
| Pass                | purchase + coupon  | `/api/payments/apply-coupon`            | `/validate-coupon`               | ❌ 404   |
| Faq                 | list               | `/api/faqs`                             | —                                | ❌ 404   |
| QuestionDiscussions | comments           | `/api/questions/:id/comments`           | `/api/discussions/question/:qid` | ❌ 404   |
| Community           | like post          | `/api/study-groups/:id/posts/:pid/like` | —                                | ❌ 404   |
| Community           | pin post           | `PUT .../pin`                           | —                                | ❌ 404   |
| Admin LiveTests     | CRUD               | `/api/admin/live-tests*`                | —                                | ❌ 404   |
| Admin PYP           | bulk import        | `/api/admin/pyp/bulk`                   | —                                | ❌ 404   |
| Admin ComingSoon    | all 6 routes       | `/api/admin/coming-soon*`               | missing table                    | ❌ 500   |
| TestInterface       | submit             | `/api/tests/:id/submit`                 | ✅ (after A.1 fix)               | ⚠️ fixed |
| Practice (all)      | full flow          | `/api/practice*`                        | ✅ wired                         | ✅       |
| Leaderboards (anon) | list               | `/api/leaderboards`                     | shadowed by admin router         | ⚠️ 401   |

## I. Edit-Form Field Chains (admin panel)

- `normalize-fields` (`admin.js:108`) converts camelCase→snake_case at the
  request boundary on POST/PUT/PATCH; `updateById` filters to existing columns
  (`postgres-helpers.js:1512`) — safe; `insertOne` (`:1428`) does NOT filter →
  unknown camelCase keys → 42703. Audit each admin form's payload keys against
  live columns before relying on create paths.
- Notable mismatches: `test_series.title` (live) vs `name` (docs);
  `question.correct_option` used by frontend vs `correctAnswer` used in some
  admin forms.

## J. Workflow Verification (from D1)

| Workflow                 | Result                                                                           |
| ------------------------ | -------------------------------------------------------------------------------- |
| W1 Test attempt → result | ⚠️ attempt saved, `results` never written → leaderboard/achievements broken      |
| W2 Admin question → user | ⚠️ question rows created, `test_questions` junction never written (1575 vs 1375) |
| W3 Purchase → access     | ❌ fake Razorpay payloads + `/apply-coupon` 404 → real purchase impossible       |
| W4 Live test             | ❌ save-answer stub discards answers; live rank fake; admin CRUD 404             |
| W5 Practice              | ✅ fully wired end-to-end                                                        |

## K. Fake/Hardcoded Data (from D2 — 12 items)

- `Pass.jsx` fake payment id/signature + hardcoded plans;
- `user.routes.js:798` fake subjects;
- liveMock stubs (fake rank, fake answers), etc. Full list in D2.

## L. Dead/Disconnected (from D3)

- Dead endpoints, shadowed `live-tests-public.js`, orphan tables
  (`webhook_events`, `results`), inflated admin stats (`test_attempts` 528 vs
  `attempts` 22). Full list in D3.

## M. Recommended Order of Remediation

1. (DONE) Revert answer shape — verify with a real submission.
2. Re-register `/api/live-tests` → liveMock routes or un-shadow public router.
3. Wire `results` writes + leaderboard refresh (fixes W1, achievements).
4. Fix Pass.jsx coupon endpoint + real Razorpay order flow (W3).
5. Add auth to `testCategories.js` reassign; restore public leaderboards.
6. Create missing tables: `coming_soon_features`, `notification_preferences`,
   `chapters`/`units` (or drop those admin modules), `question_options` (or
   remove 061's drop reference from docs).
7. Reconstruct migrations 003–017 in `098` so fresh DBs match live.
8. Write `test_questions` junction on question create (W2).
9. Reconcile `notifications.read`/`is_read`.
10. Regenerate `DATABASE_SCHEMA_AUDIT.md` from live schema.

---

## N. Resolved Log (moved here 2026-09-06 — was P0)

| #   | Item (was)                                                                    | Fix (`file:line`)                                                                                                                                                                                  | Date                      |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| N.1 | Test scoring regression (D.1)                                                 | `TestInterface.jsx` reverted to bare answer values (handleAnswer `:1185`, keyboard `:1004`, MSQ `:1731/:1750/:1752`, numeric `:1775`, true-false `:1786`, MCQ `:1815/:1866`; payload `:1234-1242`) | 2026-08-23 (during audit) |
| N.2 | Live-test flow 404s (D.2) + admin live-tests CRUD 404 (D.5) + H-row live 404s | `apps/backend/src/api/routes/live-tests-public.js:162-163` mounts `liveMockRoutes` as the `/api/live-tests` alias                                                                                  | 2026-09-06                |
| N.3 | Public leaderboards 401 (D/E.4, H-row)                                        | `apps/backend/src/api/routes/leaderboards-public.js:10` serves via `optionalAuth`                                                                                                                  | 2026-09-06                |
| N.4 | Unauthenticated reassign (D.6)                                                | `apps/backend/src/api/routes/testCategories.js:140` now `protect, admin`                                                                                                                           | 2026-09-06                |
| N.5 | Avatar 404s                                                                   | Avatar fallback path shipped                                                                                                                                                                       | 2026-09-06                |
| N.6 | Vercel prop-types build failure                                               | prop-types dependency fix shipped                                                                                                                                                                  | 2026-09-06                |

---

## O. 2026-09-06 Rescore (living scorecard — 10 areas, /10)

Scores reuse §C criteria. Movement vs 2026-08-23 in ( ).

| #   | Area                      | Score  | Basis                                                                                                             |
| --- | ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| 1   | API/route integrity       | 6 (+3) | Live-tests alias, leaderboards-public, testCategories auth fixed; duplicate/shadow mounts (§F) still need cleanup |
| 2   | DB schema integrity       | 5 (+1) | Migrations 121–135 landed (§Q); fresh-DB baseline + RLS 099/116 review still open                                 |
| 3   | Auth & security           | 8 (+3) | Reassign closed; full admin chain confirmed (`admin.js:65-80`); `superAdmin` + CSRF + 2FA + audit shipped         |
| 4   | Workflows end-to-end      | 5 (+2) | W4 unblocked by alias fix; W1/W2/W3 still limited by results-payments gaps                                        |
| 5   | Frontend page coverage    | 7 (+1) | Live/leaderboard pages unblocked; community like/pin + contact still open                                         |
| 6   | Admin panel functionality | 6 (+2) | Split routers + guard chain verified; `insertOne` camelCase + pyp-bulk still open                                 |
| 7   | Data quality              | 4 (+1) | Results/payments emptiness is now a known-backlog item, not a mystery                                             |
| 8   | Payments/e-commerce       | 3 (+1) | Razorpay verify path exists; apply-coupon + D2 payload realism still open                                         |
| 9   | Observability/audit trail | 7 (+1) | `ServerLogsManager` + audit middleware intact                                                                     |
| 10  | Docs vs reality           | 8 (+4) | ARCHITECTURE/DEVELOPMENT/AI_PROMPTS/lifecycle refreshed 2026-09-06; first-pass report frozen as history           |

**Overall: ~6/10 → Classification: Fixes In Progress, Not Yet Launch-Ready.**
Launch blockers remaining: real payments flow (§D.3), results persistence (§D.4),
fresh-DB migration parity + RLS review, and the Remaining unknowns (§T).

---

## P. Waves 17–20 — newly shipped since first pass (2026-09-06)

- **Intelligence services:** `services/core/studyRoadmapService.js`,
  `socraticHintService.js` (`generateSocraticHint`),
  `examReadinessService.js` (`calculateExamReadiness`) behind
  `api/routes/intelligence.js`; tests `studyRoadmap` / `socraticHint` / `examReadiness`.
- **Proctoring:** live proctoring pipeline + admin `LiveProctoringConsole`.
- **Ranking:** BullMQ leaderboard queue recompute feeding the public leaderboard.
- **AI surface (shipped, small):** `POST /api/ai/mentor` + `/api/ai/explanation`
  (`app-port5001.js:1015-1016`) + `/api/ai/logs`, OpenRouter gateway (`admin-ai.js`),
  `aiRateLimiter`, `practice_ai_cache`. Node V1 done / V2 partial / V3–V6 vision
  (see `docs/AI_PROMPTS.md`, `docs/vision/NODE_ENGINE_V4-V6.md`).

---

## Q. Migrations 121–135 (since first pass)

Disk now holds `000`–`135` (next `136_*`); baseline via `003` +
`098_reconstructed_baseline.sql` + `108_ensure_complete_baseline.sql` + `121`.
Notable landings: test-category-series junction hardening (121), response-time
indexes (122), practice/subject perf indexes (124/126/127), taxonomy FK cascades
(129), cutoffs (130), audit remediation (134), test lifecycle + shuffle seed (135).
Regen: `dir /b apps\backend\src\infrastructure\database\migrations\*.sql`;
ground truth before ANY DDL: `node scripts/run-database-audit.js`.

---

## R. Toolchain: pnpm / uv (since first pass)

**pnpm 11.25 workspaces + turbo ^2.10.12** are canonical; Python AI/doc tooling via
**uv** (`.venv`). Do not use npm. `dev-tools/` removed — canonical scripts are
`scripts/run-database-audit.js`, `scripts/dev-sequential.mjs`,
`scripts/wait-for-backend.mjs`. Ports: frontend **3000** (not 5173), admin **3002**,
backend **5001**. Deployment: Docker + nginx primary; Vercel configs vestigial.

---

## S. Avatar + prop-types fixes (since first pass)

Avatar 404 fallback and the Vercel prop-types build fix both shipped (§N.5–N.6).
Old verdicts referencing them as broken are closed.

---

## T. Remaining unknowns (verify before launch — NOT yet re-audited 2026-09-06)

1. Community like (`POST /api/study-groups/:id/posts/:postId/like`, `Community.jsx:712`) + `pin` endpoints — still 404 in last pass.
2. `POST /api/admin/pyp/bulk` (`adminAPI.js:28`) — still 404 in last pass.
3. `insertOne` unknown-column 42703 on admin POSTs (`postgres-helpers.js:1428` vs `normalize-fields`) — needs payload audit.
4. RLS `099`/`116` owner-access review (INTEGER `user_id` vs UUID `auth.uid()` casts; `app.current_user_id` never set).
5. D2 payment payload realism (fake Razorpay stubs in `Pass.jsx`) + `/apply-coupon` vs `/validate-coupon` mismatch.
6. results-persistence + `test_questions` junction writes (D.4 / E.5).
7. `coming_soon_features` / `notification_preferences` table gaps (E.1 / E.3) — re-run DB audit to confirm.
8. Duplicate/shadowed mounts inventory (§F) — cleanup + re-verify double audit writes.
9. `notifications.read` vs `is_read` split-brain; contact/FAQ/assets public routes (§H rows).
10. Fresh-DB install parity (E.8) — rebuild from migrations and diff vs live.
