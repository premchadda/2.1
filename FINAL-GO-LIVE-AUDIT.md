# TRSTPREP — FINAL GO-LIVE AUDIT (2026-08-17)

Method: file-by-file source audit (backend 333 files, frontend ~60, admin-panel all
feature folders), live DB introspection of the production PostgreSQL (160 tables,
117 applied migrations), test run (24 suites / 181 tests PASS), and independent
re-verification of every CRITICAL claim. No pre-existing audit docs were consulted.

**Verdict: NOT READY for public launch. 13 CRITICAL, 21 HIGH must be resolved first.**
The DB is already live (real users, real sessions from India as of today) — these
issues are exploitable against real users right now.

---

## PART 1 — CODE AUDIT (verified, file:line cited)

### CRITICAL (block launch)

1. **Free Pro pass self-grant** — `apps/backend/src/api/routes/subscriptions.js:87-104`
   `POST /api/subscriptions/create` accepts `{planType, expiryDate}` from ANY
   authenticated user and grants `is_pro_user=true, pro_expiry, pass_type` with zero
   payment verification (comment says "would be called by payment webhook" — it never
   is). Any user: `POST /api/subscriptions/create {planType:"pro", expiryDate:"2099"}` → Pro.
2. **Cross-user cache leak + auth bypass** — `app-port5001.js:506` mounts
   `responseCache` globally BEFORE auth; `middleware/responseCache.js:22` scopes by
   `req.user?.id` which is always undefined at that point → all cached GETs share one
   global key. Cached responses short-circuit BEFORE `protect` runs: user A's
   `/api/notifications`, `/api/bookmarks` etc. served to anonymous callers and other users.
3. **Public answer-key leak** — `api/routes/practice-questions-public.js:47` (unauthenticated)
   returns `correct_option`/`correct_answer` columns (stripped at top level) but ALSO
   `options_hi`, `explanation_hi`, `solution_image_url`, `review_notes`,
   `moderation_status`, `submitted_by`, `reviewed_by`, `ai_generated`, `source_config` —
   full solutions and internal workflow. Same class: `modules/search/vectorSearch.service.js:270-278`
   returns raw `options` in public semantic search (`/api/search/vector/semantic`, no auth).
4. **Live-mock hands out answer key mid-test** — `modules/live/liveMock.service.js:243-250`
   returns raw `options` to test-takers during an in-progress live mock.
5. **IDOR: cancel any subscription** — `subscriptions.js:111` → `SubscriptionService.js:205-213`
   runs `WHERE id=$1` with NO owner filter (the `$1 AND $2` branch is also broken — only one param supplied).
6. **IDOR: reattempt any user's attempt** — `subscriptions.js:177` → `SubscriptionService.js:296,369`
   loads parent attempt by id without ownership check and inserts reattempt with the VICTIM's user_id.
7. **FortSpy DRM is theater** — `api/routes/videos-public.js` (unauthenticated) returns full
   video rows incl. `fortspy_key`; `api/routes/fortspy.js:230-262` mints stream tokens with
   client-supplied key, no entitlement check; `fortspy.js:171-204` proxies decrypted stream
   to any authenticated user. Key delivered to browser (frontend `VideoPlayer.jsx:88`).
8. **Public leaderboards leak PII + internal ids** — `modules/ranking/ranking.service.js:26-47,263-303`
   and `modules/live/liveMock.service.js:329-351` return internal `u.id`, full names, avatars.
9. **Test scheduler dead — live tests never go live** — `services/core/testScheduler.js:31,41`
   compares JS `Date` against ISO string (always ">" → skip) AND `TRANSITION_MAP` expects
   status `scheduled` while DB stores `published`. DB evidence: 8 live tests stuck in
   `published` with past `scheduled_at` (tests 83–90; test 83 due 2026-07-25).
10. **Importers manufacture wrong answers** — `services/import/fullTestImporter.js:740-742`,
    `classxImporter.js:52-53`: missing `correctAnswer` silently defaults to option 0.
11. **postgres-helpers silent failure triad** — `infrastructure/database/postgres-helpers.js:20-22`
    (hard 1000-row cap → wrong ranks/percentiles), `:826-832` (errors swallowed → `[]`),
    `:745-760` (filters with `-` dropped → full-table queries).
12. **Admin crash on load** — `apps/admin-panel/src/features/admin/assessments-quizzes/TestSeriesManager.jsx:53`
    calls `coerceStageExamIds` which is defined NOWHERE (repo-wide grep: 1 match = call site).
    `no-undef` disabled in eslint config so CI won't catch it.
13. **JWT + refresh tokens in localStorage** — frontend `AuthProvider.jsx:209-212` &
    admin-panel `AuthProvider.jsx:21-35` persist JWTs to web storage; `shared-config/src/apiClient.js:89-91`
    reads them back. Any XSS = account takeover. Contradicts the httpOnly-cookie design.

### HIGH (must fix before launch)

1. `auth.middleware.js:413,620-628` — `admin` gate requires `role === 'admin'`; a
   `super_admin` user gets 403 on all `/api/admin/*` (superAdmin gate at :631 wrongly
   accepts plain admins — inverted hierarchy).
2. `origin.middleware.js:95` — any `*.vercel.app` origin passes the CSRF origin gate.
3. `postgres-helpers.js:23-29,644,653` — PII encryption falls back to `JWT_SECRET`;
   random-IV encryption per write means `phone_enc` lookups never match (search broken);
   `migrationRunner.js:100` hardcodes `dev-fallback-trstprep-pgcrypto-key-32bytes`.
4. `database-replicas.js:21` — DB TLS `rejectUnauthorized:false` by default.
5. Expired subscribers keep unlimited access — `SubscriptionService.js:404-428` clears
   `is_pro_user` but not `pass_type`; `attempt-limits.js:38-43` keys off `pass_type`.
   Legacy `pro_monthly`/`pro_yearly` never match `hasActiveProPass` (`:95`) → paid users
   denied features. DB evidence: users 3/10/11 have inconsistent pro state.
6. Reattempts always empty — `SubscriptionService.js:223-254` reads `attempt_answers`
   (0 rows in DB) while the live flow writes `attempts.answers` JSONB only.
7. Fabricated rank for 0-score attempts — `modules/tests/test.routes.js:362` returns
   rank 1 / 100th percentile for `score=0`.
8. Scoring gaps — `test.routes.js:1085-1105`: uniform marks per question, multi-select
   always wrong, `timeSpent` client-trusted (wins tie-breaks).
9. `videos-public.js:22-73` — paid (`is_pro`) video URLs returned to unauthenticated
   users; `:81-82,101-137` unbounded in-memory activity maps → memory DoS.
10. `payments.js` — signature verified but order `notes.userId` never bound to `req.user.id`
    (H2: user can verify someone else's order).
11. Analytics "transaction" wraps nothing — `services/core/analyticsService.js:311-316`
    BEGIN on one client, upserts on shared pool (partial writes).
12. `SessionCaptureService.js` — spoofable `x-forwarded-for` stored; plain-HTTP
    `ip-api.com` lookup (leaks internal IPs); emails/names/IPs/geolocation broadcast on
    `admin:sessions` WS with no retention policy (DPDP).
13. Certificates issued for non-completed attempts + unlimited duplicates per attempt —
    `certificateService.js:74-90`.
14. Notification reminders load full tables (1000-cap) with no chunking —
    `notificationService.js:116,131`.
15. `intelligence.js:164-175` — daily-quiz submission accepts any quizId (cross-user
    overwrite + streak farming).
16. `smartRevision` etc. rely on `attempt_answers` (empty) — revision engine dead on live flow.
17. Admin-panel CSV exports lack formula-injection escaping (`PracticeQuestionsManager.jsx:~526-560`,
    `packages/shared-config/src/index.js:178-188` raw join).
18. Weak CSP in prod — `vercel.json:17-18` `script-src 'self' 'unsafe-inline' 'unsafe-eval' https:`.
19. Frontend `TestInterface.jsx:1297` sends client-controlled `disableNegativeMarking` + `timeSpent`.
20. Frontend `Pass.jsx:271-278` mock-payment path — backend gated by `NODE_ENV!=='production'`
    (verified OK) BUT 6 `order_mock_*` transactions are recorded `completed` in the live DB
    and granted real Pro (users 10, 11) — purge before launch.
21. `TestAttemptController.js` (1h limit, no partial marks, leaks `correct_option`) is
    unused dead code — delete or fix before someone wires it.

### MEDIUM highlights
- `subscriptions.js:183-188` reattempt response returns raw flag-bearing options.
- `testimonials-public`, `current-affairs-public`, `examInfo.routes` return internal columns/paths.
- `referrals.js:95-143` unauthenticated referral-row spam.
- `fortspy.js` stream token without entitlement (only protect).
- `contact.js` no rate limit; `aiMentor.routes.js` limiter fail-open without Redis.
- `upload.validator.js` mime-sniff only; `settingsService` FOR UPDATE via autocommit (dead lock);
  secrets stored plaintext in `app_settings` JSONB.
- `ExamInfo`, `Test.create` default `isPro: true`; `EnrollmentService` type never set
  (DB evidence: all enrollments `type='series'` even exam enrollments).
- 2405/2451 csrf_tokens expired and never purged; 4/213 stale sessions.

### VERIFIED OK (no action)
- Admin pipeline `normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect →
  admin → permissions → audit` intact on all admin routes (importers included).
- Payments: mock gated by `NODE_ENV!=='production'`; plan/amount re-verified server-side
  from Razorpay order notes; fail-closed on fetch errors (`payments.js:289-354`).
- Attempt lifecycle: ownership + FOR UPDATE + submit guards + per-section timers +
  anti-cheat + answer sanitization (`test.routes.js`).
- No eval/new Function/XML anywhere; all interpolated SQL sites parameterized.
- All XSS sinks (17 frontend + 17 admin) sanitized; no secrets in client bundles;
  sourcemaps off in prod; CSRF token flow correct.
- Backend tests: 24 suites / 181 tests PASS.
- Passwords: bcrypt (`$2a$`/`$2b$`, len 60) — no plaintext.

---

## PART 2 — LIVE DATABASE AUDIT (160 tables, 117 applied migrations)

### Schema state
- Migrations: 117 applied vs 106 files on disk. 11 applied migrations are NOT on disk
  (renamed/retired: `000*` variants, `018/019-` dash variants, `038_create_remaining`,
  `049_fix`, `056_fix`, `057_full`, `082_ungroup`, `109_learner_intelligence`) →
  **fresh-DB reproducibility risk**: a clean install cannot replay history identically.
  098_reconstructed_baseline.sql partially compensates. Migration log shows duplicate
  version numbers applied (038×2, 049×2, 056a/b, 082×2, 109×2).
- RLS enabled on 160/160 tables, 292 policies, no duplicate index names, 0 unindexed FK
  columns, only 2 security-definer functions (`encrypt_pii`/`decrypt_pii`).
- `schema_migrations` (public) has 3 columns; the Supabase `auth.schema_migrations`
  (with integer+bigint `version` columns) also exists on the host — two migration
  trackers coexisting; the app one is authoritative.

### Data integrity
- **8 live tests stuck `published`** past scheduled_at (test 83 due 2026-07-25) —
  scheduler dead (code bug #9 above).
- Duplicate tests by title: 12 (6 pairs, SSC CGL 2022 shifts) — imported twice.
- Test 27: 98 test_questions rows with NULL question_number; duplicate
  (test_id, question_number) sets (4× each in tests 187/194/236/238/251/286/306/371).
- 385 questions not linked to any test; 10 tests have zero test_questions.
- test_sections: 338 rows with NULL test_id (template sections, unattached) — by design
  or cleanup target; 0 dangling FKs.
- 0 orphans across attempts/users/tests/results/enrollments/sessions/audit/versions —
  FK integrity is clean.
- `app_settings` row with NULL key; conflicting payment config: `features.paymentGateway=true`
  (first row) vs `site_config.features.paymentGateway=false`.
- Pricing inconsistency: plan prices ₹99/₹199 (`subscription_plans`) vs
  `pro_pass_price` ₹999 (app_settings) vs transactions at ₹99/₹999.

### Money & live risk (already in production)
- **0 payments, 0 subscriptions, 0 pro_passes, 0 coupons** — payment path has NEVER
  processed a real rupee. Razorpay keys EMPTY in DB (`payment.razorpay_key_id: ""`),
  SMTP empty. `payments.js` correctly 503s in production without keys.
- 6 mock transactions recorded `completed`; granted real Pro to users 10 & 11.
- Real users present: 12 users, 213 sessions (Android India, live today 2026-08-17),
  581 login_attempts, 880 audit_logs, real public IPs logged (152.58.57.237).
- **`.env` files tracked in git** (`apps/backend/.env`, `apps/frontend/.env`,
  `apps/admin-panel/.env` committed in `abf91cd`) with REAL `DATABASE_URL`, JWT secrets,
  AI key. Rotate ALL secrets immediately; scrub git history.
- `platform_stats` displays fabricated marketing numbers (50K+ users, 98% success) —
  legal exposure risk if used as advertising.

---

## PART 3 — GO-LIVE BLOCKERS & FIX ORDER

### Phase 0 — Security (hours, before anything else)
1. Rotate JWT_SECRET/JWT_REFRESH_SECRET + pgcrypto key; un-track .env files; scrub git history.
2. Remove `POST /api/subscriptions/create` from non-admin paths (or require webhook signature).
3. Fix responseCache: mount after auth or drop it; add user scoping at route level.
4. Strip `explanation_hi/solution_image_url/review_notes/options_hi` from
   practice-questions-public + vector search projections.
5. Add ownership to cancelSubscription + createReattempt (pass userId, fix param bug).
6. Purge mock transactions + reset users 10/11 pro flags; delete test users 3,5,7,8,9,11.

### Phase 1 — Correctness (1–2 days)
7. Fix testScheduler (Date-vs-ISO compare + `published` status); flip 8 stuck tests manually.
8. Fix postgres-helpers 1000-cap / swallowed errors / `-` filter drop.
9. Fix admin gate for super_admin; tighten superAdmin to super_admin only.
10. Fix scoring (per-question marks, multi-select, server-side timeSpent).
11. Fix FortSpy: entitlement checks, stop shipping key to client.
12. Admin-panel: define `coerceStageExamIds`; re-enable no-undef lint.
13. Delete `TestAttemptController` dead code; fix reattempt data source (attempt_answers vs answers).

### Phase 2 — Configuration (before public marketing)
14. Configure Razorpay LIVE keys + SMTP in app_settings; resolve dual config rows.
15. Align pricing (₹99/₹199 vs ₹999); enable paymentGateway in one place.
16. Fresh-DB dry run: replay 106 migrations on empty DB; fix gap.
17. Reconcile duplicate tests/questions; backfill question_number.
18. Set NODE_ENV=production on hosts (mock gate + email verification depend on it).

### Not blockers (post-launch)
- csrf_tokens/login_attempts cleanup job; leaderboard PII masking; SessionCapture retention;
  certificate uniqueness; weak CSP tightening; CSV escaping; dead routes/imports cleanup.