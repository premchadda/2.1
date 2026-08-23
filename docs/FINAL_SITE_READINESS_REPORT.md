# TRSTPrep — FINAL Site-Readiness Audit (Evidence-Based, Live-DB Verified)

**Last Updated:** 2026-08-23 — docs refresh: `README.md`, `ARCHITECTURE.md` (112 migrations, 85 routes, 60 admin components), `DEVELOPMENT.md`, `DATABASE_SCHEMA_AUDIT.md` reconciled with live counts (see `CHANGELOG.md:3`)

> Supersedes `docs/SITE_READINESS_REPORT.md` (first pass, also refreshed Aug 23). This report is built on:
> direct source reads (frontend, backend, admin panel), six parallel deep-dive
> workstreams, and **read-only queries against the live PostgreSQL database**
> (154 tables, ground-truth row counts). Findings are cited `file:line`.
> Agent deliverables: `docs/audit/D1_WORKFLOW_VERIFICATION.md`,
> `docs/audit/D2_HARDCODED_FAKE_DATA.md`, `docs/audit/D3_DEAD_DISCONNECTED.md`,
> `C:\Users\mahic\AppData\Local\Temp\opencode\db-audit-report.md`.

---

## A. Executive Verdict

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

| Source | What it proves |
|---|---|
| Live DB (read-only, 154 tables) | Schema ground truth, row counts, missing tables |
| `app-port5001.js` (1022 route defs) | All mounts, duplicates, shadowing |
| Frontend page-by-page read | Every page's API calls vs actual backend routes |
| Admin module read | normalize-fields pipeline, insertOne/updateById behavior |
| 6 workflow traces | W1 test / W2 admin→user / W3 payment / W4 live / W5 practice |
| `git show HEAD` diffs | What the working copy changed vs committed state |

---

## C. Readiness Scorecard (10 areas, /10)

| # | Area | Score | Basis |
|---|---|---|---|
| 1 | API/route integrity | 3 | 6 shadowed/duplicate mounts; 12+ broken frontend calls |
| 2 | DB schema integrity | 4 | 12+ referenced tables missing; 3 missing migrations; RLS cosmetic |
| 3 | Auth & security | 5 | Unauthenticated reassign endpoint; leaderboards 401 for anonymous; no secret leaks found |
| 4 | Workflows end-to-end | 3 | W1 ⚠️, W2 ⚠️, W3 ❌, W4 ❌, W5 ✅ |
| 5 | Frontend page coverage | 6 | Most pages render; several call dead endpoints |
| 6 | Admin panel functionality | 4 | Many CRUD paths 500/404; field-chain issues |
| 7 | Data quality | 3 | results=0, payments=0, subscriptions=0; inflated admin stats |
| 8 | Payments/e-commerce | 2 | Fake Razorpay payloads; apply-coupon 404 |
| 9 | Observability/audit trail | 6 | audit_logs=512 rows working; MessageBroker wired |
| 10 | Docs vs reality | 4 | DATABASE_SCHEMA_AUDIT.md stale; migrations 003–017 missing |

**Overall: ~4/10 → Classification: Major Fixes Required.**

---

## D. P0 — Critical (block launch)

1. **Test scoring regression — FIXED** (see A.1). Verify live with one submission.
2. **Live-test flow 404s.** Frontend calls `/api/live-tests/:id/*`
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
5. **Admin live-tests CRUD 404.** `adminAPI.js:107-112` hits
   `/api/admin/live-tests*` — no such router registered.
6. **Unauthenticated reassign.** `testCategories.js` has NO auth middleware;
   `GET /orphaned/list` (`:140`) and `PUT /orphaned/reassign` (`:154`) are
   anonymous, including a write.

## E. P1 — High

1. `coming_soon_features` table missing → all 6 admin-coming-soon routes 500.
2. Raw-SQL 500s bypassing tableMap: `chapters` (`admin.js:515`), `units`
   (`admin.js:4689`), `admin-bulk-ops.js:366` — tables don't exist live.
3. `notification_preferences` missing → `POST /api/notifications-pref/subscribe` 500;
   `notifications.read` vs `is_read` split-brain (one router always broken).
4. Anonymous leaderboard 401: public `/api/leaderboards` shadowed by
   `leaderboards-admin.js:8-10` (protect+admin).
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

| Page | Section/Form | API used | Backend route | Status |
|---|---|---|---|---|
| LiveTests | start/join/attempt | `/api/live-tests/:id` | `/api/live-mock/:id` | ❌ 404 |
| LiveTestInterface | submit | `/api/live-tests/:id/submit` | `/api/live-mock/...` | ❌ 404 |
| LiveTestResults | results | `/api/live-tests/:id/result` | `/api/live-mock/...` | ❌ 404 |
| Pass | purchase + coupon | `/api/payments/apply-coupon` | `/validate-coupon` | ❌ 404 |
| Faq | list | `/api/faqs` | — | ❌ 404 |
| QuestionDiscussions | comments | `/api/questions/:id/comments` | `/api/discussions/question/:qid` | ❌ 404 |
| Community | like post | `/api/study-groups/:id/posts/:pid/like` | — | ❌ 404 |
| Community | pin post | `PUT .../pin` | — | ❌ 404 |
| Admin LiveTests | CRUD | `/api/admin/live-tests*` | — | ❌ 404 |
| Admin PYP | bulk import | `/api/admin/pyp/bulk` | — | ❌ 404 |
| Admin ComingSoon | all 6 routes | `/api/admin/coming-soon*` | missing table | ❌ 500 |
| TestInterface | submit | `/api/tests/:id/submit` | ✅ (after A.1 fix) | ⚠️ fixed |
| Practice (all) | full flow | `/api/practice*` | ✅ wired | ✅ |
| Leaderboards (anon) | list | `/api/leaderboards` | shadowed by admin router | ⚠️ 401 |

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

| Workflow | Result |
|---|---|
| W1 Test attempt → result | ⚠️ attempt saved, `results` never written → leaderboard/achievements broken |
| W2 Admin question → user | ⚠️ question rows created, `test_questions` junction never written (1575 vs 1375) |
| W3 Purchase → access | ❌ fake Razorpay payloads + `/apply-coupon` 404 → real purchase impossible |
| W4 Live test | ❌ save-answer stub discards answers; live rank fake; admin CRUD 404 |
| W5 Practice | ✅ fully wired end-to-end |

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