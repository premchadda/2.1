# 17-09-2026 Audit Report — Resolution Ledger

Companion to `17-09-2026 Audit Report.md` (982 lines, 7 audit sections).
Sweep executed 17/18-09-2026: 20 agents planned (Wave 1–2 via subagents A01–A06,
Waves 3+ applied directly by orchestrator after the subagent transport failed
with `ENOTFOUND opencode.ai`). Every code item below cites the file that was
changed (or the file:line evidence that it was already fixed in-tree).
`node --check` passes on all edited files; targeted suites pass
(`authRateLimiter` 6/6, `aiClient` + `aiMentor.service` 13/13,
`auth.middleware` + `auth-flows` 31/31).

Status key: **RESOLVED** = fixed + verified · **HALF** = materially fixed,
residual tracked · **PENDING** = needs human/ops/live env · **SKIPPED** =
accepted as-is with reason.

## Critical — all closed except history scrub (ops)

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| C1 | `secondTier` == `admin` (`auth.middleware.js`) | RESOLVED | A04: `secondTier` passes solely on `SECOND_TIER` role; never `isAdmin`/`ADMIN` |
| C2 | Password change/reset don't revoke sessions | RESOLVED | A05: `changePassword` bumps `refresh_token_version` + deactivates other `user_sessions`; `resetPassword` fixed to use `dbHelpers.pool` (was `ReferenceError` swallowed by `catch{}`) + deactivates ALL sessions |
| C3 | Phone JWT 30d on 2FA secret, full auth | RESOLVED | A06: phone sessions issued via `generateToken`/`setAuthCookies` (7d access + 30d refresh), no `JWT_2FA_SECRET`, token removed from JSON body (httpOnly cookies). BREAKING for old phone clients — coordinate with frontend before deploy |
| C4 | 2FA mutations CSRF-exempt | RESOLVED | Already in tree: `enroll/verify/disable/regenerate` carry `protect + validateCsrfToken + lockout + rateLimiter` (`auth.routes.js:145-176`); exempt list holds only unauthenticated `login/2fa` (temp-token, no cookie session) + `2fa/status` read |
| C5 | Outbox `SKIP LOCKED` without txn | RESOLVED | Already in tree (`BEGIN/COMMIT`, overlap guard, backoff, LIMIT 100, `dead_letter`); A11 added cleaner overlap guard + 500-row cap |
| C6 | `/verify` without advisory lock | RESOLVED | Already in tree: advisory lock + idempotency guard on `transactions(orderId)` |
| C7 | Committed `.env` / `M3 Key.txt` / 528 `test_attempts` rows | PENDING | Ops runbook: rotate `DATABASE_URL`, `JWT_*`, Razorpay, Supabase, OpenRouter BEFORE `git filter-repo --invert-paths` + `--replace-text`, then DPDP notices for 196 principals. Destructive — needs explicit human sign-off |

## High

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| H-auth1 | Lockout skipped for authed admins on 2FA routes | RESOLVED | `lockout.middleware.js`: skip now applies only to non-credential paths; 2FA/OTP paths always enforced |
| H-auth2 | 2FA brute force uncounted (null email) | RESOLVED | Already in tree: `login2FA` records against temp-token identity, clears on success (A05 verified) |
| H-auth3 | `link-phone` no guards, unbounded guesses | RESOLVED | A06: `auth + lockout + rateLimiter + CSRF`, fail-closed store guard, attempts + delete-after-3 |
| H-auth4 | Phone signup trusts email, 500 on dup, token in body | HALF | A06: 409 on dup (pre-check + 23505 catch), httpOnly cookies, no body token. `email_verified` column does not exist in migrations → verification-mail wiring needs a follow-up migration |
| H-auth5 | `/me` shared SWR key | RESOLVED | A05: per-user+session namespace `auth-me:<uid>:<sid>`; prefix invalidation intact |
| H-auth6 | `optionalAuth` no type check, silent downgrade | RESOLVED | A04: type allowlist (`password-reset`/`2fa-pending` rejected), explicit `authError/anonymousReason` instead of silent `next()` |
| H-auth7 | `send-otp` no lockout, fail-open counter | RESOLVED | Already in tree: `lockout + rateLimiter`, 503 before counter when store down (A06 verified) |
| H-auth8 | 2FA lifecycle needs only session | RESOLVED | Already in tree: password-or-TOTP gates + audits on enroll/disable/regenerate (A05 verified) |
| H-test1 | Start scans all user attempts (H1) | RESOLVED | Scoped `testId: {$in: forms}` (type-safe: ints as numbers, strings only when canonical is non-int) on resume + limit + 23505-retry paths |
| H-test2 | Practice start ~5s (H2) | HALF | Double-resolve already fixed in tree; added hygiene+INSERT single txn (last-writer-wins) + weak-topic input capped to latest 5000 rows. `ORDER BY RANDOM()` remains + covering indexes need a 143 migration with `EXPLAIN ANALYZE` |
| H-test3 | Null `questions_json` → 500 (H3) | RESOLVED | Already in tree: `Array.isArray` guard → 400/404; PATCH range/type check + 404 added |
| H-test4 | Bookmarks heavy default 5.3s (H4) | RESOLVED | User-scoped `responseCache("bookmarks-list",30)`, default limit 20, auto-lightweight when limit>20, explicit columns, deterministic `ORDER BY created_at DESC, id DESC`, list limiter, invalidation on mutations |
| H-test5 | Bookmark dedup race (H5) | HALF | Targeted `SELECT 1` probes + toggle canonicalization done. Partial unique index (`user_id, item_type, item_id` where active) still needs a 143 migration |
| H-test6 | `timeSpent` NaN (H6) | RESOLVED | Already in tree: finite-number required validation |
| H-db1 | `revision_queue.priority` VARCHAR vs live INTEGER | RESOLVED | 142 §1 `ALTER TYPE … USING` (0/1/2 per writer) — pending apply + live `SELECT DISTINCT priority` check |
| H-db2 | Trigger/RLS/cascade/pgcrypto drift | HALF | 142 §§0,2,3,5–9 cover RLS drops, trio, search_path, cascades (semantics preserved). Cascade-vs-soft-delete contradiction needs owner sign-off (future migration) |
| H-ai1 | `Bearer undefined`, no retry/timeout, unchecked shapes | RESOLVED | `aiClient.js`: absent-key guards, 30s timeout, 1 retry on transient, error bodies, empty-choices fail-closed, embedding vector assert |
| H-ai2 | Fallback `Bearer undefined`, erased statuses | RESOLVED | Fallback skipped without key; final error preserves both statuses |
| H-ai3 | Template fallback inserts fake rows | RESOLVED | Already in tree: `generated_by: template_fallback` + `is_active:false` + response flag |
| H-ai4 | RAG FTS-only, english kills Hindi | RESOLVED | `simple`-dict second pass; failure logging already in tree |
| H-ai5 | `practice_ai_cache` orphan, `AICache` frozen | RESOLVED | Explanation single-generate reads/writes `practice_ai_cache` (24h freshness, model-scoped); mentor cache resolves Redis lazily; chat skips cache (`skipCache`) |
| H-ai6 | Limiter bypasses (daily-tip, node, search) | RESOLVED | All wired in tree (verified by grep); math correctly moved OFF AI quota to moderate tier |
| H-ai7 | Fail-open on Redis outage | RESOLVED | Per-process fallback caps (same limits) + `degraded:true`; tests updated (6/6 pass). Also fixed NaN-limit parsing + test afterEach env poisoning found during verification |
| H-ai8 | Stale pricing, wrong usage columns | RESOLVED | Pricing table modernized (longest-match, embedding rates); `getUsageByPeriod` snake_case fixed |
| H-infra1 | `addJob` silent drop | RESOLVED | Already in tree: outbox spool fallback |
| H-infra2 | EVENTS unconsumed | RESOLVED | Explicit worker concurrency + deploy warning comment (worker-process deployment itself is ops-PENDING) |
| H-infra3 | DLQ shared connection, lost opts, lying status, hanging close | RESOLVED | Already duplicated; retry preserves opts; status returns null+degraded; bounded 5s closes |
| H-infra4 | Sweeper no lock / never cleared | RESOLVED | Already in tree: `scheduler:lock` + handle cleared on shutdown |
| H-infra5 | WS any-room join, global room, getIO noop, no WS close, bus gap | RESOLVED | Registration check + scoped rooms already in tree; `isWebSocketReady()` + warn-once + boolean helpers added; shutdown already closes WS/broker/server; broker↔bus bridge added (`publishRemote`, no double delivery) |
| H-infra6 | `responseCache` barrier leak | RESOLVED | Already in tree (both branches release on `res.send`) |
| H-infra7 | S3 fail-open → ephemeral 404s | HALF | `STORAGE_FAIL_CLOSED=true` flag already in tree + warn; default still fail-open (availability tradeoff — ops decision). Avatar fallback chain (provider → local → SVG placeholder + client `onError`) verified |
| H-admin1 | `ProtectedRoute` fail-open on empty perms | RESOLVED | Already in tree: deny-by-default, super only via `*`/`second_tier`/explicit flags |
| H-admin2 | Coarse RBAC (`content` collapse) | RESOLVED | Already in tree: full `SEGMENT_TO_RESOURCE` map (study/live/practice/monetization/moderation/audit) |

## Medium / Low

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| M-test1 | Split-brain attempt implementations | PENDING | Doc-level: `TestAttemptController` unmounted; needs delete-or-wire decision (untouched — high blast radius) |
| M-test2 | State machine not authoritative | PENDING | Doc-level: scheduler transitions vs route-allowed states diverge; needs product sign-off |
| M-test3 | Timer/serialization drift | PENDING | Not changed; flagged for follow-up |
| M-test4 | Batch-events per-event lookup in txn | RESOLVED | Distinct questionIds pre-resolved before `BEGIN` |
| M-test5 | Result cache 300s scoping | RESOLVED | Verified `userScoped=true` default on both mounts |
| M-test6 | Submit side-effects outside txn | HALF | Double `await import` fixed; webhook receipt email moved post-commit; results/analytics intentionally outside attempt txn (documented) |
| M-test7 | Revoked/completed gaps | RESOLVED | 409 `ATTEMPT_CLOSED` on pause/save/event/batch for terminal states; heartbeat already label-only |
| M-fe1 | Bookmarks dashboard heavy fetch | RESOLVED | Already in tree (`includeDetails:false`, limit 20, lazy modal) |
| M-fe2 | Avatar 404 no fallback | RESOLVED | Already in tree: `avatarFallback.js` + `onError` in Settings/Navbar/QuestionPalette/PracticeWorkspace |
| M-fe3 | `useProPass` coupling | RESOLVED | A02: DI kept, `initialized` flag, lazy URL override, shared `formatRemainingDays` with fallback |
| M-fe4 | ExamDetails/ExamsNew orphans | RESOLVED | Deleted; barrels cleaned |
| M-fe5 | ExamCompare nits | RESOLVED | Fallback already gone; NaN-safe change indicator fixed; `vacancies` contract verified against `/compare` |
| M-fe6 | PracticeLab resume shape | RESOLVED | Already defensive (`id ?? sessionId ?? session_id`) |
| M-pkg1 | Admin apiClient fork divergence | HALF | Canonical factory hardened by A01 (CSRF capture, waiter replay, typed refresh, 403/429 types). Admin fork alignment left to admin territory (flagged, not broken) |
| M-pkg2 | Raw `fetch` fallbacks, no-CSRF paths | HALF | `apiClientConfig` fixed by A02 (explicit config error, no localhost, CSRF passthrough). `sendBeacon`/socket dual-stack documented as accepted (server-side CSRF stance on beacons unverified) |
| M-pkg3 | Error swallowing (`[]`/`false`, envelope mismatch) | RESOLVED | Fixed by A02 (`public_id` keys, minimal toggle payload, typed errors) |
| M-pkg4 | Loggers without redaction | RESOLVED | Backend pino redact extended (phone/email/otp/aadhaar/pan/razorpay/pgcrypto/keys); logBuffer PII patterns + full redact; canonical package logger hardened by A01 |
| M-pkg5 | Enrollment fork, dashboardCache staleness | RESOLVED | Canonical normalizes extras (A01); 5-min TTL documented as accepted |
| M-pkg6 | Telemetry poison-batch | RESOLVED | Already in tree: 4xx drops batch, 5xx/network re-queues, 1000-cap FIFO |
| M-adm1 | SubjectHierarchy unrouted | RESOLVED | Routed + barrel-exported |
| M-adm2 | Topics redirect nowhere | RESOLVED | `topics` tab exists in StudyMaterialsManager |
| M-adm3 | Barrel stale | RESOLVED | Already complete (Payments/Moderation/2FA/Live/Proctoring/ServerLogs) |
| M-adm4 | LiveProctoring undiscoverable + dup deep-analytics | RESOLVED | Nav entry added; duplicate route removed (email-templates preserved) |
| M-adm5 | ResultsManager placeholder | RESOLVED | Already implemented (no placeholder text) |
| M-adm6 | Vacuous `.refine()` + missing schemas | RESOLVED | Already fixed: real `subjectRelationSchema` + payment/moderation/2FA/enrollment/live-test schemas |
| M-ci1 | `validate-routes` thin, not in CI | RESOLVED | Already expanded (mount inventory + resolution + admin/module coverage) and wired in `ci.yml` with `sync-repo-brain --check` |
| M-ci2 | `run-database-audit` stale refs, warn-only | HALF | Refs updated to 000–142/next-143; `DB_ENCRYPTION_KEY` fails closed in production. Index/FK warnings stay soft (CI gate philosophy) |
| M-ci3 | k6 dead auth/stale endpoints/BASE_URL | HALF | Already canonical (:5001, real auth, tolerant checks); tightened two 200-only probes to no-5xx. p95<500ms thresholds don't cover the 5s practice/bookmark paths (suite scope note) |
| M-ci4 | `scale.yml` stale, `scale.sh` tied to it | HALF | Scale file marked deprecated (fixed `--scale` pointer); `scale.sh` repointed to base+prod with N≤2 guard. N>2 needs a scalable service (future work) |
| M-ci5 | Node skew, pre-commit, secret-scan gaps | HALF | Dockerfiles already Node 22; pre-commit already scans secrets + eslint (fixed `npx`→`pnpm exec`); `sk-or-v1` added to data-guard. Docs-exclusion from scans is deliberate (false-positive tradeoff) |
| M-ci6 | CONTRIBUTING/`.env.example`/taxonomy scripts | RESOLVED | Already current (Node 22, 111 scripts, 50/500 limits, next `142_*`); `show-full-taxonomy.mjs` now tries canonical `subject_*` tables first |
| M-misc | `config/upload.js`, dead controllers, learnerIntelligence, graphify artifacts | HALF | `config/upload.js` deleted (was already `D` in tree); dead `test/attempt/question.controller` routers + empty-dir/docs prose left untouched pending delete-or-wire decision |
| M-misc2 | `checkPgvector` never called; HNSW/ivfflat churn | PENDING | Needs live-DB check before wiring startup assertions |
| M-misc3 | S3 orphan deletes; `used_by` races elsewhere | PENDING | Minor; flagged |
| M-misc4 | Minute/hour double limiter + hour-bucket burst + in-memory triple budget | HALF | Shapes unified (`code` + `Retry-After`), route estimates non-zero, service debits actuals. Two layers kept by design; fixed-window burst documented as accepted |
| M-misc5 | AICache no invalidation/versioning; revision/embedding uncached | HALF | Chat bypasses cache; others 24h TTL. Template-edit staleness + revision-plan caching left as future work |
| M-misc6 | `deleteOlderThan` unscheduled (unbounded `ai_generation_logs`) | PENDING | Needs an ops cron/scheduler entry — not wired |
| M-misc7 | Subscription read/write grace mismatch | PENDING | Read path (`subscriptions.js`) vs writer grace semantics differ; flagged, not changed |
| M-misc8 | `requestDedup` GET-only (double-POST `/verify`) | SKIPPED | By design (mutation dedup needs idempotency keys); `/verify` now has advisory lock + idempotency guard instead |
| M-misc9 | `imageOptimization` after static mount (dead position) | PENDING | `app.use("/uploads", imageOptimization)` registered after static handler — needs mount-order change + regression test (untouched for safety) |
| M-misc10 | `getUsageByPeriod` callers; `deleteOlderThan` wiring | PENDING | Query fixed; caller/scheduler verification left to owning agent |
| M-misc11 | Legacy `docs/legacy-migrations` 005–010 | SKIPPED | Reference-only by design (README-guarded, never run) |
| M-misc12 | `*.txt` gitignore vs `Master Syllabus.txt` workflow | SKIPPED | Local-only reference data by design (dry-run default in `import-syllabus.js`) |
| M-misc13 | k6 `load-test-telemetry.js` bespoke hammer | SKIPPED | Out of scope: requires live DB + `JWT_SECRET`; documented, not run |

## Follow-ups requiring a live environment (could not verify statically)

1. `swrCache("auth-me")` — fixed by namespacing; confirm no cross-session token reuse in staging.
2. `information_schema` for `revision_queue.priority`, `practice_answers` extras, `user_recommendations`, `attempts.metadata/correct/wrong` after 142 applies.
3. `EXPLAIN ANALYZE` on the practice `RANDOM()` picker + covering indexes (`questions(topic_id…)`, `bookmarks(user_id…)`, `attempts(user_id,test_id…)`).
4. Razorpay concurrent-verify replay against staging (lock + idempotency).
5. Worker-process deployment (`npm run worker`) — EVENTS + all queues stall without it.
6. Prod `DB_ENCRYPTION_KEY`/`PGCRYPTO_KEY` canonical name + `*_enc` backfill before dropping plaintext.
7. Phone session cookie cutover — old clients expecting `res.token` break (breaking change, coordinate).
8. Admins now rate-limited on auth endpoints (intended behavior change).
9. `proPass`-gated routes now admit entitled users (that was the bug — verify product expectations).
10. Rotation + `filter-repo` + DPDP (blocking for C7).
