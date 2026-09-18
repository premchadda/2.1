## 1. Files Inspected List

Graph / contract context first:

- `graphify-out/GRAPH_REPORT.md` (god nodes: `protect()` 101 edges :972, `sanitizeErrorMessage()` 93 edges :973, `admin()` 71 edges :976, `getRedisClient()` 49 edges :978)
- `apps/backend/src/api/routes/API_ENDPOINTS.md` (canonical admin chain doc)

Auth territory:

- `apps/backend/src/modules/auth/auth.routes.js` (full, 424 lines)
- `apps/backend/src/modules/auth/auth.controller.js` (login ~230-360, googleLogin 729+, refreshToken 1013-1142, forgotPassword 1282-1341, resetPassword 1345-1494, changePassword 1497-1590, verifyEmail 1593+, 2FA enroll 1801-1837 / verify 1840-1893 / regen 1896-1923 / disable 1926-1939 / login2FA 1942-2080+)
- `apps/backend/src/modules/auth/auth.service.js` (generateToken, cookie policy)
- `apps/backend/src/modules/auth/twoFactor.service.js` (full, 181 lines)
- `apps/backend/src/api/routes/phoneAuth.js` (full, 493 lines)
- `apps/backend/src/middleware/auth.middleware.js` (full, 999 lines — protect/optionalAuth/admin/secondTier/requireRole/proPass, session expiry, caches)
- `apps/backend/src/middleware/csrf.middleware.js` (full, 502 lines)
- `apps/backend/src/middleware/lockout.middleware.js` (full, 297 lines)
- `apps/backend/src/middleware/origin.middleware.js` (full, 430 lines — validateOrigin/restrictAdminOrigin/validateAdminApiKey)
- `apps/backend/src/middleware/adminIpAllowlist.middleware.js` (full, 113 lines)
- `apps/backend/src/middleware/admin-permission.middleware.js` (full, 278 lines)
- `apps/backend/src/middleware/audit.middleware.js` (full, 328 lines)
- `apps/backend/src/middleware/rateLimiterFactory.js` (33 lines), `aiRateLimiter.js` (72 lines)
- `apps/backend/src/middleware/error.middleware.js` (249 lines), `apps/backend/src/utils/sanitizeError.js` (29 lines), `apps/backend/src/middleware/normalize-fields.js` (237 lines)
- `apps/backend/src/api/routes/admin.js:62-80` (canonical chain order), `apps/backend/src/modules/import/bulkImport.routes.js:26-33` (chain comparison via grep)
- Grep sweeps: `secondTier|requireRole|proPass`, `validateCsrfToken|auditMiddleware|loadAdminPermissions|...`, `phone|verify-otp|OTP`, `refreshToken|resetPassword|...` (all in `apps/backend/src`)

## 2. Issues Found (severity + file:line + description + impact)

**CRITICAL — `secondTier` is `admin` (privilege escalation).** `middleware/auth.middleware.js:954-968`: `secondTier` passes for `ROLES.SECOND_TIER || ROLES.ADMIN || req.user.isAdmin` — identical to `admin()` at :943-952. Every `secondTier` gate (role CRUD `api/routes/admin-roles.js:146,241,352,479,545`, backups delete/trigger `admin-backups.js:303,351,460,534`, audit delete `admin-audit.js:297`, user role/status/pro-pass `admin-users.js:109,395,420`) is enforceable by any plain admin. Impact: intended two-tier privilege model does not exist.

**HIGH — Password change/reset do not revoke other sessions.** `modules/auth/auth.controller.js:1558-1561` (changePassword updates only `password`) and `:1465-1468` (resetPassword same); only current cookies cleared (`:1581`, `:1485`). No `refresh_token_version` bump, no `user_sessions` invalidation. Impact: stolen refresh tokens/sessions survive a password change/reset — the exact scenario password rotation must kill. (Code comment at `:983` acknowledges global bump signs out every device, but neither handler does it.)

**HIGH — Phone JWT reuses 2FA secret namespace + 30-day full-access token.** `api/routes/phoneAuth.js:334-339` signs `{id, phone, type:"phone", sessionId}` with `JWT_2FA_SECRET || JWT_SECRET` (`expiresIn:"30d"`), while `protect()` at `middleware/auth.middleware.js:482-490` accepts `type ∈ {session, web, phone}` as fully authenticated. Impact: token-type isolation is fictional (2FA-temp secret doubles as a session signer); phone tokens live 30d vs 7d web tokens and get full API access.

**HIGH — Admin lockout skip is misordered (2FA brute-force gap).** `middleware/lockout.middleware.js:200-202` skips when `isUserAdminRequest(req)` (requires `req.user`, `middleware/auth.middleware.js:397-413`). On login routes (`modules/auth/auth.routes.js:83-97`: `lockout → … → controller`, no prior `protect`) `req.user` is always unset so the skip is dead; but on 2FA routes (`auth.routes.js:145-172`: `protect → lockout → …`) an authenticated admin session skips brute-force protection on `2fa/enroll|verify|disable|backup-codes|login/2fa` — the highest-value guessing target. Impact: inconsistent model; second-factor endpoints weaker for admins.

**HIGH — All 2FA state-changing endpoints are CSRF-exempt.** `middleware/csrf.middleware.js:405-431` exempts `/api/auth/2fa/status|enroll|verify|backup-codes/regenerate|disable`, `/api/auth/login/2fa`, plus login/logout/register/forgot/reset/google. `enroll`/`verify`/`disable`/`regenerate` are authenticated POSTs that arm/disarm 2FA with no `X-CSRF-Token` requirement. Impact: cross-site request can alter victim's 2FA posture using their cookie session; violates "never bypass admin/auth chain" spirit for security-sensitive mutations.

**MEDIUM — `/me` per-user payload behind a shared SWR cache key.** `modules/auth/auth.routes.js:186-190`: `swrCache("auth-me", {freshTtl:60, staleTtl:24h})` on a handler returning per-user `permissions`, enrollments, attemptedTests, and a fresh `csrfToken` (`:398-412`). Key namespacing per user/session is not visible at the mount. Impact: if the key is not per-user+session, cross-user data/CSRF-token leakage or stale permissions served for up to 24h after RBAC changes. Must verify `swrCache` key composition before trusting.

**MEDIUM — `optionalAuth` skips token-type validation.** `middleware/auth.middleware.js:849-941` never checks `decoded.type`, unlike `protect()` (`:482-490`) and `requireImageAuth` (`:767-775`). Impact: `password-reset` / `2fa-pending` tokens attach a "user" on optional-auth routes (e.g. pro-gated test detail), and revoked-session handling degrades to anonymous `next()` (`:901-903`), silently downgrading instead of signalling.

**MEDIUM — `send-otp` has no lockout; its own rate limit fails open.** `api/routes/phoneAuth.js:65` uses only `authRateLimiter` (vs `verify-otp` `:154-158` which adds `lockoutMiddleware`). The custom 3/hr counter (`:95-102`) reads via `getFromStore`, which returns `null` when the store is unavailable (`:445-452`) — so `otpCount` is null and the check passes. Impact: SMS bombing/enumeration during store outages; inconsistent brute-force coverage across the two OTP halves.

**MEDIUM — `link-phone` missing all three guards + unlimited guesses.** `api/routes/phoneAuth.js:375` uses bare `auth` — no `validateCsrfToken`, no `lockoutMiddleware`, no `authRateLimiter` — and unlike `verify-otp` (`:202-211`) never increments `attempts` or deletes after 3 failures. Impact: authenticated CSRF-able state change (`phone_verified=true`, `:426-429`) with unbounded OTP guessing.

**MEDIUM — Phone signup trusts attacker email/name, unverified.** `api/routes/phoneAuth.js:224-233` inserts `email || ${phone}@trstprep.local` and `name` from the request body with `phone_verified=true`; no email verification, no uniqueness check against existing email before insert (DB 23505 → 500 path). Response (`:353-363`) echoes id/phone/email and returns the long-lived token in JSON body (never `setAuthCookies`, no refresh-token rotation/replay detection unlike web flow `:1077-1142`). Impact: unverified-email accounts, collision errors, XSS-stealable token (body, not httpOnly).

**MEDIUM — 2FA lifecycle needs only a stolen session.** Enroll upserts/resets (`modules/auth/auth.controller.js:1820-1829`), `disableTwoFactor` deletes (`:1926-1939`), regenerate rotates (`:1896-1923`) — none require current password or TOTP confirmation; only `verifyTwoFactor` success is audited (`:1879-1884`), disable/regenerate are not. Impact: single session hijack = full 2FA removal without further proof of possession.

**MEDIUM — Second-factor brute force is effectively uncounted.** `login2FA` failure records `recordLoginAttempt(null, …)` (`auth.controller.js:2022`); `checkAccountLockout` calls `email.toLowerCase()` (`middleware/lockout.middleware.js:58`) so null-email records can't be counted, and the pre-auth `lockoutMiddleware` already ran before the temp token existed. `verifyTwoFactor` records failures (`:1860-1868`) but nothing clears attempts on success (`clearLoginAttempts` never called on 2FA pass). Impact: TOTP/backup-code guessing has no working progressive lockout.

**MEDIUM — 4xx error messages pass through raw in production.** `apps/backend/src/utils/sanitizeError.js:13` and `middleware/error.middleware.js:91`: `if (statusCode < 500) return error.message`. God node `sanitizeErrorMessage()` (93 edges) is thus a partial boundary; `auth/me` (`auth.routes.js:415-420`) forwards it directly, while `phoneAuth.js:143-146,365` and others log/return raw errors (one logger call includes `phoneNumber`). Impact: DB/validation internals leak on any 4xx; logging PII-adjacent fields alongside errors.

**MEDIUM — Admin chain order/normalization risk + divergent second chain.** Canonical `api/routes/admin.js:65-80` runs `normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect → admin → validateCsrfToken → loadAdminPermissions → requireAdminPermission → auditMiddleware`, so unauthenticated bodies are normalized first; `normalizeRequestBody` (`middleware/normalize-fields.js:176-178,180-197`) silently drops duplicate keys preferring whichever arrived first and recurses into nested objects/arrays. `bulkImport.routes.js:26-33` shows `restrict → apiKey → CSRF → loadPermissions → requirePermission → audit` with no visible `protect` in the grep excerpt. Impact: normalization-before-auth wastes work and enables key-shadowing games; the second chain diverges from the canonical contract (if `protect` is truly absent, `loadAdminPermissions` sees no user and fail-closes to 403 = availability break; confirm mount).

**LOW — Global rate-limit kill switches.** `middleware/rateLimiterFactory.js:25-26` and `middleware/auth.middleware.js:424`: skip when `DISABLE_RATE_LIMITER==="true"` or verified-admin. Impact: one env var disables all throttling in prod; stolen admin session = unlimited guessing.

**LOW — Audit gaps + IP attribution mismatch.** `middleware/audit.middleware.js:75-80` skips GET list reads (only two-segment detail GETs audited); `includeBody` false by default (bulkImport) vs true (admin.js); `logAuditEvent` fails silently (`:183-185`). Audit `getClientIp` (`:44-64`) trusts `req.ip` then XFF, while `adminIpAllowlist.resolveClientIp` (`adminIpAllowlist.middleware.js:53-69`) ignores XFF in production — the allowlist decision and the audit record can disagree on client IP (XFF spoofable in logs). Separately, `getRedisClient()` god-node (49 edges) fail-open spots (`aiRateLimiter.js:23-26,66-69`) degrade loudly but acceptably; `resetPassword` instead hard-fails without Redis (`auth.controller.js:1419-1426` → 503), coupling password recovery to Redis availability.

**LOW — `requireImageAuth` checks less than `protect`.** `middleware/auth.middleware.js:747-847` validates JWT type + session `is_active` only — never user existence, `isActive`, or email verification. Impact: deactivated/unverified users' tokens still fetch exam imagery from guarded `/uploads|/storage`.

**LOW — Dead/weak role middleware.** `proPass` (`auth.middleware.js:990-999`) requires `req.user.isProUser`, which `protect()` never sets (`:653-658` sets only `isAdmin/role/sessionId`) — always 403 unless some other layer sets it. `requireRole` is exported but not part of the canonical admin chain; role checks beyond `admin`/`secondTier` are effectively unused there.

## 3. Verification Output

None — read-only dispatch; no commands executed (per contract, no destructive/test execution). All findings are static file:line evidence above, cross-checked against `GRAPH_REPORT.md` god-node list and the canonical chain in `admin.js:65-80` / `API_ENDPOINTS.md:29-37`.

## 4. Blockers or Risks

- Could not execute runtime checks (mount table, `swrCache` key function, Redis-down behavior, `bulkImport` full router file for `protect` presence) — read-only by design. Highest-value follow-ups: (a) confirm `swrCache("auth-me")` key includes user+session id; (b) confirm `protect` in bulkImport chain; (c) live-test lockout counting on `login/2fa` + `verify-otp` with null/missing email; (d) verify `ALLOWED_ADMIN_IPS`/`ADMIN_API_KEY` set in prod (allowlist is no-op when unset, `adminIpAllowlist.middleware.js:77-81`; api-key layer fails open outside prod, `origin.middleware.js:346-360`).
- `ADMIN_IP_ALLOWLIST` vs `ALLOWED_ADMIN_IPS` naming drift between docs (`ADMIN_IP_ALLOWLIST`) and code (`ALLOWED_ADMIN_IPS` at `adminIpAllowlist.middleware.js:77`) — verify which env the deploy actually sets; one of them may be guarding nothing.
- Zero-secret-exposure observed: no secret values read, logged, or reproduced; all token material discussed by reference only.

## 1. Files Inspected (READ_ONLY, no writes)

> Assigned `apps/backend/src/api/routes/tests.js` / `attempts.js` **do not exist** as named — canonical handlers live in `modules/` (verified via `app-port5001.js:977,1001` mounts). Inspected actual targets:

1. `apps/backend/src/modules/tests/test.routes.js` — 1824 lines (start:673-976, autosave:981-1044, submit:1049-1579, result/:attemptId:1581-1713, result:1715-1822, list:90-157, policy:344-401)
2. `apps/backend/src/modules/attempts/attempt.routes.js` — 1381 lines (pause:238-340, resume:345-471, save-progress:476-624, state:629-737, event:742-799, events-batch:816-1004, heartbeat:1009-1083, analytics:1088-1181, proctoring/handoff/sync-replay:1183-1380, throttle-map:71-96, sanitizeRemainingTime:134-150)
3. `apps/backend/src/api/routes/practice.js` — 2969 lines (helpers:49-517, `POST /sessions`:1128-1254, `GET /sessions/:id/questions/:idx`:1448-1481, `POST .../check`:1488-~1700)
4. `apps/backend/src/api/routes/bookmarks.js` — 563 lines (batch-enrich:96-208, `GET /`:238-293, `POST /`:298-375, `PUT/DELETE`:380-455, `check`:460-484, `toggle`:489-561)
5. `apps/backend/src/services/core/TestAttemptController.js` — 482 lines (create:22-118, submit:275-416)
6. `apps/backend/src/services/core/testStateMachine.js` — 67 lines
7. `apps/backend/src/services/core/testScheduler.js` — 91 lines
8. Cross-checked `apps/backend/src/services/core/TestPolicyEngine.js` (import only), `test.helpers.js` (via imports) — **did not modify god nodes** (`dbHelpers/pool/protect`).

## 2. Issues (severity + location + impact)

### CRITICAL / HIGH

**H1 — Test start loads entire user attempt history (N+1 / full-scan, p95 risk)**
`test.routes.js:754-764,854-874` — `dbHelpers.find("attempts",{userId,isCompleted:false})` with no `testId` predicate, then JS `.find/filter` via `idsMatch`; second `find({userId})` for limit + attempt-number count. Every `POST /start` scans all user attempts. Impact: latency grows per user history; attempt-number `previousAttempts.length+1` is read-then-insert **outside unique guard** (relies on 23505 catch at 911-927 + savepoint at 888/930). Concurrent starts serialize only via `users FOR UPDATE` (750) — correct but holds user-row lock while doing 2 full scans + insert.

**H2 — Practice `POST /sessions` sequential fan-out explains ~5s**
`practice.js:1154-1165 → 69-170,175-356,1175-1237`:

- `resolvePracticeFilters` up to 4 sequential `SELECT id FROM subjects/subject_chapters/subject_topics/exams` (81,102,127,151) + repeat at 1175.
- `pickPracticeQuestionIds:346-353` `SELECT q.id ... ORDER BY RANDOM() LIMIT $n` over unindexed `PRACTICE_Q_WHERE` + chapter/topic sub-selects (244-260) — full-scan random sort.
- `getSafeQuestions:405-427` second round-trip + `INSERT practice_sessions` (1213-1232) + 2 hygiene `UPDATE practice_sessions ... is_active` (1193-1210) **not in transaction**.
  Impact: 6-8 sequential queries per start; two concurrent POSTs can both pass hygiene then both insert active rows (no `UNIQUE(user_id) WHERE is_active` guard).

**H3 — `GET /sessions/:id/questions/:idx` 500 on null `questions_json`, not 400**
`practice.js:1450-1471` — `parsePositiveInt("undefined")→null→400` is correct, so watchlist `.../undefined/... 500` is **not** from ID parse. Culprit: `sess.rows[0].questions_json` assumed array; if `NULL` (legacy/abandoned row) `idx >= ids.length` throws `TypeError: Cannot read properties of null` → caught at 1478-1480 → `500`. Missing `Array.isArray` guard (same at 1505, and `PATCH /sessions/:id:1332-1340` trusts `currentIndex` without range/type check). Impact: uncontrolled 500 vs contract 400/404; frontend receives unusable session.

**H4 — Bookmarks `GET ?limit=100` defaults to heavy path**
`bookmarks.js:240-268` — `includeDetails = query !== "false"` defaults `true`; `limit` max 100. Heavy path `batchResolveBookmarkEntities:124-190` does `SELECT *` (questions incl. `options/explanation`, tests `*`, study_materials `*`, videos `*`) + `toCamel` per row, no `ORDER BY`/total. `dbHelpers.find("bookmarks",{userId,isActive},limit,offset)` at 248-256 has no deterministic order. Impact: 5.3s at 100 rows; `SELECT *` + JSONB options over wire. Lightweight `includeDetails=false` exists (260-268) but opt-out, not opt-in.

**H5 — Bookmark dedup is in-memory full-scan, race-prone; toggle bypasses canonicalization**
`bookmarks.js:330-336,464-470,510-516` — `find({userId,itemType,isActive})` (all rows of type) + JS `.find(idsMatch)`. No DB uniqueness (`ON CONFLICT` / partial unique index). `POST /:318-320` canonicalizes via `resolveBookmarkEntity→getInternalId ?? parseNumericId`, but `toggle:537-540` inserts raw `String(itemId)` without resolve. Impact: slug vs int vs `qst_*` forms create duplicates; concurrent toggles double-insert; `check`/`toggle` scan cost grows with bookmark count.

**H6 — Submit `timeSpent` undefined → `NaN` persisted**
`test.routes.js:1122-1133` — `if (timeSpent > duration+30)` is `false` when `undefined`; `clampedTimeSpent = Math.min(undefined, duration)` → `NaN` → `attemptData.timeSpent: NaN` (1263) → `results.time_taken` (1408,1425). No required/number check (autosave at 981-995 correctly 400s on missing `attemptId`; submit only guards `attemptId` at 1064). Impact: DB type error or silent `NaN/NULL` + wrong leaderboard/analytics.

### MEDIUM

**M1 — Two competing attempt implementations (split-brain risk)**
`TestAttemptController.js:22-118,153-173,275-416` uses `status IN ('in_progress','paused','not_started')`, `question_attempts` table, `FOR UPDATE` on `attempts(id)`, inactivity `MAX_INACTIVE_SECONDS=3600` (15). `test.routes.js` uses `isCompleted` boolean + `status='in_progress'/'completed'/'abandoned'`, `answers` JSONB on `attempts`, no inactivity check. `attempt.routes.js:33-39` uses `NOT_STARTED/IN_PROGRESS/PAUSED/SUBMITTED/EXPIRED`. No evidence `TestAttemptController` is mounted (route files use inline handlers). Impact: state-machine, timer, scoring semantics diverge; future edits to one path don't apply to other.

**M2 — State-machine not authoritative on start path**
`testStateMachine.js:60-66` `isAvailableToUsers = PUBLISHED|LIVE`, but `test.routes.js:93-95,685-718` allows `published|active|NULL`, `scheduled` (if past), live-window checks at 789-828, plus `active` tag at 230. `testScheduler.js:6-9,49` only transitions `scheduled→live→expired`, never `scheduled→published`/`published→live`; calls `validateTransition(test,to)` without `questions` (defaults `[]`). Impact: tests reachable that state machine calls unavailable, and vice versa.

**M3 — Attempt save-progress timer + serialization drift**
`attempt.routes.js:522-539` — `totalTimeSpent = previous + (now - lastActivityAt)` wall-clock; `lastActivityAt` also touched by throttled heartbeat/event writes (786-790,990-994,1045-1054, `ACTIVITY_WRITE_THROTTLE_MS=30000` at 74). `answers: JSON.stringify(...)` (534) vs `test.routes.js:1023` raw array vs resume parse branches (421-433,712-722). Impact: double-counted time on frequent autosave; fragile string-vs-array handling.

**M4 — Per-question identifier fan-out on hot paths**
`attempt.routes.js:152-214 (normalizeAttemptAnswers/QuestionTimers)` + `892-894` in batch-events loop — `findQuestionByIdentifier` per distinct `questionId` (cached per-request only). `pause:287-313` fixed with batched multi-row insert (good); `save-progress:553-592` fixed with single fetch + upsert (good); but `events-batch:892-894` still awaits per-event lookup inside `BEGIN` transaction (885-960). Impact: batch of 100 holds transaction open while doing up to 100 lookups; latency + lock contention before violation-count check (935-958).

**M5 — Result endpoints cached 300s — verify user-scoping**
`test.routes.js:1583-1587,1717-1721` `responseCache("test-result*",300)`. Ownership checks exist (1598, `/:testId/result` filters by `userId` at 1744-1752), but if cache key is not `userScoped` (contrast `tests-series-v2` explicitly `{userScoped:false}` at 164), one user's result payload (score/solutions/rank) can serve another. Impact: potential cross-user leak / stale result after reattempt. Needs cache-key audit (outside territory — flagged, not changed).

**M6 — Submit side-effects partially outside transaction**
`test.routes.js:1278-1382` transaction covers attempt update + snapshots (1373) — good (`FOR UPDATE` at 1299, already-submitted idempotent at 1344-1352). But `results` upsert (1395-1429), `publishEvent test_submitted` (1437), `Promise.allSettled` analytics/leaderboard (1459-1485, only when queue disabled), anti-cheat flag update (1518), adaptive `await import(...)` twice (1536-1538, dynamic import executed twice — minor waste). Impact: result/analytics divergence on partial failure; double import cost per submit.

**M7 — Revoked/completed status gaps**
`attempt.routes.js:375-383` resume rejects anything not `PAUSED/IN_PROGRESS` (good), but `save-progress:476+` and `event:742+` don't check `status` (only ownership) — events/heartbeats accepted on `revoked/submitted/completed` (heartbeat maps to label at 1030-1041 but still 200s). `test.routes.js:1013` autosave blocks `isCompleted` but not `revoked/expired`. `attempt.routes state:653-657` blocks only `SUBMITTED`, not `revoked`. Impact: post-revoke writes silently accepted; `revoked` attempts (set at 948-957) can still autosave.

### LOW / HYGIENE

- `test.routes.js:888 SAVEPOINT start_insert` — verified present (not missing); `ROLLBACK TO SAVEPOINT` at 930 correct. No issue.
- `attempt.routes.js:96 setInterval(...).unref` — throttle-map sweep; fine in server, but runs per-process (dual backend → 2 maps, harmless).
- `practice.js:429-432 parsePositiveInt` vs `434-446 toNullableInt` (handles `"undefined"` string) — inconsistent; session routes use strict variant (correct 400) while other filters silently null.
- `practice.js:1489+ check` does 5+ sequential queries (session → correctOption → explanation → prev → upsert → session counters → wrong_questions → 4× revision_queue inserts at 1635-1645 loop) with no transaction — concurrent checks on same index can mis-delta counters; `revision_queue` loop is N=4 round-trips (could be single multi-row insert).
- `bookmarks.js:48-56 sanitizeInput` replaces `<` with `<` (no-op) — XSS sanitizer ineffective; relies on downstream `htmlSanitizer` (outside territory).
- `bookmarks.js:16-25 bookmarkLimiter 50/15min` applies only to `POST /` + `toggle`, not `GET /` — list scraping unthrottled (contributes to slow-list abuse).

## 3. Verification

- Mounts confirmed: `grep "/api/tests|/api/attempt" apps/backend/src` → `app-port5001.js:977,1001`, `modules/tests/test.routes.js:87-1647`, `modules/attempts/attempt.routes.js:216-1358`.
- `glob api/routes/tests.js|attempt*.js` → **no files** (territory names are stale; real files are `modules/*/…` above). `api/routes/practice.js`, `bookmarks.js`, `services/core/TestAttemptController|testStateMachine|testScheduler` read directly with offsets cited.
- Transaction discipline: `test.routes start` `BEGIN (748) → COMMIT via finalizeStartTxn(true) (956)` + early `ROLLBACK` paths (809,820,868) confirmed; `SAVEPOINT` at 888 confirmed present.
- Practice 5s hypothesis: sequential resolver + `ORDER BY RANDOM()` + hydrate + untransactioned hygiene/insert chain cited above; no Redis/session cache on this path.
- Undefined-ID 500 hypothesis: strict `parsePositiveInt` returns 400 for `"undefined"`, so 500 must be `questions_json NULL → ids.length TypeError` (no `Array.isArray` guard) or stale pre-validation deploy — recommend replay with body inspection.
- No frontend/admin/packages/migrations/scripts/docs/git touched; no writes performed.

## 4. Blockers

- None — read-only complete. No god-node changes made.
- To confirm H3/H4/H6 precisely, need runtime replay (out of scope, no verification commands per contract): `POST /practice/sessions` with timing + `EXPLAIN ANALYZE` on the `RANDOM()` picker; `GET /practice/sessions/undefined/questions/0` response-body check; `GET /bookmarks?limit=100` with `includeDetails=true|false` comparison; `PUT /tests/:id/submit` without `timeSpent`.

## 1. Files Inspected

**Infrastructure (`apps/backend/src/infrastructure/database/`):**

- `postgres-helpers.js:182-231` (runtime DDL `runEnsureTestSectionsSchema`), `:649-675` (`reconcileRelationships` live, `initTables` no-op), `:246-327` (`tableMap`), `:684-767` (PII encrypt/decrypt `toCamel`/`toSnake`)
- `migrationRunner.js:1-214` (advisory lock `727274266`, sort, `000`/`056` grandfather, `CONCURRENTLY` bypass, `app.pgcrypto_key` injection `:151-170`)
- `db/relationships.js:1-326` (full `RELATIONSHIP_DEFINITIONS`), `db/constants.js:1-153` (`ENTITY_PREFIXES`, `PUBLIC_ID_PATTERNS`, `JSONB_COLUMNS`), `db/helpers.js:1-35`, `qb.js:1-60` (scaffold, `SAFE_USER_COLUMNS`, no PII decrypt)
- `seeders/index.js:1-86` (`ORDER` subjects→tests→questions→live_tests→exam_rooms→app_settings), `seeders/*.seeder.js` + `_fixtures/` (6 fixtures only)
- `README.md`, `auditTrailManager.js` (referenced, not deep-read)

**Migrations (targeted reads + greps across `migrations/*.sql`):**

- `000_baseline_functions.sql:34,45,55-59,242-273,282-328` (vector ext, `update_updated_at_column`, `prevent_public_id_uuid_mutation`, `soft_delete_record`/`restore_record`)
- `000a_enable_rls_policies.sql:1-80` (`rls_apply_if_table_exists`, `users_self_read` with `OR current_user_id() IS NULL`)
- `018:111-122` (`revision_queue` `priority VARCHAR(20) DEFAULT 'medium'`), `019:334-360,431-473,708` (plain `VARCHAR public_id`, `fk_wrong_questions_*`, `fk_revision_queue_question`, trigger loop), `027:20-21,106-128` (`tpl_` generated, `embedding VECTOR(1536)`, ivfflat commented out)
- `032_standardize_soft_delete.sql:1-125`, `033:69-106` (`stp_` generated), `038:30-36` (`dbr_`), `039:190,789-790,980-982` (moderation priority, revision_queue index, ivfflat create)
- `042_placeholder_retired.sql:1-14`, `043:55-60`, `044:55-68` (UUID-only `public_id`, not prefixed TEXT), `065:1-159` (initTables-only tables incl. `practice_sessions`/`practice_answers:89-91` with `is_skipped/time_taken_sec/mode`), `080:1-23` (`vid_` generated)
- `076:1-49` (embeddings `VECTOR(1536)` + ivfflat), `088_encrypt_pii_at_rest.sql:1-188`, `093:1-50` (HNSW `CONCURRENTLY`), `096:1-51`, `099:1-114` (`auth.uid()` policies), `104:1-74`
- `116:1-100,361` (SECURE RLS, helpers `current_user_id_setting/current_is_admin/is_service_role`, user-table list, embeddings), `129:1-57` (taxonomy cascades), `134` (via `137:7-8` reference + grep `83-93` HNSW redo), `137:1-25`, `138:1-183`, `139:1-104`, `140:1-28`, `141:1-14`, `128:1-15`, `115:39-42,103-106`, `070:25`, `073:98`

**Docs:** `docs/legacy-migrations/README.md:1-11` (004–017 in `098`, `042` retired, `056a/b`/`057b` grandfather, `000a` suffix), `SCHEMA_DIAGRAM.md` (listed, not deep-read).

> `scripts/run-database-audit.js` and route/service writers (`practice.js`, `smartRevision`, `recommendationService`) are **outside assigned territory** — not inspected. Live-DB drift claims below rest on `138/139` header attestations + code-comment cross-refs, not direct `information_schema` verification.

## 2. Issues

### A. Schema drift — live DB ahead of shipped chain (contract DoD)

1. **`revision_queue.priority` type divergence — no `ALTER TYPE` anywhere.** Baseline `018:116` creates `VARCHAR(20) DEFAULT 'medium'`; live is `INTEGER` (per `138:101-103` comment "smartRevision writes ints"). `138:101-104` only `ADD COLUMN ... IF NOT EXISTS` — on any DB where `018` already created the VARCHAR column it is a **no-op**, so fresh-from-repo stays VARCHAR while prod is INTEGER. No migration does `ALTER ... TYPE INTEGER USING ...`. Also conflicts with `039:190`/`095:15` VARCHAR priority convention for sibling queues.
2. **`practice_answers.is_skipped/time_taken_sec/mode` already in `065:89-91`** — `138:170-181` re-add is harmless guarded duplicate, confirming drift was already partially reconciled. Real gap was `wrong_questions.test_id/source_attempt_id/last_seen_at/metadata/is_active` (`138:32-51`) and `revision_queue.source_attempt_id/schedule_day/due_at/status/completed_at/metadata` (`138:81-109`), plus `user_recommendations.payload/generated_at/expires_at/is_active/updated_at` (`139:45-77`). All `139`/`138` adds are existence-guarded, correct pattern.
3. **`practice_sessions/practice_answers.updated_at` missing at creation, trigger assumes it.** `065:58-94` creates both tables **without** `updated_at`; generic trigger loops (`018:532`, `019:708`, `025:299`, `026:128`, `027:145`) attach `set_updated_at → update_updated_at_column()` unconditionally → `140:2` error `record "new" has no field "updated_at"`. `140:4-5` backfills columns (correct) but `140:16,26` attaches triggers **without** the `IF EXISTS (pg_proc ... update_updated_at_column)` guard used in `030:262`, `046:590`, `068:336` — if `000` failed/skipped, `140` aborts the whole runner (fail-closed per `migrationRunner.js:203`).

### B. Migration ordering / append-only violations

4. **Retired/gapped slots are intentional — do not "fill".** `004-017` absent (reconstructed in `098` per `README.md:5`); `042` is deliberate no-op (`042:1-14`); `056a/056b`, `057b` letter-suffixes + `000/000a` pair grandfathered in `migrationRunner.js:115`. Duplicate-prefix guard (`migrationRunner.js:104-126`) enforces uniqueness going forward. Next file must be `142_*`.
5. **Shipped-file mutation:** `137:7-8` self-documents "a working-tree edit renamed an index inside shipped `134_database_audit_remediation.sql`; shipped files are append-only". `137:15,23` repairs via `idx_topics_subject → idx_subject_topics_subject` + canonical create. Drifted DBs may now carry **both** names; guard checks `pg_indexes` by old name then `IF NOT EXISTS` new — convergent, but audit should confirm no code references the old name.
6. **`128` is a stub delegating to forbidden territory.** `128:1-15` only creates `test_id_remap_backup`; comment says "In-place re-indexing executed via `scripts/execute-reindex-tests.mjs`". Consecutive-ID rewrite of `SERIAL` PK with live FKs (`attempts`, `test_questions`, `questions`, `leaderboards`) is high-risk; no FK-safe remap SQL in-repo. Verify script exists + is idempotent before ever running `128` on prod.

### C. RLS gaps

7. **`000a` anon bypass.** `000a:61,66` policies `USING (id = current_user_id() OR current_user_id() IS NULL)` grant wide-open access when GUC unset. `116:6-10` explicitly calls this out and removes the bypass — but `000a` policies are never `DROP`ped by `116` (which uses `DROP POLICY IF EXISTS` per new names only). Overlapping old+new policies persist.
8. **Two incompatible auth idioms coexist.** `099:37-39,48-50,58-60` uses Supabase `auth.uid()` + `current_setting('role')='service_role'`; backend actually sets `app.current_user_id` / `app.is_admin` (`116:34,55`). `099` policies never match app connections → deny-by-default except service_role. `116:24-74` introduces correct `SECURITY DEFINER` wrappers (`current_user_id_setting`, `current_is_admin`, `is_service_role`) with fixed `search_path` — correct direction, but `099` helper `create_policy_if_not_exists:6-30` means stale `099` policies remain. Needs per-table `SELECT * FROM pg_policies` reconciliation on `attempts/bookmarks/notifications` at minimum.
9. **Coverage hole + no auto-RLS trigger.** `000a` covers ~8 tables; `116` covers 41 (list starts `116:80-100`, includes `practice_*`, `certificates`, `two_factor_secrets`; `embeddings` at `116:361`). New tables `webhook_events` (`120`), `user_recommendations` (`139` creates without `ENABLE RLS`), `outbox_events`, `practice_ai_cache`, `subject_videos` FortSpy columns (`141`) have no evidenced RLS in inspected slices. No event-trigger auto-`ENABLE RLS` found in inspected files (only per-table `ENABLE` in `099` + `rsl_apply_if_table_exists` helper) — "RLS auto-trigger" claim unverified from territory.

### D. Soft-delete trio inconsistency

10. **Split-brain between `032` and `096`.** Canonical RPC `000:293-300` requires `is_deleted/is_active/deleted_at/deleted_by + updated_at`. `032:83-109` adds `is_deleted/deleted_at/deleted_by` **only if `is_active` exists**, plus partial indexes — but not `deleted_reason`. `096:1-3` claims RPC needs `deleted_reason`, then `096:23-25` adds `deleted_by/deleted_at/deleted_reason` but **not** `is_deleted/is_active`. Neither migration alone yields the full set.
11. **Wrong table names in `096:10-19`.** List uses `chapters/topics/subtopics/units/sections` — live names are `subject_chapters/subject_topics/subject_subtopics/subject_units` (`129:9-28`) and `test_sections`. Loop swallows errors (`096:27-29` `EXCEPTION ... NOTICE 'Skipping'`) → intended tables silently skipped. `096:38-49` FKs target `question_bookmarks/question_reports` (exist per `065:99,140`) but constraint names `fk_qb_question/fk_qr_question` collide conceptually with `019` `fk_*` on `wrong_questions` — verify no duplicate-constraint error on re-run.

### E. Dual-ID `public_id` fragmentation

12. **Three incompatible flavors:** (i) generated prefixed TEXT (`033:94-95` `stp_`, `027:21` `tpl_`, `038:31` `dbr_`, `080:14` `vid_`); (ii) UUID-only (`043:58`, `044:55`); (iii) nullable plain `VARCHAR UNIQUE` (`019:338-360` for `study_streaks/wrong_questions/revision_queue`). (iii) permits NULLs (UNIQUE ignores NULLs → duplicates-by-absence) and has no generation → `prevent_public_id_uuid_mutation (000:55-59)` + `get_user_public_id (000:242-254)` assume a `public_id` column that many `108`-baseline tables lack. `db/constants.js:3-31` registry (`rvq_`, `wq_`, `vid_`, `subs_` vs `subj_` collision fix) has no DB-side generation for `rvq_/wq_` — app must populate or column stays NULL. `PUBLIC_ID_PATTERNS :35-83` enforces UUID-suffix shape app-side only.

### F. pgvector index churn

13. **ivfflat → HNSW migration churn + runner subtlety.** `000:34` enables `vector`; `027:127-128` leaves ivfflat commented; `039:980-982` + `076:23-24` build ivfflat; `093:16-17` drops ivfflat, `093:30-36` builds HNSW `CONCURRENTLY (m=32, ef_construction=200)`. Runner handles `CONCURRENTLY` by skipping transaction (`migrationRunner.js:174-179`) — correct — but `093` mixes `SET maintenance_work_mem (093:10)`, transactional `DO` drops (`093:13-22`), two `CONCURRENTLY` creates, and `ALTER DATABASE ... SET hnsw.ef_search (093:43)` in **one file sent as a single `client.query`** — `CONCURRENTLY` + `DO`/`SET` in one implicit multi-statement string is fragile across drivers; `093:8` fails fast if `embeddings` (from `076`) missing (no extension guard). `134:83-93` rebuilds the same HNSW indexes **transactionally** (non-concurrent) → duplicate logic, divergent path, full-index rewrite on fresh deploys. No per-session `SET hnsw.ef_search=100` found in inspected territory (only `093:45` NOTICE).

### G. FK cascades vs soft-delete + stale reconcile map

14. **`129:6-47` unguarded destructive cascades.** Bare `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` with **no table/column existence guard** (unlike `138/139` style) → fails fresh/partial DBs. `ON DELETE CASCADE` on taxonomy spine (`129:7,11,18,21,28`: subject→units→chapters→topics→subtopics) means deleting one subject hard-deletes the subtree — directly contradicts soft-delete intent (`032/096`). Questions correctly use `SET NULL` (`129:32-47`).
15. **`relationships.js` references legacy names.** Map uses `units/chapters/topics/subtopics` (`:254-298`) and `questions.chapter_id→chapters (:121-128)` while live schema is `subject_units/subject_chapters/subject_topics/subject_subtopics` (`129`). `reconcileRelationships (postgres-helpers.js:649-664)` runs every boot via `ensureForeignKey` — will attempt FKs on nonexistent tables/columns each boot (noise + risk of `dropIfMismatch` drops on `attempt_answers/ tests.subject_id`). It also **omits** `revision_queue/practice_answers/wrong_questions/user_recommendations/source_attempt_id` FKs entirely (grep: zero matches) — consistent with `138:17-20` "MUST leave NULL" practice-path rule, but leaves test-path `source_attempt_id→attempts(id)` unenforced (only `019:447-456` covers legacy `attempt_id`, not new `source_attempt_id`).

### H. Encryption `m088/m104` regression

16. **`104` regresses `088` hardening.** `088:54,153-154` sets `search_path=public,pg_catalog,pg_temp` + `088:96-110` revokes `PUBLIC/anon/authenticated`, grants `service_role` (hardened further in `115`). `104:21-50` redefines `encrypt_pii/decrypt_pii` **without** `SET search_path` and **without** REVOKE/GRANT → search_path hijack surface + privilege widening. `104:55-68` trigger syncs only `NEW.mobile` (`104:60`), dropping `088:162` `COALESCE(phone,mobile)` + phone→mobile mirroring (`088:164-169`) → phone-only writes leave `phone_enc` NULL. `088:22-23` promises follow-up `122` drops plaintext; `122` is response-time indexes (no drop) → plaintext retained indefinitely. Runtime write pool never sets `app.pgcrypto_key` (`104:1-10` comment; only `migrationRunner.js:168-170` sets it per-migration) → DB trigger is no-op in prod; app-layer `aes-256-gcm` in `postgres-helpers.js:684-767` is the real path — dual-cipher (`pgp_sym_encrypt aes256-CFB` vs `aes-256-gcm`) documented in `088:14-19` but rotation story untested here.

### I. Runtime DDL vs migrations (god-node adjacency)

17. **Runtime DDL survives alongside no-op `initTables`.** `initTables (postgres-helpers.js:670-675)` is correctly a no-op with "new DDL MUST go through migration" comment — but `runEnsureTestSectionsSchema (182-231)` still `CREATE TABLE test_sections` + `ALTER tests/test_questions/attempts/bookmarks/csrf_tokens` at runtime, **outside** the advisory lock (`migrationRunner.js:28-39`) and duplicating `065:6-19`, `103` (bookmarks VARCHAR), `037` (csrf index). No signature change proposed to `PostgresHelpers/dbHelpers` (52/138 edges) or `pool` (113 edges) — flag only: delete or gate this path behind the migration chain; do not alter helper signatures lightly.

### J. Seeders

18. **Minimal, FK-ordered but incomplete.** `seeders/index.js:30-37` order respects FKs; `runSeeders:43-46` runs migrations first + clears column cache (good). Only 6 seeders (subjects/tests/questions/live_tests/exam_rooms/app_settings) — no `stages/exam_categories/subscription_plans/roles/permissions/users` baseline → fresh-DB admin/RBAC/commerce paths unseeded. `BaseSeeder` conflict strategy (`ON CONFLICT DO NOTHING` vs upsert) not verified within budget — confirm before relying on idempotency claim in `index.js:8-9`.

## 3. Verification

- **Enumerated:** `postgres-helpers.js` runtime DDL block, `migrationRunner.js` lock/sort/`CONCURRENTLY`/crypto-key logic, `relationships.js` full map, `constants.js` prefix registry, `065/088/104/093/096/099/116/129/137/138/139/140/141/032/042/128` full reads, `000/000a/018/019` targeted slices, `legacy README` chain notes.
- **Grep-verified:** `revision_queue.priority` (VARCHAR in `018:116` vs INTEGER in `138:102-103`), `practice_answers` triple (in both `065:89-91` and `138:170-181`), `vector(1536)/ivfflat/hnsw` chain (`000→027→039→076→093→134`), `public_id` three-flavor split, `update_updated_at_column/deleted_reason/soft_delete_record` cross-refs, zero FK coverage for `revision_queue/practice_answers` new columns, `CONCURRENTLY` handling in runner.
- **Not executed:** no DDL, no `DROP/TRUNCATE`, no live-DB `information_schema` check, no `scripts/` reads (forbidden), no frontend/admin/route reads (forbidden). Drift items citing "live DB verified via information_schema" rely on `138:13-15` / `139:10-12` header attestations.
- **Suggested read-only follow-ups (for orchestrator):** `SELECT column_name,data_type FROM information_schema.columns WHERE table_name IN ('revision_queue','practice_answers','wrong_questions','user_recommendations')`; `SELECT tablename,policyname FROM pg_policies WHERE schemaname='public'`; `SELECT indexname FROM pg_indexes WHERE tablename IN ('embeddings','question_search_index','revision_queue','subject_topics')`; `SELECT * FROM schema_migrations ORDER BY 1` to confirm `128-141` applied + `134` hash (detect edited-shipped-file divergence).

## 4. Blockers

1. **No live-DB access** — INTEGER-vs-VARCHAR priority, `practice_answers` extra columns, and `user_recommendations` drift cannot be closed as "fixed" without `information_schema` snapshots; `138/139` are conditional-ADD only and cannot repair wrong-typed columns.
2. **Forbidden paths hide both ends of the contract** — writer column lists (`practice.js`, `analyticsService.recordPracticeAnalytics`, `smartRevision`, `recommendationService.saveRecommendations`) and `scripts/run-database-audit.js` schema patterns are out of territory; RLS/soft-delete/FK conclusions are schema-side only.
3. **Unread within territory (budget):** full `116:101-404` policy table list, `106/107/108` DDL (Node Engine V2 / Practice redesign / baseline), `099:61-114` tail, `134` full body, `BaseSeeder.js` conflict semantics, `auditTrailManager.js`, `qb.js:61-371` remainder. Recommend a second pass scoped to those files before any DDL is authorized.

## 1. Files Inspected

**Routing / shell:**

- `apps/frontend/src/App.jsx` (381 lines) — all routes via `lazyWithRetry`, `createRoute`/`wrapElement`, `standaloneRoutes` + `layoutRoutes`, `AdminPanelRedirect`, skip-link
- `apps/frontend/src/app/routes.jsx` (88 lines) — `RootRoute`, `wrapElement` (RouteErrorBoundary+ProtectedRoute+FeatureGate), `createRoute`
- `apps/frontend/src/shared/utils/lazyWithRetry.js` (99 lines)
- `apps/frontend/src/shared/components/common/RouteErrorBoundary.jsx` (78 lines)

**Target pages:**

- `apps/frontend/src/pages/exams/ExamCompare.jsx` (279 lines)
- `apps/frontend/src/pages/exams/ExamYear.jsx` (463 lines)
- `apps/frontend/src/pages/exams/ExamsNew.jsx` (1 line: `export {default} from "./Exams"`)
- `apps/frontend/src/pages/exams/ExamDetails.jsx` (773 lines)
- `apps/frontend/src/pages/exams/index.js` (9 lines)
- `apps/frontend/src/pages/tests/PYPTest.jsx` (413 lines)
- `apps/frontend/src/pages/tests/PracticeLab.jsx` (2234 lines, sampled 320-489) + `pages/tests/components/PracticeWorkspace.jsx:165`
- `apps/frontend/src/pages/tests/TestInterface.jsx` (2583 lines, sampled 425-524)
- `apps/frontend/src/pages/dashboard/Bookmarks.jsx` (lines 63,126,150)

**Lib / providers / hooks:**

- `shared/lib/practiceAPI.js` (158 lines), `bookmarksAPI.js` (28 lines), `testsAPI.js` (97 lines), `language.js` (346 lines)
- `shared/lib/telemetry/TelemetryService.js` (573 lines), `telemetry/OfflineQueue.js` (103 lines), `telemetry/index.js`, `telemetry/videoTelemetry.js`
- `shared/lib/offline/IndexedDBAttemptVault.js` (637 lines)
- `shared/providers/AuthContext.jsx`, `AuthProvider.jsx` (563 lines), `authSession.js`, `useAuth.js`
- `shared/hooks/useProPass.js` (202 lines)
- `shared/types/index.js` (`mapUserToFrontend:135-189`, avatar:148-167)
- `shared/config/assets-config.js` (`getAssetUrl:310-348`, `getAvatarUrl:234-242`)
- Grep sweeps for `includeDetails|bookmarksAPI`, `useProPass|avatar|OfflineQueue|Telemetry`, `practiceAPI.(startSession|getQuestion|getSession)` to confirm call-sites

## 2. Issues

| #   | Severity                                 | Location (file:line)                                                                                                                                                                                                                                             | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Info / Fixed**                         | `pages/exams/ExamCompare.jsx:29-64,154-173`                                                                                                                                                                                                                      | **Sample fallback GONE.** No `getSampleData()`. Fetches `/api/exams/${examId}/compare?years=...`, error/empty renders "Comparison data unavailable" + Try Again. Prior REPO_BRAIN claim of fallback is stale. Residual nits: `selectedYears` setter unused (`_setSelectedYears:21`); years hard-coded `["2026","2025"]` with no UI; `comparisonFields:66-73` uses key `vacancies` while `ExamYear.jsx` uses `vacancy` — verify backend contract; `getChangeIndicator:92-100` does `parseInt` on date strings (NaN-safe only because `parseInt(current)>parseInt(previous)` is false → returns decrease arrow incorrectly for dates).                                                                                                                    |
| 2   | **Low (orphan)**                         | `pages/exams/ExamDetails.jsx:1-773` vs `App.jsx:78-83,244-256` + `pages/exams/index.js:4`                                                                                                                                                                        | **ExamDetails orphan confirmed.** Full React-Query implementation (exam-info/updates/yearly-data/category, enroll/unenroll mutations) but never `lazy()`-imported or routed; `App.jsx` routes `/exam/:examId` → `ExamInfoNew`, `/exam/:examId/year/:year` → `ExamYear`. Not in bundle (no import), but 773L dead code + exported from `index.js`. Route or delete.                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | **Info (benign alias)**                  | `pages/exams/ExamsNew.jsx:1`, `index.js:3`                                                                                                                                                                                                                       | **Not an orphan page.** Single-line re-export of `./Exams`. Never routed directly, but harmless alias. Either route it or remove export to avoid confusion. No bundle cost.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | **Low (fixed, residual)**                | `pages/exams/ExamYear.jsx:35-60,83-116`                                                                                                                                                                                                                          | **Sample fallback GONE.** Proper `error` state + Retry, `AbortController`, `isNaN(yearNum)` guard. Clean.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | **Low (fixed, residual)**                | `pages/tests/PYPTest.jsx:31-99,207-250`                                                                                                                                                                                                                          | **Real-API wiring confirmed** (`getTestById` + `getQuestionsByTestId` + `POST /api/tests/:id/start`, `PUT /api/tests/:id/submit`). Residual: `navigate(/test-result/pyp/${pypId}):241` relies on generic `/test-result/:seriesId/:testId` route with `seriesId="pyp"` — works but `TestResult.jsx` must special-case it; empty-questions shows bare `Test not found:260-262` with no retry.                                                                                                                                                                                                                                                                                                                                                             |
| 6   | **Medium-Fixed (verify child contract)** | `shared/lib/practiceAPI.js:3-8,10-46` + `pages/tests/PracticeLab.jsx:334-353,439-448` + `components/PracticeWorkspace.jsx:165`                                                                                                                                   | **`undefined`-id hardened at API layer.** `getSessionId()` throws on `undefined/null/""` (no more `GET .../undefined` 500); `normalizeSession()` unifies `id/sessionId/session_id`; `startSession()` throws if response lacks ID. `handleStartSession` try/catches with toast. Residual risk: `onResume(session)` calls `practiceAPI.getSession(session.id):441` — shape of `session` comes from `PracticeHubDashboard` child (not audited here); if child passes `{sessionId}` only, `session.id` is undefined and throws client-side (good — explicit, but resume fails). `PracticeWorkspace getQuestion(session.id, idx):165` assumes normalized session. Recommend defensive `session.id ?? session.sessionId` at call-sites.                       |
| 7   | **Medium (perf)**                        | `pages/tests/TestInterface.jsx:436-439` (GOOD) vs `pages/dashboard/Bookmarks.jsx:63,126,150`                                                                                                                                                                     | **Split behavior.** TestInterface correctly uses `bookmarksAPI.getAll(1,100,{includeDetails:false})` with comment. Dashboard `Bookmarks.jsx` calls `getAll(1,50)` / `getAll(page,50)` with **no `includeDetails`** — falls back to backend default (likely enriching path → the 5.3s `?page=1&limit=100` symptom). `bookmarksAPI.js:4-11` supports the param. Fix: pass explicit `includeDetails` (false for ID-only prefetch, true + small limit for detail view) or paginate 20.                                                                                                                                                                                                                                                                      |
| 8   | **Good**                                 | `App.jsx:12,38-125` + `lazyWithRetry.js:25,54-97` + `routes.jsx:47-65`                                                                                                                                                                                           | **Lazy-loading + boundaries correct.** Every page via `lazyWithRetry` (2 retries, backoff, one-time reload guard cleared only on success). `TEST_PATH_RE:25` correctly exempts `/tests/                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | /live-tests/ | /pyp/*/test | /test/ | /test-result/ | /test-review/`from auto-reload (prevents killing attempts). Every route wrapped in`RouteErrorBoundary`via`wrapElement`. One root `Suspense → PageSkeleton`. `RouteErrorBoundary.jsx:16-25,54-69`distinguishes chunk vs generic errors, dev-only stack, Reload + Try-Again. Global`ErrorBoundary`outer in`App.jsx:349`. No missing boundary found. |
| 9   | **Good**                                 | `shared/lib/language.js:47-102,112-129,236-306`                                                                                                                                                                                                                  | **i18n robust.** `getLocalizedField(field, lang)` handles string/array/object, `<span class="eqt/hqt">` extraction, `decodeHtmlEntities`+`cleanHtmlWrapper`, en↔hi fallback, last-resort `en/hi/text/value`. `parseLanguageList/formatLanguagesDisplay/getLanguageDisplayName` handle arrays/JSON/CSV/`/`-separated + 22-language map. Minor: `pickDefaultLanguage:112` only scores en/hi, ignores bn/ta/te etc. — acceptable for current bilingual UI.                                                                                                                                                                                                                                                                                                 |
| 10  | **Good (minor note)**                    | `telemetry/TelemetryService.js:85-95,171-242,252-287,307-358,363-406` + `telemetry/OfflineQueue.js:10-26` + `offline/IndexedDBAttemptVault.js`                                                                                                                   | **Offline queue sound.** Batch flush 8s, heartbeat 30s, 100/batch cap, 1000-event memory cap with FIFO evict + `droppedEventsCount`, `sendBeacon` + sync-XHR fallback on unload, `OfflineQueue` (localStorage per-attempt) + `IndexedDBAttemptVault` (attempts/answers/syncQueue + memory fallback + `batchSyncAttemptReplay` with `idempotencyKey` + `setupAutoReplayListener` on `online`). `getMetrics()` exposes queueDepth/age/dropped. Minor: `OfflineQueue.enqueue` does sync `localStorage` read+write per event while offline (main-thread cost at high event rates); `droppedKey` never auto-cleared (monotonic per attempt).                                                                                                                 |
| 11  | **Low-Medium (coupling)**                | `shared/hooks/useProPass.js:12` (`import {useAuth} from '../providers/AuthContext'`)                                                                                                                                                                             | **Coupling confirmed.** Hook hard-imports app `AuthContext`; not portable to `packages/` or admin-panel. Also dual source of truth: `AuthProvider.jsx:483-487 hasProPass()` (simple `isProUser+expiry`) vs `useProPass:18-138` (admin-unlimited, `is_pro/is_pro_user` variants, `remainingDays/urgencyLevel/statusText`). Refactor to `useProPass(user?)` / DI param. Functional correctness OK (admin→unlimited, expiry-gated `isActive`, `hasProPass:isActive` compat).                                                                                                                                                                                                                                                                               |
| 12  | **Medium (UX)**                          | `shared/types/index.js:148-167` + `config/assets-config.js:310-348` + consumers (`dashboard/Settings.jsx:794-799,920-925`, `components/layout/NavbarProfile.jsx:46-52`, `pages/tests/QuestionPalette.jsx:149-153`, `components/PracticeWorkspace.jsx:1072-1076`) | **Avatar 404 has no client fallback.** `mapUserToFrontend` → `getAssetUrl()` correctly resolves `data:/blob:` passthrough, absolute http(s), `/absolute` via `VITE_API_URL` minus `/api` (prod falls back to `window.location.origin`, never stale localhost). Returns `""` for null → callers show initials (good). But when backend returns a **dangling local path** (`/assets/avatar/avatar_1_*.webp` with no file / S3 provider), `<img src={user.avatar}>` 404s with broken-image icon — no `onError` handler in Settings/Navbar/QuestionPalette/PracticeWorkspace. `StudyMaterialChapter.jsx:1915,1950,2331` already uses `ui-avatars.com` fallback pattern — apply same (`onError` → initials or `getAvatarUrl(name)`) to profile/test avatars. |
| 13  | **Good**                                 | `App.jsx:343-348`, `TestInterface.jsx:496-527`                                                                                                                                                                                                                   | **a11y/UX positives.** Skip-to-main-content link present; bookmark toggle is optimistic with revert on failure; PracticeLab deep-link guarded by `deepLinkLaunchedRef` against StrictMode double-fire.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 3. Verification

- Read-only inspection only (per contract — no verification commands run). All claims above cite `file:line` from direct `Read`/`Grep` output in this session.
- Cross-checked: `App.jsx` route table vs `pages/exams/index.js` exports (ExamDetails absent from routes); `ExamCompare.jsx` full-text search for `Sample/getSampleData` (zero hits); `PYPTest.jsx` for hardcoded question arrays (none — real API); `practiceAPI.js` guard + `PracticeLab.jsx` call-sites; `bookmarksAPI.js` param plumbing + both consumers; `lazyWithRetry` + `RouteErrorBoundary` + `wrapElement` composition; `language.js` fallback branches; `TelemetryService/OfflineQueue/IndexedDBAttemptVault` flush/replay paths; `useProPass.js:12` import; `getAssetUrl` + `<img>` consumers lacking `onError`.
- NOT verified (out of territory): backend `/api/exams/:id/compare` response shape (`vacancies` vs `vacancy`), `/api/bookmarks?includeDetails=` server default, `/api/practice/sessions` latency root cause, live avatar 404 reproduction. Needs backend agent + authenticated replay per runtime-watchlist rule.

## 4. Blockers

- None. All assigned paths were readable; forbidden paths (`apps/backend`, `apps/admin-panel`, `packages`, `scripts`, git/writes) were not touched.
- One shape-uncertainty for the orchestrator: exact object shape emitted by `PracticeHubDashboard onResume(session)` (child component not in sampled scope) determines whether `PracticeLab.jsx:441 session.id` can still be undefined despite the API-layer guard. Recommend one follow-up read of that child or a runtime replay with devtools network tab.

## 1. Files Inspected (~28, all under `apps/admin-panel/src`)

**Routing / exports / nav:**

- `App.jsx:1-377` — full route table (all `/admin/*` mounts, lazy imports, redirects, catch-all 404)
- `features/admin/index.js:1-66` — barrel re-exports (40 entries)
- `shared/config/adminNavConfig.js:1-150` (of 561) — nav categories/items
- `shared/components/AdminLayout.jsx` (referenced, not re-read — sidebar/drawer host)

**Target managers:**

- `features/admin/study-materials/SubjectHierarchyManager.jsx:1-80,902` (902L total; default export line 40 + `export {SubjectHierarchyManager as SubjectHierarchyView}` line 902)
- `features/admin/study-materials/StudyMaterialsManager.jsx:780-839` (tabs array 795-817)
- `features/admin/study-materials/TopicsManager.jsx:17`, `SubjectRelationsManager.jsx:38`, `CurriculumBuilder.jsx:55,207,2523`, `components/ContentHierarchySidebar.jsx:4`
- `features/admin/audit-compliance/ResultsManager.jsx:1-532` (full)
- `features/admin/subscriptions-monetization/PaymentsManager.jsx:1-60` (of 493)
- `features/admin/moderation/ModerationManager.jsx:1-60` (of 1776)
- `features/admin/system-settings/TwoFactorManager.jsx:1-60` (of 619)
- `features/admin/system-settings/LiveTestMonitor.jsx:1-60` (of 443)
- `features/admin/users-enrollments/UsersPermissions.jsx:1-42`
- `features/admin/assessments-quizzes/TestsManager.jsx:92,734,1707` (SECTION_PRESETS consumer), `components/TestFormModal.jsx:13,751`, `components/BulkImportModal.jsx:1-60` (of 208), `QuizzesManager.jsx:448`

**Shared guard/validation/data layer:**

- `shared/components/ProtectedRoute.jsx:1-132`
- `shared/lib/rbac.js:1-102`
- `shared/lib/validationSchemas.js:1-121` (full)
- `shared/lib/settingsSchema.js:11` (referenced via grep)
- `shared/lib/api/adminAPI.js:1-120,240-369` (of 406)
- `shared/lib/dataService.js:1-100` (of 492), `shared/lib/apiClient.js:140-201` (via grep)
- `shared/config/sectionPresets.js:1-868`

## 2. Issues (file:line)

**Missing / broken routes:**

1. `SubjectHierarchyManager.jsx:40,902` — **unrouted orphan confirmed**. No `<Route>` in `App.jsx`, no export in `features/admin/index.js:27-33`, not in `StudyMaterialsManager.jsx:795-817` tabs (`subjects`/`curriculum`/`subject-relations` only), `ContentHierarchySidebar.jsx:4` does not import it. 902L of dead code; only direct import can reach it. Calls `apiClient.get("/admin/subjects|/topics|/chapters")` (`SubjectHierarchyManager.jsx:66-70`).
2. `TopicsManager` — **redirect-to-nowhere**. `App.jsx:227-232` redirects `/admin/topics → /admin/study-materials?tab=topics`, but `StudyMaterialsManager.jsx:795-817` has no `topics` tab id (only `subjects|curriculum|subject-relations`), so `activeTab` (`:819-820`) falls back to `subjects`. Same pattern for `/admin/curriculum → ?tab=curriculum` (`App.jsx:233-238`) which **does** work (curriculum tab exists). Partial mitigation: `CurriculumBuilder.jsx:55` has an _internal_ `topics` sub-tab, but it is not `TopicsManager.jsx:17`. `TopicsManager` is exported (`index.js:29`) but unreachable as its own page.
3. `features/admin/index.js` **stale vs `App.jsx`**: missing barrel exports for `PaymentsManager` (routed `App.jsx:297`), `ModerationManager` (`App.jsx:298`), `TwoFactorManager` (`App.jsx:299`), `LiveTestMonitor` (`App.jsx:247`), `LiveProctoringConsole` (`App.jsx:145-147,248-252`), `SubjectHierarchyManager`, `ServerLogsManager` (routed `App.jsx:288`). Also `ComingSoonManager` is exported (`index.js:62`) but its route redirects to settings (`App.jsx:268-271`) — dead nav entry if nav still lists it.
4. `LiveProctoringConsole` — **extra unindexed route**: `App.jsx:248-252` (`live-proctoring`, `live-proctoring/:liveTestId`) exists but has no barrel export and (from nav header read) no confirmed `adminNavConfig` entry — verify nav before calling it discoverable.
5. Duplicate `/admin/deep-analytics` route (`App.jsx:218` and `:285`) — harmless (same element) but indicates route-table drift.

**Placeholders (narrowed, not fully cleared):** 6. `ResultsManager.jsx:514-516` — list/export/detail modals are implemented (CSV `43-85`, detail `370-461`, analytics `464-529`, pagination `313-367`), but the analytics modal still renders `"Detailed question-wise analytics coming soon."` — the question-wise breakdown the dispatch asks for is still a placeholder. Minor: row key `result._id` (`:243`) vs backend integer/`public_id` id convention — confirm shape of `adminAPI.getResults()` (`adminAPI.js:358` → `GET /admin/results`).

**Duplication (resolved — no action):** 7. `SECTION_PRESETS` — **single source confirmed**. Only definition is `shared/config/sectionPresets.js:3,866-868` (frozen). Consumers are `TestsManager.jsx:92,734,1707` and `TestFormModal.jsx:13,751`. No inline duplicate remains. Grep for `SECTION_PRESETS|sectionPresets` returns only these 3 files.

**Validation gaps (real bug + coverage holes):** 8. `validationSchemas.js:82-97` — **dangling `.refine()`**. `topicSchema` closes at `:74`; lines 82-97 start with `.refine(data => data.subjectId !== data.relatedSubjectId, …)` with no base object on those lines (relies on ASI continuation of the `z.object(...)` expression). `relatedSubjectId` exists nowhere in `topicSchema` (`:65-74`), so the guard is vacuous (always `subjectId !== undefined` → pass). Any subject-prerequisite rule is unenforced client-side. 9. **No Zod schemas for**: payments/refunds, moderation actions, 2FA, exams/stages info, study-materials/curriculum, banners/FAQs/coupons/promotions, enrollment, live-test entities. Only `questionSchema:3`, `testSchema:23`, `categorySchema:39`, `stageSchema:49`, `topicSchema:65` + `settingsSchema.js:11` exist. `SubjectHierarchyManager.jsx:23-26` correctly uses `validateForm+topicSchema`, but most managers have no schema to call — server-side `express-validator` remains the only gate (acceptable, but client UX degrades to raw API errors).

**Permission-bypass / guard-chain risks (frontend scope):** 10. `ProtectedRoute.jsx:88-89` — **fail-open on empty perms**: `(user.role==="admin" && userPerms.length===0) || (user.isAdmin===true && userPerms.length===0)` → `isSuper=true`. The P1 comment at `:80` says empty arrays must not grant defaults, yet these two clauses do exactly that. Any `admin`/`isAdmin` account whose `/me` returns `permissions: []` gets `*` implicitly (`hasPermission` short-circuit `:67`, plus `adminOnly` resource check bypass at `:94`). Fix must be backend-perms authoritative (deny when empty, except `second_tier` role). No evidence of exploitation — flagged as risk, not incident. 11. `ProtectedRoute.jsx:94-106` + `rbac.js:12-54,61-64` — **coarse resource mapping**. `getResourceFromPath` defaults unknown segments to `"content"` (`rbac.js:58`); unmapped admin segments (`study-materials`, `subjects`, `subject-relations`, `topics`, `curriculum`, `content-management`, `current-affairs`, `practice-questions`, `live-monitor`, `live-proctoring`, `users` sub-tabs ok) all collapse to `content`, and `:100` accepts `content:read` as sufficient. A role with any `content:read` can view all unmapped sections. Additionally `App.jsx` never passes `requireAnyPermission/requireAllPermissions` to any route — per-section enforcement rests solely on this coarse check. 12. **Admin chain invariance (frontend portion) — compliant.** Chain `normalizeFields→restrictAdminOrigin→validateAdminApiKey→protect→admin→auditMiddleware` is backend-enforced and cannot be verified from this territory (forbidden path respected — no backend files opened). Frontend compliance surface is intact: all inspected managers call `apiClient`/`adminAPI`/`authAPI` (`dataService.js:3-13`, `SubjectHierarchyManager.jsx:19`, `PaymentsManager.jsx:14`, `ModerationManager.jsx:52`, `TwoFactorManager.jsx:17`); `apiClient.js:140-141` injects `X-CSRF-Token`, `:159-201` rotates on CSRF 403 with single retry; `adminAPI.js:4-9` enforces `requireId` (no `undefined`-id requests — cf. backend practice `undefined` incident, not reproducible here). `dataService.js:42-57` throws `DataError` on malformed list payloads instead of caching empty truth. No raw `fetch()` bypass observed in inspected files. 13. `BulkImportModal.jsx:38-60` — client validation is extension (`.csv/.xlsx/.xls/.json`) + 50 MB cap only; no MIME strictness (acknowledged `:55`), no row-level Zod preview. Actual import goes through `adminAPI.bulkUploadQuestions:261-262` (`POST /admin/questions/bulk`), `bulkUploadTests:76-79`, `bulkUploadQuizzes:80-83`, `bulkUploadLiveTests:342-343`, `bulkUploadPYP:351-352`, full-test pipeline `:86-105`. No demo/sample fallback found (grep for `sample|demo|mockData` in `assessments-quizzes` returns only benign `fallback` variable names, e.g. `TestsManager.jsx:389,393`, `QuizzesManager.jsx:448`) — prior QuizzesManager demo-fallback issue reads as fixed.

## 3. Verification (read-only, no commands run per contract)

- Route table fully enumerated from `App.jsx:191-299`: `test-series, tests, questions, sections (+section→sections redirect), quizzes, categories, study-materials (+subjects→study-materials, +subject-relations→?tab=subject-relations redirects), exam-categories, exam-info(+:examId), stages, users, sessions, live-monitor, live-proctoring(+:liveTestId), enrollments, results, banners, faqs, notifications, current-affairs, practice-questions, promotions, coupons, subscription-plans, navigation, tag-configs, analytics, leaderboards, deep-analytics (×2), content-management, system-health, logs (+terminal→logs), backups, activity-log, recycle-bin, settings, payments, moderation, two-factor`, plus `topics→?tab=topics`, `curriculum→?tab=curriculum`, `roles-permissions→users?tab=roles`, `coming-soon→settings` redirects.
- `UsersPermissions.jsx:10-13` tab derivation (`pathname.includes("roles-permissions")` + `?tab=`) is consistent with `App.jsx:221-224,245`; `UsersManager`/`RolePermissionsManager` lazy-composed at `:29-37`. No bypass: wrapper sits under `ProtectedRoute adminOnly` (`App.jsx:183-190`).
- `PaymentsManager` (493L), `ModerationManager` (1776L, recharts + `adminAPI.getModerationDoubts/Stats/updateDoubtStatus/deleteDoubt` at `adminAPI.js:268-281`), `TwoFactorManager` (619L, personal `authAPI.twoFactorStatus` + admin `getUsersTwoFactorOverview/adminDisableUserTwoFactor` at `adminAPI.js:244-248`), `LiveTestMonitor` (443L, `useWebSocket(true)` + `@trstprep/shared-config` `timeAgo/exportToCSV` at `:16-18`) all routed and wired to real endpoints — not stubs.
- Backend chain, migrations, and RBAC server behavior **not verified** (out of territory by contract); all guard-chain claims above are frontend-observable only.

## 4. Blockers

- None. Read-only dispatch complete with no writes, no backend/frontend/packages/scripts access, no git operations performed.
- Suggested follow-ups for the owning agent (not executed): (a) route or delete `SubjectHierarchyManager`; add a `topics` tab to `StudyMaterialsManager` or point `/admin/topics` at `CurriculumBuilder`'s topics view; (b) remove or gate `ProtectedRoute.jsx:88-89` fail-open clauses; (c) map missing segments in `rbac.js:SEGMENT_TO_RESOURCE` (study-materials family, live-monitor/proctoring, current-affairs, practice-questions); (d) fix `validationSchemas.js:82-97` refine (attach to a real `subjectRelationSchema` with both fields) and add missing domain schemas; (e) reconcile `features/admin/index.js` exports with `App.jsx` routes; (f) implement question-wise analytics in `ResultsManager` or downgrade the button until the endpoint exists.

## 1. Files Inspected

All absolute paths under `E:\Tech\Testprep\Trstprep V2.1\apps\backend\src\`:

**OpenRouter gateway / shared client:**

- `modules/ai/aiClient.js` (150 lines) — `AI_CONFIG`, `FALLBACK_CONFIG`, `callAI`, `callAIStream`, `callAIWithFallback`, `generateEmbedding`, `isContentToxic`
- `modules/ai/aiCache.js` (44 lines) — `AICache` Redis wrapper
- `modules/ai/aiMentor.service.js` (453 lines) — `callAI` wrapper + cache + `checkTokenBudget`, `sanitizeForPrompt`, study-plan/doubt/strategy/daily-tip/chat/socratic-hint
- `modules/ai/aiMentor.routes.js` (337 lines) — 9 endpoints, dual rate-limit + token-budget layers, IDOR guards, SSE stream
- `modules/ai/aiExplanation.service.js` (295 lines) — single/bulk/improve/Hindi, `buildExplanationPrompt`, cost logging
- `modules/ai/aiExplanation.routes.js` — verified via grep (6 endpoints, `aiRateLimiter` on all)
- `modules/ai/aiGenerationLog.service.js` (86 lines)
- `data/models/ai/AiGenerationLog.js` (176 lines) — `MODEL_PRICING`, `calculateCost`, `create/logSuccess/logFailure`
- `api/routes/admin-catalog.js:530-688` — `POST /ai/generate-questions` live call + structured template-generator fallback + real DB insert

**RAG / embeddings / PDF:**

- `modules/ai/rag.service.js` (89 lines) — `chunkText`, `addDocument`, `retrieveContext` (FTS only)
- `modules/ai/embeddingService.js` (540 lines) — `generateEmbedding`, batch, `indexContent/indexBatch/indexAllUnindexed`, `searchSimilar` (pgvector `<=>`), `getStats/checkPgvector`
- `modules/ai/embedding.routes.js` — verified via glob (7 endpoints)
- `modules/ai/pdfProcessor.js` (57 lines) — `%PDF` sniff, `execFile('python', extract_pdf.py)`, tmp-file roundtrip
- `modules/ai/extract_pdf.py` (18 lines) — `pymupdf4llm.to_markdown`
- `modules/search/vectorSearch.service.js` (337 lines) — duplicate embedding stack over `question_search_index`
- `modules/search/questionSearch.service.js` (89 lines) — thin wrapper over model
- `data/models/search/QuestionSearchIndex.js` (390 lines) — FTS + `searchByEmbedding`, `upsertFromQuestion`, `setEmbedding`, `bulkIndexUnindexed`

**Rate limiting / cost:**

- `middleware/aiRateLimiter.js` (72 lines) — hourly fixed-window `ai:rate:{userId}:{hourBucket}`, 50/500 defaults, fail-open
- `middleware/rateLimiterFactory.js` — referenced, not in deep scope
- `__tests__/authRateLimiter.test.js:27-158` — aiRateLimiter tests
- `__tests__/aiMentor.service.test.js:53-55` — AICache mock

**Node Engine V2 / adaptive / revision:**

- `services/core/NodeEngineService.js` (330 lines) — `calculateMastery`, `getTimeDecay`, `getRecommendationScore`, `shouldRevise`, `getRecommendations`, `generateLearningPath`, `getSpacedRepetitions`, `recordAttempt`
- `modules/nodeEngine/nodeEngine.routes.js` (84 lines) — 4 endpoints, `protect` only
- `modules/ai/adaptiveDifficulty.js` (241 lines) — EMA stub + `getDifficulty/updatePerformance/getDifficulties/resetDifficulty`, `localCache` + `global.redis`
- `modules/ai/adaptiveDifficulty.routes.js` (113 lines) — 4 endpoints, all `protect+aiRateLimiter`
- `modules/adaptive/adaptiveTest.service.js` (363 lines) — session in `attempts.metadata`, `getNextQuestion/submitAnswer/completeSession/getHistory`
- `modules/ai/mathService.js` (51 lines) + `modules/ai/math.routes.js` (KaTeX, `protect+aiRateLimiter` on all 3)
- `modules/revision/smartRevision.service.js` (476 lines) — LLM `generateRevisionPlan` + local queue logic
- `services/ai/learningProfiles.js` (166 lines), `services/ai/recommendations.js` (glob-confirmed)
- `infrastructure/repository/base.repository.js:89` — `practice_ai_cache` allow-listed collection only; no read/write call sites found in territory

## 2. Issues

### A. OpenRouter gateway — missing key / reliability

1. **No absent-key guard; `Bearer undefined` sent live** — `modules/ai/aiClient.js:11-12,54-59`: `apiKey = AI_API_KEY || OPENROUTER_API_KEY` may be `undefined`, but `callAI` still `fetch`s. No `if (!config.apiKey) throw`. Same in `generateEmbedding` (`aiClient.js:128-140`), `embeddingService.js:18-19,36-46`, `vectorSearch.service.js:19-20,30-40`. Only `admin-catalog.js:552` checks keys before calling; mentor/explanation/embedding paths will burn latency then throw generic `AI API error: 401/403`.
2. **Error body discarded; no retry/timeout** — `aiClient.js:69-71` throws `AI API error: {status}` without response text; no `AbortSignal.timeout`, no retry. Single transient 429/5xx fails straight to fallback or 500. `embeddingService.js:48-50` does capture text but caller `indexContent:270` has no retry; `vectorSearch.service.js:98-103` swallows embedding failure to `return entry` without embedding (silent partial index).
3. **Fallback config can equal primary / be empty** — `aiClient.js:19-24,114-118`: `FALLBACK_BASE_URL` defaults to OpenAI but `FALLBACK_API_KEY` often unset → fallback `Bearer undefined` guaranteed to fail; when both point at OpenRouter, "fallback" is a retry of the same provider. Final error `AI service unavailable` (`aiClient.js:123`) erases both status codes — ops cannot distinguish key-missing vs quota vs outage.
4. **Unsafe `data.choices[0]` access + unvalidated usage** — `aiClient.js:77-91`: `data.choices[0]?.message?.content || ''` returns empty string as success; `data.usage` may be absent (many OpenRouter models omit it) → `tokensInput/Output = 0` logged, cost = 0, budget never consumed. `generateEmbedding` (`aiClient.js:147`, `embeddingService.js:57-58`, `vectorSearch.service.js:50-51`) does `data.data[0].embedding` / `data.usage.total_tokens` with no null check → `TypeError: Cannot read properties of undefined` on provider error-shape responses.
5. **Streaming path bypasses output moderation, cache, budget, logging** — `aiClient.js:73-75,95-103`: `stream:true` returns raw `Response` with no toxicity check; `aiMentor.routes.js:178-274` (`/chat/stream`) builds its own `buildMessages` + `callAIStream` directly, never touches `aiMentor.service:callAI` cache/budget, never calls `AiGenerationLog`, never validates SSE `parsed.choices[0]?.delta` shape beyond optional chaining. Streamed abuse is invisible to cost tracking.
6. **Template-generator fallback inserts fake questions as real rows** — `api/routes/admin-catalog.js:625-680`: when keys absent or LLM throws/returns unparsable JSON (`JSON.parse(cleaned)` at `:584` unguarded except outer try), synthesizes `Which of the following best characterizes ${top}...` with `correctAnswer = sampleOptions[0]` and `insertOne("questions")`, returns `201`. No `generated_by: template_fallback` marker, no `is_active=false`/review flag. Downstream explanation/search treat synthetic rows as genuine bank content. `failed` only tracks DB-insert failures, not fallback usage.

### B. Prompt injection — partial coverage

7. **Only mentor sanitizes; explanation/revision/admin prompts are raw** — `aiMentor.service.js:58-65` `sanitizeForPrompt` strips `system:` + `ignore previous instructions` and truncates to 2000 chars, applied to `answerDoubt`, `chat`, `socratic-hint`. But `aiExplanation.service.js:20-33,190-199,251-268` interpolates `question_text/options/instructions` verbatim; `smartRevision.service.js:54-79` interpolates weak-topic names; `admin-catalog.js:554-563` interpolates `subject/topic` verbatim into question-generator prompt. Stored XSS-style prompt payload in a question or topic name executes in LLM context.
8. **Toxicity regex is trivially bypassable + overblocks** — `aiClient.js:32-41`: 4 patterns (`fuck|bitch|asshole|idiot|stupid`, `system prompt`, `ignore previous instructions`, `reveal system instructions`). Misses jailbreaks (`DAN`, `developer mode`, base64/roleplay, Hindi/Hinglish equivalents), yet blocks legitimate pedagogy containing "system prompt" (e.g., CS questions). Output check (`aiClient.js:82-84`) runs only on non-stream path, so streamed toxic output is never scanned.
9. **`answerDoubt` RAG context unsanitized** — `aiMentor.service.js:177-202`: `ragService.retrieveContext(question)` output (arbitrary document-chunk text from `document_chunks`) is pasted into the user prompt without sanitization or delimiters. A poisoned uploaded PDF becomes indirect prompt injection on every doubt call.
10. **History replay unsanitized in non-stream chat** — `aiMentor.service.js:358-365`: `history.map(h => {role, content})` replays stored `ai_messages.content` verbatim as `user/assistant` roles; only the new `message` is sanitized. Stored injection persists across turns. Route-level `buildMessages` (`aiMentor.routes.js:57-70`) truncates but does not sanitize either.

### C. Rate-limit bypass / double-counting

11. **Two independent limiters with different windows stack** — `middleware/aiRateLimiter.js:36-43` (hourly `ai:rate:{userId}:{hourBucket}`, 50 free / 500 pro) AND `aiMentor.routes.js:11-23` `aiRateLimit` (per-minute `ai:ratelimit:{userId}:{minute}`, `AI_RATE_LIMIT_MAX` default 10). Every mentor `POST /study-plan|/doubt|/exam-strategy|/chat|/chat/stream|/socratic-hint` passes through both. Minute limiter has no `Retry-After`, no `res.locals`, inconsistent JSON shape (`{error}` vs `{message,code,limit}`).
12. **`GET /daily-tip` + all `GET /conversations*` bypass hourly limiter** — `aiMentor.routes.js:130` (`daily-tip`), `:276,289` (conversations) omit `aiRateLimiter` middleware entirely (only minute `aiRateLimit` + budget). `daily-tip` still calls the LLM (`aiMentor.service.js:309-312`). An attacker polling `daily-tip` consumes tokens at 10/min without touching the 50/hr budget.
13. **Node Engine + search + RAG-adjacent LLM paths have no AI limiter** — `nodeEngine.routes.js:9,25,41,57` (no `aiRateLimiter` import at all), `search/questionSearch.routes.js` + `vectorSearch.routes.js` (no limiter import found), `embedding.routes.js` (glob-confirmed, no limiter reference in grep hits). `record-attempt` is DB-only today but recommendation/path endpoints drive future LLM scoring without quota.
14. **Fail-open on Redis outage = unlimited AI spend** — `aiRateLimiter.js:22-26,66-69`: `!redis → next()`, Redis error → `next()`. Correct availability choice but no circuit-breaker, no in-memory fallback counter, no alerting hook (only `logger.warn/error`). During a Redis outage all 50/500 caps disappear simultaneously.
15. **`NODE_ENV=test` unconditional skip** — `aiRateLimiter.js:20`: any process with `NODE_ENV=test` (staging, preview, misconfigured prod) disables all hourly limiting.
16. **Pro-status trust + hour-bucket edge** — `aiRateLimiter.js:28-34`: `req.user.isProUser === true` trusted from JWT/session without re-checking `subscriptions`; fixed hour bucket (`Math.floor(Date.now()/3600000)`) allows 2×limit burst across boundary (50 at 13:59 + 50 at 14:00). Not sliding-window despite docstring claim (`aiRateLimiter.js:4`).
17. **Token budget is triple-tracked and inconsistent** — in-memory `userTokenUsage` in `aiMentor.service.js:40-55` (per-process `Map`, lost on restart/scale, keyed `anonymous` when `userId` missing) vs Redis+memory `checkTokenBudget` in `aiMentor.routes.js:28-55` (36h TTL, only counts `tokensRequested` estimate, not actual usage) vs service-level `checkTokenBudget` (`aiMentor.service.js:76-79`, counts `maxTokens` request not actual tokens). Route budget checked with `0` tokens on most endpoints (`aiMentor.routes.js:77,95,115,135,151` call `checkTokenBudget(id)` with default 0 → Redis `incrby 0` always passes) except `socratic-hint:316` (800). Actual `tokensInput+Output` never debited anywhere.

### D. Cache — `practice_ai_cache` unused, `AICache` gaps

18. **`practice_ai_cache` table has zero read/write call sites** — grep for `practice_ai_cache|AICache|aiCache` hits only `base.repository.js:89` (allow-list), `aiCache.js`, `aiMentor.service.js:37,72,84`, and tests. Contract requirement "respect practice_ai_cache patterns" cannot be satisfied — the DB cache the Practice↔Test bridge was supposed to use is orphaned. All reuse goes through volatile Redis `AICache`.
19. **`AICache` keyed on full message array — near-zero hit rate for chat** — `aiCache.js:17-20`: `sha256({messages, model})`. Conversation history grows each turn so keys never repeat; `socratic-hint`/`study-plan` include timestamps/counts. Only exact-repeat `doubt` with identical RAG context hits.
20. **`new AICache(global.redis)` frozen at import time** — `aiMentor.service.js:37`: `global.redis` is typically undefined during module init (Redis connects async at boot), so `this.redis = undefined` permanently → `get/set` no-op (`aiCache.js:23,34`). Cache silently disabled for process lifetime even after Redis becomes healthy. Same pattern in `adaptiveDifficulty.js:83-92,126-130` (`if (global.redis)` read at call time there — inconsistent).
21. **No invalidation, no model/prompt versioning, 24h TTL unconditional** — `aiCache.js:11,33-41`: `ttl = 86400`, `setex`, no `del`/flush API, key includes model string but not prompt-template version (`prompt_templates` table is DB-editable per `aiMentor.service.js:18-34` — editing a template serves stale cached answers for 24h). Toxic/cached-wrong answers persist; `catch {}` swallows Redis errors silently.
22. **Only mentor uses cache; explanation/embedding/revision never cache** — `aiExplanation.service.js` (bulk up to 50 questions, concurrency 3 at `:121-152`) calls `callAIWithFallback` directly with no cache lookup; repeat bulk regenerations re-bill. `smartRevision.service.js:18-39`, `embeddingService.js:260-313` similarly uncached.

### E. RAG retrieval gaps

23. **Keyword-only FTS, no vector hybrid despite pgvector existing** — `rag.service.js:60-88` uses `plainto_tsquery('english') + ts_rank_cd` over `document_chunks.tsv_content`. No embedding column read, no `<=>` similarity, no hybrid rank fusion. Hindi/Hinglish queries stemmed with `'english'` config → near-zero recall for Hindi doubts; `answerDoubt` RAG silently returns `''` (`rag.service.js:75-77`) and LLM answers without course context while logging `hasRAGContext:false` only in metadata.
24. **No chunk-size guard on ingest; giant PDFs blow up rows/memory** — `rag.service.js:10-21,26-55`: `chunkText(text)` defaults 1000/200 overlap with no max-chunks cap; `pdfProcessor.js:37` allows 50MB stdout, then `addDocument` loops `INSERT` per chunk in one transaction (`rag.service.js:37-43`) — a 50MB extraction = ~50k inserts in a single `BEGIN/COMMIT`, long lock on `document_chunks`, possible statement-timeout/OOM. No `document_name` length/ownership check; `DELETE + re-INSERT` (`rag.service.js:35`) is not idempotent under concurrency (two uploads of same name interleave).
25. **`retrieveContext` swallows all DB errors to empty string** — `rag.service.js:83-84`: missing `document_chunks` table, missing GIN index, or `tsv_content` trigger failure all return `''` with only `console.error`. No `logFailure`, no metric. FTS index gap is undetectable from API responses.
26. **PDF path is command-injection-safe but fragile** — `pdfProcessor.js:24-41`: `execFile('python', ...)` (no shell) is safe, but binary is hardcoded `'python'` (fails on python3-only hosts), no timeout (`maxBuffer` only), no file-size cap before `fs.writeFile` (attacker-sized buffer → disk fill in `os.tmpdir`), temp file uses `randomUUID` without prefix (hard to audit/GC on crash — `unlink` in `finally` only covers extractor success path start; `writeFile` failure leaks nothing but `execFile` hang leaves file). `extract_pdf.py:2` imports `pymupdf4llm` with no fallback — missing dep → `sys.exit(1)` → generic `No readable text` upstream. No scanned-image/OCR path: image-only PDFs throw `No readable text found in document` (`pdfProcessor.js:47-49`) with no guidance.

### F. Embedding dimension mismatch / index gaps

27. **Three embedding configs disagree on provider + dimension** — `embeddingService.js:14-21` (`OPENAI_API_KEY`, `https://api.openai.com/v1`, `text-embedding-3-small`, dim 1536) vs `vectorSearch.service.js:15-21` (`OPENROUTER_API_KEY`, `https://openrouter.ai/api/v1`, same model name) vs `aiClient.generateEmbedding:128-140` (OpenRouter base, `text-embedding-3-small`). If `EMBEDDING_MODEL` is switched (e.g., `text-embedding-3-large` 3072-dim or multilingual 768-dim) the code still writes whatever vector returns: `JSON.stringify(embedding)` into `embeddings` (`embeddingService.js:286`) / `question_search_index.embedding` (`QuestionSearchIndex.setEmbedding:189-198`). pgvector `vector(1536)` column then rejects with `expected 1536 dimensions, got N` — surfaced as generic indexing failure. No dimension assertion before INSERT, no `array_length` check.
28. **No `vector` cast validation / index-existence check on write path** — `embeddingService.searchSimilar:410-433`, `vectorSearch.semanticSearch:220-260`, `QuestionSearchIndex.searchByEmbedding:84-93` all do `$1::vector` with `JSON.stringify(embedding)`; empty array (`aiClient.js:147` returns `[]` on missing `data.data[0]`) produces `[]::vector` error at query time. `checkPgvector()` (`embeddingService.js:494-506`, `vectorSearch.service.js:319-334`) exists but is never called by index/search flows — a DB without the extension fails deep in the query, not at startup.
29. **Silent partial-batch indexing hides backlog** — `embeddingService.indexBatch:318-343` (sequential, no concurrency limit, no progress), `vectorSearch.indexBatch:110-136` (same), `vectorSearch.indexQuestion:66-105` returns `entry` without embedding on LLM failure (`:98-104`) — row stays `is_indexed=false` forever with no retry queue, no dead-letter, no `AiGenerationLog.logFailure` (only success logged). `indexAllUnindexed` caps at 100 (`embeddingService.js:348`, `vectorSearch:141`) with no pagination cursor — cron re-indexes the same first 100 while tail never drains. `getUnindexedCount` (`questionSearch.service.js:49-63`) counts `NOT EXISTS` but nothing alerts on growth.
30. **Question text builders assume JSONB object-shape options** — `embeddingService.buildQuestionSearchText:129-132`, `QuestionSearchIndex.buildSearchText:212-215` do `q.options->>'0'...'3'`; array-shape options (`["A","B","C","D"]`) yield empty `options_text` → degraded embeddings with no warning. `LEFT JOIN subject_topics/subjects` silently drops topic/subject names when taxonomy IDs dangle.

### G. Cost tracking (`ai_generation_logs`) gaps — blowup risk

31. **Stale pricing table underbills everything modern** — `AiGenerationLog.js:3-8`: only `gpt-4`, `gpt-3.5-turbo`, `claude-3`, `default ($0.002/1k)`. `gpt-4o-mini` (used by `socratic-hint:430`), `gpt-4o`, Claude 3.5/Sonnet, Llama/Gemini via OpenRouter all fall to `default` or substring-match `gpt-4` at 2023 rates. `calculateCost:10-14` uses `includes` matching — `gpt-4o-mini` matches `gpt-4` ($0.03/$0.06) while actual OpenRouter cost is ~100× lower; reported spend is fiction. No per-provider pricing, no embedding-model pricing (embeddings logged at `default` chat rates).
32. **Zero-token logs poison averages; failures unlogged on most paths** — when `usage` absent, `logSuccess` stores `tokens 0, cost 0` (`AiGenerationLog.create:126-128`); `getStatsByModel:57-80` `AVG(latency)`, `SUM(cost)` silently diluted. Only `vectorSearch.semanticSearch:290-298` calls `logFailure`; mentor/explanation/revision/embedding never log failures → `findFailed`/`getFailed` undercounts, cost dashboards show success-only spend.
33. **`getUsageByPeriod` queries wrong column names** — `aiGenerationLog.service.js:44-58` selects `tokensInput/tokensOutput/costUsd` (camelCase) but `findRecent:48` shows physical columns are `tokens_input/tokens_output/cost_usd` → that endpoint always 500s. `deleteOlderThan` (`AiGenerationLog.js:157-169`) has no service-route wiring verification in scope (cleanup never scheduled → unbounded table growth + `getCostSummary` full-scan slowdown; no index assertion on `created_at`).
34. **Bulk explanation = 50-question cost bomb with no pre-estimate** — `aiExplanation.generateBulk:121-153` caps at 50 ids × ~1500 maxTokens (`:74`) ≈ 75k output tokens per call, concurrency 3, no cost confirmation, no per-request cap header, no `res.locals.aiRateLimit` propagation. Combined with bypassable hourly limiter, one user can queue repeated bulk jobs.

### H. Node Engine V2 + adaptive correctness

35. **Recommendation scan capped at 100 nodes, ignores graph structure** — `NodeEngineService.getRecommendations:87-94`: `LIMIT 100 ORDER BY id ASC`, no `parent_id` traversal, no exam/subject filter, no `next_review_date` ordering. `generateLearningPath:141-147` ignores `parent_id` when `rootNodeId` null (flat sort by `score`). `getSpacedRepetitions:181-205` full-table per-user scan + JS-side `shouldRevise` filter — O(skills) per request, no pagination.
36. **`recordAttempt` silently drops topic-id callers** — `NodeEngineService.recordAttempt:213-241`: non-numeric or non-`nodes.id` values return `{success:false, skipped:true}` with HTTP 200 (`nodeEngine.routes.js:75-78`). Practice/test flows passing `topic_id`/`question_id` never update mastery and never learn why — the "quiet instead of error-spamming" design hides integration bugs. `parseInt(nodeId,10)` at route `:70` turns `"12abc"` into `12` (wrong-node write) before service validation.
37. **Mastery/scoring math issues** — `calculateMastery:10-18`: `speedFactor = min(1.2, 60/t)` then `accuracy * min(1.0, speedFactor)` — the 1.2 cap is dead code (clamped to 1.0 immediately after); fast answers gain nothing, slow answers penalized linearly. `getRecommendationScore:59`: `(1-mastery)*0.5 + difficulty*0.3 + freshness*0.2` pushes hardest + stalest nodes regardless of prerequisites. `shouldRevise:82`: `1/(1.1-mastery)` → mastery 1.0 = 10d max interval (too aggressive for exam prep); `next_review_date` future check (`:70-74`, `:33-41`) means scheduler-flagged items never surface early even when mastery collapses.
38. **Adaptive difficulty: EMA documented but not implemented; reset is no-op** — `adaptiveDifficulty.js:18,95-133`: `EMA_ALPHA` declared, never used; `score = accuracy` (raw lifetime accuracy). `resetDifficulty:231-238` deletes caches then recomputes from the same `user_topic_stats` row — score unchanged, not neutral. `updatePerformance:144-219` holds `BEGIN` across read+write with no `SELECT ... FOR UPDATE` (lost-update under concurrent submits); `getDifficulties:224-226` N+1 `Promise.all` per topic; `levelToScore`/`getAvgTimeForTopic`/`MIN_ATTEMPTS_FOR_CONFIDENCE` dead code. `adaptiveTest.service.js:75,166` selects `attempts` columns without `metadata` (the session blob!) — `session.metadata` is always `undefined` → `questionHistory=[]`, difficulty never progresses, `correct/wrong` column writes (`:238-253`) target columns that may not exist.
39. **Math routes rate-limit a CPU-local op as AI** — `math.routes.js:9,21,33` applies hourly `aiRateLimiter` to KaTeX rendering (no LLM, no cost). Legit heavy-math users burn AI quota; `mathService.renderMath:16-31` regex `\$([^$]+)\$` mangles currency/code (`$5 and $10`), no output sanitization (KaTeX `html` output returned raw — stored-XSS vector if rendered unescaped downstream).

## 3. Verification

- **Grep-verified**: `aiRateLimiter` wired only in `admin-catalog.js`, `adaptiveDifficulty.routes.js`, `aiMentor.routes.js`, `aiExplanation.routes.js`, `math.routes.js` — absent in `nodeEngine.routes.js`, `questionSearch*`, `vectorSearch*`, `embedding.routes.js` (no hits). `practice_ai_cache` has no read/write hits outside `base.repository.js:89` allow-list. `AICache` instantiated once (`aiMentor.service.js:37`).
- **Read-verified**: all line citations above from direct file reads (aiClient, rag, embeddingService, aiCache, aiRateLimiter, pdfProcessor, extract_pdf, explanation, mentor + routes, generationLog service + model, adaptiveDifficulty + routes, mathService, NodeEngineService + routes, adaptiveTest.service, smartRevision.service, QuestionSearchIndex, learningProfiles, admin-catalog segment).
- **Not run** (READ_ONLY contract): no `node`, `npm test`, migration, or DB-connectivity commands executed. Dimension-mismatch (`vector(1536)` DDL), GIN-index presence on `document_chunks.tsv_content`, `question_search_index` ivfflat index, and live `ai_generation_logs` column casing (`tokens_input` vs `tokensInput` in `getUsageByPeriod`) should be confirmed against the live DB via `scripts/run-database-audit.js` before any migration.
- **Cross-check**: `__tests__/authRateLimiter.test.js` covers the hourly limiter; `aiMentor.service.test.js` mocks both `aiCache` and `AiGenerationLog` — tests will not catch the `global.redis`-at-import, zero-token, or pricing bugs.

## 4. Blockers

- None for read-only research. No writes performed; forbidden paths (`apps/frontend`, `apps/admin-panel`, `packages`, `migrations`, `scripts`, git) untouched.
- Recommended live-DB confirmations (for the owning agent, not done here): (1) `embeddings.embedding` and `question_search_index.embedding` column types/dims vs `EMBEDDING_DIMENSION`; (2) pgvector extension + ivfflat/HNSW indexes present; (3) `document_chunks(tsv_content)` trigger/index; (4) `ai_generation_logs` actual column names; (5) `attempts.metadata/correct/wrong` columns (adaptiveTest session viability); (6) `AI_API_KEY/OPENROUTER_API_KEY/EMBEDDING_MODEL` set in the target environment.

## 1. Files Inspected

**Guardrails:**

- `E:\Tech\Testprep\Trstprep V2.1\.gitignore:22-29,187-190` — `.env` / `*.env` / `*.key` / `*.pem` blocks
- `E:\Tech\Testprep\Trstprep V2.1\.github\workflows\no-env.yml:1-66` — tracked `.env` + hardcoded-secret scan
- `E:\Tech\Testprep\Trstprep V2.1\.github\workflows\data-guard.yml:1-150` — PII keys, secret values, `M3 Key.txt`, migration gaps
- `E:\Tech\Testprep\Trstprep V2.1\.husky\pre-commit:1-15` — staged `.env` block only
- `E:\Tech\Testprep\Trstprep V2.1\.husky:post-commit,graphify-sync.sh,_/` (directory listing only)

**Policy / history docs (values redacted, locations only):**

- `docs/SECURITY_POSTURE.md:114-116` — scrub + PII history marked user-handled
- `docs/REMEDIATION_PLAN.md:160-165,1483,1537,1606-1610` — Phase 0 + Phase 2.1 scrub deferred
- `docs/SECURITY_CREDENTIAL_ROTATION_AND_DPDP_RUNBOOK.md:1-210` — full rotation + `filter-repo` + DPDP plan
- `docs/ISSUE_SWEEP_2026-09-15.md:39,54-109,346,421,501-509` — `.env` in 2 commits, data-guard RED, logger bypass note
- `docs/audit/2026_09_11_FULL_REPO_RE_AUDIT.md:18,102` — PII encryption active, scrub/rotation tracked
- `docs/FINAL_SITE_READINESS_REPORT.md:152,215` — `test_attempts` 528 vs `attempts` 22
- `docs/walkthroughs/walkthrough-2026-09.md:621,711` — no active `M3 Key.txt`, DPDP notices in `Privacy.jsx`
- `docs/UNIFIED_TRSTPREP_AUDIT.md:7866,8879` — rotate-then-scrub order

**Crypto / data:**

- `apps/backend/src/infrastructure/database/migrations/088_encrypt_pii_at_rest.sql:1-188`
- `apps/backend/src/infrastructure/database/migrations/104_fix_pgcrypto_key_resilience.sql:1-74`
- `apps/backend/src/infrastructure/database/migrations/039_comprehensive_schema_consolidation.sql:799-819` + `048_rls_policies_and_final_reconciliations.sql:451-471` + `056a_fix_security_definer_views...:47-52` — `test_attempts` TABLE→VIEW
- `apps/backend/src/infrastructure/database/migrations/136_audit_remediation_followup.sql:17,194-207` — `audit_logs` canonical, no `audit_trail`
- `apps/backend/src/infrastructure/database/seeders/_fixtures/*.json` (6 files: `app_settings,exam_rooms,live_tests,questions,subjects,tests.json`) — PII-key grep, no hits

**Logging / sanitization / PII flows:**

- `apps/backend/src/infrastructure/logger/logger.js:22-43` — pino `redact[]`
- `apps/backend/src/infrastructure/logger/logBuffer.js:13-61,76-86` — regex + key redaction
- `apps/backend/src/utils/sanitizeError.js:1-29` — `sanitizeErrorMessage` / `createSafeError`
- `apps/backend/src/api/routes/phoneAuth.js:171-219,365,436` — OTP verify, error logs (no OTP value logged)
- `apps/backend/src/api/routes/admin-moderation.js:127,136-143` — `user_email` select + sanitize
- `apps/backend/src/api/routes/admin-audit.js:117,269` + `admin-enrollments.js:199,267,283` + `admin-payments.js:134,147` + `enrollments-admin.js:84,108,392` + `leaderboards-admin.js:104` + `practice.js:2230,2315` + `doubts.js:45,51,161,255` — residual `user_email` returns
- `apps/backend/src/middleware/audit.middleware.js:120-148` + `infrastructure/database/auditTrailManager.js:146,160,219,244,261` + `infrastructure/repository/base.repository.js:41` + `infrastructure/database/postgres-helpers.js:322` — `audit_logs` usage
- `apps/backend/src/__tests__/settingsService.test.js:91-125` — placeholder secret-like strings (test only)

## 2. Issues (location only, values redacted — severity + rotation/scrub status)

**CRITICAL — Open history, rotation must precede scrub:**

1. **Committed `.env` history** — `apps/backend/.env` in 2 commits per `ISSUE_SWEEP_2026-09-15.md:39`. Runbook `SECURITY_CREDENTIAL_ROTATION_AND_DPDP_RUNBOOK.md:13-18` confirms historical blobs held live `DATABASE_URL`, `JWT_SECRET`/`JWT_REFRESH_SECRET`, Razorpay ID/Secret, OpenRouter/MiniMax keys. Current tree: `git rm --cached` done, `.gitignore:26` + `no-env.yml:22-28` + `data-guard.yml:54-59` block re-track. **Severity: Critical. Rotation: OPEN (Phase 0). Scrub: OPEN (Phase 2.1 `git filter-repo --invert-paths` + `--replace-text` not yet executed, force-push pending).**
2. **MiniMax `M3 Key.txt`** — Removed from worktree (walkthrough-2026-09.md:621 confirms absent), but `data-guard.yml:54` still guards `(^|/)M3 Key\.txt$` and runbook `B.3:124-129` lists it for `--invert-paths` purge. Assume key compromised until rotation confirmed. **Severity: Critical. Rotation: VERIFY (revoke in provider console). Scrub: OPEN (same `filter-repo` batch as above).**
3. **Legacy `test_attempts` 528 rows / 196 principals** — Runbook `C.1:170-178`: names, emails, phones, attempt histories in early snapshots; live DB converted to VIEW in `039/048/056a` (verified above) but history retains PII. **Severity: Critical (DPDP). Scrub: OPEN. DPDP Notice obligation (Sec 5/6): PARTIAL — `Privacy.jsx` notices added per walkthrough, but direct notice to 196 historical principals + Sec 8(5)/12/14 erasure workflow still OPEN per runbook `C.2`.**

**HIGH — Encryption fail-open / guard gaps:** 4. **PII-at-rest fail-open when key absent** — `088:62-63,85-87,148` + `104:30-32,45-47,59-65`: `encrypt_pii/decrypt_pii` return `NULL` + trigger no-op if `app.pgcrypto_key` missing; plaintext cols (`phone`/`mobile`,`date_of_birth`,`location`,`education`,`bio`) retained for transition, drop deferred to migration 122 (not verified applied). `postgres-helpers.js` requires `DB_ENCRYPTION_KEY` (no `JWT_SECRET` fallback) but runtime write pool never sets GUC (only `migrationRunner` does) — `104` header documents the `42704` logout 500 that forced resilience. If prod `DB_ENCRYPTION_KEY`/`PGCRYPTO_KEY` unset, `*_enc` stay `NULL`, reads fall back to plaintext. **Severity: High. Fix: set key in prod, verify backfill, then drop plaintext. Never log key (088:24,104:16 already warn).** 5. **Key-name confusion** — `088:7-9` documents `DB_ENCRYPTION_KEY ↔ app.pgcrypto_key`, `104` + runbook `A.1:49` say `PGCRYPTO_KEY`. Two names for same secret across code/migrations/docs. **Severity: High (ops risk — key set under wrong name = silent no-encryption).** 6. **Pre-commit PII hook weaker than docs claim** — Actual `.husky/pre-commit:1-15` only blocks staged `*.env*` + `lint-staged`. Runbook `5:204-205` claims “regex scanners for AWS, Supabase, JWT, Razorpay” in pre-commit — not present. PII (`full_name`, `phone_number`, etc.) has no pre-commit gate; relies solely on CI `data-guard`. **Severity: High.** 7. **`validateAdminApiKey` timing-unsafe compare** — `ISSUE_SWEEP:18` cites `origin.middleware.js:333` using `===` for secret compare. **Severity: High (timing side-channel). Fix: `crypto.timingSafeEqual`.**

**MEDIUM — Logger redaction incomplete, PII in admin paths by design:** 8. **Logger allowlist misses PII classes** — `logger.js:22-43` redacts `password,token,secret,apiKey,jwt,sessionId,cookie,csrfToken` + headers, `logBuffer.js:13-22,45-52` adds `bearer,jwt,authorization`. Neither redacts `phone,mobile,otp,email,full_name,avatar_url,aadhaar,pan,razorpay,pgcrypto,DB_ENCRYPTION_KEY`. `logBuffer` partially masks captured values (`p1.slice(0,2)…`) rather than full `[REDACTED]`. `ISSUE_SWEEP:421` notes ~300 `console.*` bypass logger entirely (captured into buffer via `hookConsole` but with weaker patterns). `phoneAuth.js:365,436` logs generic `Error verifying OTP / linking phone` — no OTP/phone value today (prior `[DEV OTP]` removed per `REMEDIATION 2.4`), but `error` object could carry phone if upstream attaches it. **Severity: Medium. Fix: extend redact lists + add `phone|email|otp|aadhaar|pan|full_name` patterns, replace `console.*` with `logger` in prod paths.** 9. **Residual `user_email` exposure (admin-scoped)** — `admin-audit.js`, `admin-enrollments.js`, `enrollments-admin.js`, `admin-payments.js`, `leaderboards-admin.js`, `practice.js:2230,2315` return `u.email AS user_email` to authenticated admins. `admin-moderation.js:139-142` now correctly deletes `userEmail` + `user_email` + `email` (prior `REMEDIATION 3.20` snake_case leak FIXED — verified). Remaining exposures are behind `protect+admin+RBAC+auditMiddleware` + `restrictAdminOrigin+validateAdminApiKey`, so accepted if audit retention holds; `audit.middleware` GET-detail coverage fixed per `REMEDIATION 3.23`. **Severity: Medium (ensure `secondTier` on bulk export/purge per `REMEDIATION 3.21`, no CSV export without audit).** 10. **`.gitignore` over-broad + under-specific** — `*.cjs:120`, `*.txt:168` (with only 3 `!` exceptions), `/*.test.js` anchoring noted in header. `ISSUE_SWEEP:10` reports 5 test files + 23 `scripts/` tools silently ignored at time of sweep; current header `70-83` claims anchored fix but `*.cjs` still globally ignores local scripts. `supabase_data/` (PII: `full_name,avatar_url` per `data-guard:20-24`) has no explicit `.gitignore` entry — relies on `data/` + CI fail-if-present. **Severity: Medium.** 11. **JWT `algorithms` allowlist missing (10 sites)** — `ISSUE_SWEEP:19` reports 10× `jwt.verify()` without `algorithms`. Enables algorithm-confusion if attacker holds alternate key. **Severity: Medium.**

**LOW / Informational — verified clean:** 12. **No live hardcoded secrets in tree** — Repo-wide grep for `BEGIN PRIVATE KEY|AKIA…|rzp_live_|sk-live-|sk-or-v1-` returns only `no-env.yml:40` + `data-guard.yml:62` (guard patterns), `settingsService.test.js:91-125` fake placeholders (`rzp_live_key_id` — explicitly excluded by guards), runbook prose `141-143` (excluded). **Severity: Low (hygiene holds at tracking layer). Weak-JWT scan (`JWT_SECRET\s*=\s*[A-Za-z0-9…]{32,}`) similarly clean in tree — history still dirty.** 13. **Seeder fixtures clean** — 6 `_fixtures/*.json` grep for `full_name|avatar_url|password_hash|phone_number|aadhaar|pan_card`: zero hits. **Severity: None.** 14. **`audit_logs` vs `audit_trail` naming** — Canonical is `audit_logs` everywhere (`audit.middleware.js:148`, `base.repository.js:41`, `postgres-helpers.js:322`, all `admin-*.js`). Zero `audit_trail` table references; only `136:17,194-207` explicitly forbidding creation. **Severity: None (naming consistent).** 15. **Error-message PII** — `sanitizeError.js:1-17` fail-closed in prod (allowlisted 4xx messages, generic 5xx), `createSafeError:19-27` separates `userMessage`/`internalMessage`. Broad adoption verified (100+ call sites). Residual: dev returns raw `error.message`; any handler that bypasses `sanitizeErrorMessage` or interpolates `req.user.email/phone` into 4xx message would leak — no live case found in sampled routes. **Severity: Low.**

## 3. Verification

- **Confirmed by direct read:** `.gitignore`, both workflows, `SECURITY_POSTURE`, `REMEDIATION_PLAN` (partial — capped at 50KB, lines 1-716 + cited offsets), rotation runbook, `088`/`104` full text, `logger.js`/`logBuffer.js` full text, `sanitizeError.js`, `phoneAuth` OTP block, `admin-moderation` sanitize block, `.husky/pre-commit`, `ISSUE_SWEEP` excerpts, `test_attempts` VIEW chain (`018,039,048,056a`), `audit_logs` canonical chain, seeder-fixture PII grep (clean), secret-pattern grep (only guards/tests/docs).
- **Effectiveness sampling:** `data-guard.yml` current text shows prior RED causes fixed — duplicate-prefix check now allows `NNNa_` splits (`70-97`), PII check excludes `scripts/*schema_dictionary*.json` + `collections/` (`41-43`), fixture parse uses `fs.readFileSync` not bare `require` (`146-150`). `no-env.yml` correctly excludes `*.md|*.json|*.sql|docs` from secret scan (`37-52`). Whether CI is currently green not verified (no workflow-run access in read-only scope).
- **Not verified (read-only boundary):** No `git log --all -- .env` / `M3 Key.txt` execution, no secret-value inspection, no live DB (`SELECT` on `users.*_enc`, `test_attempts` view), no prod env (`DATABASE_URL`, `JWT_*`, `PGCRYPTO_KEY`, `RAZORPAY_*`, `OPENROUTER_*`) confirmation, no `supabase_data/` presence check beyond CI text. Rotation/scrub status taken from docs (`REMEDIATION 2.1`, `ISSUE_SWEEP:17,39`, runbook) — treat as OPEN until ops attests.

## 4. Blockers

- **Halt-and-report observed:** No secret values printed, echoed, or executed; locations reported only per Zero-Exposure protocol.
- **No writes performed:** No `git rm/filter-repo`, no rotation, no migration, no log modification.
- **Blocking gaps to close out-of-band:** (a) Rotate `DATABASE_URL`, `JWT_SECRET/REFRESH/RESET/2FA`, `PGCRYPTO_KEY`/`DB_ENCRYPTION_KEY`, Razorpay, Supabase service-role, OpenRouter (runbook Phase A) BEFORE `filter-repo`; (b) Run `git filter-repo --invert-paths` (`apps/backend/.env`, `*.env*`, `M3 Key.txt`) + `--replace-text` (`postgres://…`, `rzp_live_*`, `sk-or-v1-*`) then `gc --prune=now` + force-push (Phase B); (c) Execute DPDP notice/erasure plan for 196 principals + confirm `test_attempts` history purged (Phase C); (d) Set prod encryption key under single canonical name and verify `*_enc` backfill before dropping plaintext cols.

## 1. Files Inspected

**Queue / events / worker (READ_ONLY):**

- `apps/backend/src/infrastructure/queue/queueManager.js` (270L)
- `apps/backend/src/infrastructure/queue/outboxPoller.js` (146L)
- `apps/backend/src/infrastructure/events/eventBus.js` (167L)
- `apps/backend/src/infrastructure/events/messageBroker.js` (215L)
- `apps/backend/src/worker/index.js` (74L)
- `apps/backend/src/worker/jobHandlers.js` (86L)
- `apps/backend/src/services/core/testScheduler.js` (91L)
- `apps/backend/src/services/SubscriptionService.js:354-489` (sweeper)

**WebSocket / cache:**

- `apps/backend/src/infrastructure/websocket/websocketManager.js` (688L)
- `apps/backend/src/infrastructure/cache/redisClient.js` (243L)
- `apps/backend/src/infrastructure/cache/cacheService.js` (318L)
- `apps/backend/src/middleware/responseCache.js:1-9`
- `apps/backend/src/middleware/responseCache.middleware.js` (277L)
- `apps/backend/src/middleware/requestDedup.js` (124L)
- `apps/backend/src/middleware/queryCache.js` (117L)
- `apps/backend/src/middleware/imageOptimization.js` (78L)

**Payments / subscriptions / live / storage / email / composition root:**

- `apps/backend/src/api/routes/payments.js` (1215L)
- `apps/backend/src/api/routes/subscriptions.js` (292L)
- `apps/backend/src/api/routes/live-tests-public.js` (165L)
- `apps/backend/src/infrastructure/storage/storageProvider.js` (389L)
- `apps/backend/src/infrastructure/storage/upload.js` (237L)
- `apps/backend/src/infrastructure/email/emailService.js` (418L)
- `apps/backend/src/app-port5001.js` (1317L — sampled 1-250, 460-760, 1000-1317)
- `apps/backend/src/modules/users/user.routes.js:135-260` (avatar save/delete)
- `apps/backend/src/modules/auth/auth.routes.js:30-90` (avatar availability guard)

## 2. Issues

### A. BullMQ queues — silent drops, unconsumed queue, connection misuse

- **High — `addJob` silently drops when Redis down, `queueManager.js:67-75`.** Returns `null`; `eventBus.js:75-80,92-98` degrades to local-emit with only a `logger.warn`. Test-submitted analytics/leaderboard/recommendation jobs are lost, no spool/retry. Do not change signature; callers must check `null`.
- **High — `EVENTS` queue has no consumer in default worker.** `jobHandlers.js:80-85` defines an EVENTS handler, but `worker/index.js:9-14` only sets concurrency for analytics/leaderboard/notifications/recommendations, and `app-port5001.js:1109-1113` calls `initQueues()` but never `startWorkers()`. If the separate worker process isn't deployed, `messageBroker.enqueue()` (`messageBroker.js:129-153`) piles up unprocessed. Verify worker deployment in compose.
- **Medium — DLQ `Queue` objects share a live connection.** `queueManager.js:190` (`new Queue(..., {connection})` reusing the worker's connection) and `queueManager.js:233,256` (`getDeadLetterJobs`/`retryDeadLetterJob` pass `getRedisClient()` directly instead of `.duplicate()`). Violates the file's own rule at `queueManager.js:49,146` ("Don't share connections"); causes `Connection is closed` under load.
- **Medium — `retryDeadLetterJob` loses job opts, `queueManager.js:260-265`.** Re-adds with only `attempts`, dropping backoff/repeat/delay. Also `getQueueStatus` 500ms timeout at `queueManager.js:100-105` swallows errors and reports zeros — health endpoint lies during Redis brown-out.
- **Medium — `closeQueueResources` has no timeout, `queueManager.js:216-228`.** Sequential `worker.close()` → `queue.close()` can hang `gracefulShutdown` indefinitely; duplicated ioredis connections are only closed implicitly.

### B. Outbox poller — `SKIP LOCKED` without transaction = double-processing

- **High — `SELECT ... FOR UPDATE SKIP LOCKED` outside a transaction, `outboxPoller.js:16-26`.** `pool.connect()` + bare `SELECT FOR UPDATE` has no locking effect in Postgres (lock released at statement end). With `backend-1`/`backend-2` both polling every 5s, both select the same 10 `pending` rows → duplicate `emitDomainEvent` (line 45) → duplicate emails/analytics. Fix requires `BEGIN … COMMIT` (not proposed here per contract).
- **High — emit-before-mark with no transaction, `outboxPoller.js:44-52`.** Event is published, then `UPDATE … processed` on the same client but without `BEGIN/COMMIT`. Crash between the two = redelivery with no downstream idempotency (eventBus has none). At-least-once without dedup.
- **Medium — attempt cleaner overlap + blunt mass-update, `outboxPoller.js:102-138`.** `setInterval(async…)` has no overlap guard; `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` (lines 114-123) can hold a long write txn with no `LIMIT`. Also silently sets `abandoned/is_completed=true/submitted_at=NOW()` with no scoring/analytics side effects. Threshold `COALESCE(last_heartbeat_at,last_activity_at,updated_at,created_at)` (line 121) means autosave-touched rows may never qualify, or idle-but-open rows get force-closed.
- **Medium — throughput cap.** `LIMIT 10` per 5s poll (`outboxPoller.js:24`) = ~120 events/min max; bulk-submit bursts backlog with no metric/alert.

### C. Scheduler + subscription sweeper — dual-instance duplication, un-stopped interval

- **High — subscription sweeper has no distributed lock.** `testScheduler.js:25-29` correctly uses `scheduler:lock` (`SET PX 55000 NX`), but the hourly `processExpiredSubscriptions` interval at `app-port5001.js:1220-1231` has none. Both replicas send duplicate grace/expiry notifications (`SubscriptionService.js:424-473`).
- **Medium — sweeper interval never cleared.** `app-port5001.js:1220` `setInterval` handle is discarded; `gracefulShutdown` at `1249-1279` stops scheduler/outbox/cleaner but not this interval → keeps event loop alive, delays exit.
- **Medium — legacy downgrade over-reaches, `SubscriptionService.js:410-418`.** `UPDATE users SET is_pro_user=false WHERE pro_expiry<=…` doesn't exclude users holding an active `subscriptions` row (unlike the main path at 396-406). Read path (`subscriptions.js:46-52`) uses different grace semantics than the writer.

### D. Razorpay webhook / verify — forgery handling good, idempotency asymmetric

- **OK — webhook HMAC is correct.** Raw body mounted before JSON at `app-port5001.js:471-474`; `timingSafeEqual` with length check at `payments.js:819-825`; missing `RAZORPAY_WEBHOOK_SECRET` fails closed at `payments.js:798-809`; `pg_advisory_xact_lock` + `payment_id` check at `payments.js:867-884` serializes concurrent retries (with correct signed-int64 comment at 871-875).
- **High — `/verify` has no equivalent lock.** Guard at `payments.js:471-485` is a bare `findOne({orderId})` → two concurrent verifies for the same order both pass before either `insertOne` (601-616), granting Pro twice and double-incrementing coupons at `payments.js:555-580`. Webhook path is safe; verify path is not. Different keys (`orderId` vs `payment_id` at 878-881) also weaken cross-path dedup.
- **Medium — coupon read-modify-write race, `payments.js:562-572,912-949`.** `usedCount+1` / `usedByUsers.push` with no atomic increment; verify+webhook racing double-counts.
- **Medium — Pro renewal truncates, `payments.js:546-552,895-909`.** `expiry = NOW()+30/365d` instead of `max(NOW(), existing_expiry)+…`; early renewal loses remaining time.
- **Medium — network I/O inside DB txn, `payments.js:978-1009`.** Receipt email `await emailService.send` holds the advisory lock + transaction open under retry storm; should be post-commit. `persistWebhookEvent` DDL (`CREATE TABLE IF NOT EXISTS` at `payments.js:759-773`) on the hot path also contends.
- **Low — router raw-body fallback re-serializes, `payments.js:731-747`.** `JSON.stringify(req.body)` ≠ original bytes, so HMAC fails if app-level `express.raw` is ever skipped (e.g. content-type mismatch). Fail-closed (correct) but brittle in tests. Missing-secret 500 vs bad-signature 400 (`payments.js:806-833`) is a config oracle.

### E. Socket.IO — auth fixed, rooms over-broad, shutdown leaks

- **OK — WS auth downgrade closed.** `websocketManager.js:205-235` rejects missing/invalid tokens; query-token path removed (`49-60`); revoked-session DB check at `242-265`.
- **Medium — any authenticated socket can join any test room, `websocketManager.js:293-333`.** `live-tests:join` validates only `testId` shape via `normalizeTestRoom` (62-66); no enrollment/registration check. Joiners receive `live-test:participant_count` + `leaderboard:updated` broadcasts (`505-527,575-589`). Room enumeration / info disclosure.
- **Medium — `notifications:subscribe` joins a global room, `websocketManager.js:361-371`,** but `notification:new` fan-out (`530-547`) only targets `user:{id}` — the global room is dead surface (any authed user can sit in it).
- **Medium — `getIO()` no-op hides outages, `websocketManager.js:617-629`.** Callers (`broadcastToRoom`, `notifyUser`) think emits succeeded when `io==null`.
- **High — `gracefulShutdown` never closes WS, `app-port5001.js:1249-1279` vs `websocketManager.js:671-688`.** `closeWebSocket` (quits pub/sub dup clients, `io.close()`) is never invoked; neither is `messageBroker.close()`. Dup pub/sub clients leak; live sockets are severed on container kill. Shutdown also never calls `server.close()` — it closes DB/Redis while still listening, failing in-flight requests.
- **High — cross-instance event fan-out gap.** `setupEventBusListeners` (`websocketManager.js:464-611`) subscribes to the in-process `eventBus` EventEmitter, not the Redis `messageBroker` channel. An event emitted on backend-1 only wakes WS clients pinned to backend-1 (Redis adapter syncs `io.to().emit` calls, not the bus). `messageBroker.handleInboundMessage` (`messageBroker.js:158-177`) has a self-echo guard, but nothing bridges broker→`setupEventBusListeners`.
- **Low — dead `reconnect_attempt` server listener (`websocketManager.js:273-277`, client-only event); in-memory rate-limit Map (`30,90-109`) only freed on clean disconnect (`439`).** Heartbeat 25s/20s (`168-169`) = 45s dead-peer detection, disjoint from the 30-min attempt cleaner.

### F. Redis fail-soft / cache — coherent design, two barrier leaks

- **OK — fail-soft is real.** `redisClient.js:43-46` circuit breaker (5 failures → 30s open), `cacheService.js:184-227` L1-then-L2 with `CACHE_IO_TIMEOUT_MS` cap, `queueManager.js:37-43` disables queues when Redis down, `messageBroker.js:27-32,130-133` falls back to local publish. `getRedisClient` (49 edges) / `pool` (113) usage is consistent.
- **Medium — hot-path event emission pays 4 sequential Redis round-trips.** `eventBus.js:85-99` `await addJob` per target (analytics→leaderboard→recommendations→notifications) with `commandTimeout 1500ms` (`redisClient.js:21-22`); Redis flap injects seconds into `test_submitted`.
- **High — `responseCache` in-flight barrier leaks on `res.send`.** Barrier released only inside the `res.json` wrapper (`responseCache.middleware.js:100-116,169-186`). Any cached route responding via `res.send` (imageOptimization buffers at `imageOptimization.js:54,69`; avatar SVG at `app-port5001.js:742-749`) never calls `finish()` → key stays in `inFlight` forever; all future GETs for that key await a never-resolving promise. Global mount at `app-port5001.js:637-649` makes this reachable.
- **Medium — SWR stale path runs handler after response ended, `responseCache.middleware.js:226-250`.** Downstream errors after `res.json(envelope.body)` are unhandled; cold-path `WAIT` (`253-258`) still executes the handler (not deduped). Public live list at `live-tests-public.js:16` uses default `userScoped:true` for identical public data → per-user cache cardinality explosion + 30s stale live roster with no publish invalidation.
- **Low — L1 warm ignores caller TTL (`cacheService.js:216`, 5-min warm); file-cache writes to `process.cwd()/.cache` (`cacheService.js:53-55`) fail silently on read-only rootfs containers.**
- **Note — responseCache duplication is resolved.** `responseCache.js:1-9` now re-exports `responseCache.middleware.js`; single implementation.
- **`requestDedup` is sound for GETs** (`requestDedup.js:29-35` per-credential fingerprint, 503 caps at 68/83-85, TTL sweep 38-55) but offers no mutation protection — double-clicked `POST /verify` bypasses it by design (GET-only at line 61), compounding issue D.
- **`imageOptimization` DoS + 500.** No `?w` upper bound or quality floor (`imageOptimization.js:33-36,58-73`, `sharp().resize(width)` unbounded); `decodeURIComponent` at line 23 throws on malformed `%` → uncaught 500; webp-forced `Content-Type` on `.jpg` URLs risks CDN cache poisoning.

### G. Storage avatars (S3 vs local) — likely source of `avatar_1_*.webp` 404

- **High — S3/Supabase failure fails open to ephemeral local disk, `storageProvider.js:300-325`.** `catch → console.warn → uploadLocal`. In prod (read-only/ephemeral containers, `logLocalFallbackWarningIfNeeded` at 293-298) the returned URL is a localhost `/uploads/…` URL (`134`) or later `/assets/avatar/…` fallback (`user.routes.js:251-259`), which doesn't survive redeploy/scale-out. `auth.routes.js:44-51` then nulls the missing file while old DB rows still reference `/assets/avatar/avatar_1_*.webp` → 404s. The `/assets/avatar` static mount (`app-port5001.js:726-750`) now masks this with a 200 SVG placeholder, but stale rows + per-avatar URL-scheme drift (S3 public URL vs local path depending on failure at upload time) remain.
- **Medium — avatar save fallback bypasses provider, `user.routes.js:241-259`.** Direct `uploads/avatars` write returns `/assets/avatar/…` even when `STORAGE_PROVIDER=s3` — inconsistent scheme per avatar age.
- **Low — orphaned remote objects.** `deleteOldProfileAsset` (`user.routes.js:143-183`) only parses Supabase public URLs (153-159); S3 URLs are never deleted; failures swallowed (`.catch(()=>{})` at 159).

### H. Email — durable, shutdown-bounded

- **OK — spool persistence + retry, `emailService.js:46-105,151-193`.** `drainEmailQueue` awaited in shutdown (`app-port5001.js:1267`).
- **Low — drain guard caps at ~5s (`emailService.js:356-360`, 50×100ms) then leaves mail in spool — correct but operators should expect replay-on-boot, not guaranteed flush.**

## 3. Verification

- All findings derived from static reads of the files listed in §1 (no code executed, no DB/Redis contacted, per contract `Verification Commands: none`).
- Cross-checked: webhook raw-body mount (`app-port5001.js:471-474`) against router fallback (`payments.js:717-747`); shutdown list (`app-port5001.js:1249-1279`) against existing stoppers (`stopScheduler/stopOutboxPoller/stopAttemptCleaner`, `drainEmailQueue`, `closeQueueResources`, `closeRedis`) to prove `closeWebSocket`/`messageBroker.close`/subscription-interval/server.close omissions; `responseCache.js` re-export to confirm dedup-resolution; `user.routes.js` + `auth.routes.js` + `/assets/avatar` mount to trace the avatar 404 mechanism.
- Severity reflects reliability/security impact under the stated scaled topology (dual backends, Redis-backed adapter/queues); single-instance dev downgrades several Highs to Medium.

## 4. Blockers

- Cannot verify live behavior (no execution per contract): actual Redis/DB state, whether the separate worker process is deployed (determines EVENTS-queue stall), Rabbit-less `outbox_events` contention under real concurrency, Razorpay signature round-trip, or S3 vs local avatar distribution in prod.
- Out of territory (not inspected): `apps/frontend`, `apps/admin-panel`, `packages/*`, migration DDL contents, `scripts/*`, `docs/*`, git history. FK/unique-constraint claims (e.g. `transactions.payment_id` uniqueness, `webhook_events` migration 120 state) assumed from code, not schema-verified.
- No signature changes proposed per constraints; all fixes above are report-only and need owner sign-off with `file:line` references as given.

## 1. Files Inspected

**packages/shared-config/src:** `apiClient.js` (238L — `createApiClient` factory, refresh queue, error mapping), `csrf-token-store.js` (92L — memory + `_csrf_token` cookie + BroadcastChannel), `errors.js` (55L — 5 classes), `logger.js` (81L) + `logger.d.ts`, `enrollment.js` (168L — canonical), `index.js` (551L — re-exports, `formatRemainingDays` dup), `htmlSanitizer.js` (referenced, not deep-read).

**packages/shared-hooks:** `index.js`, `apiClientConfig.js` (35L — `request()` fetch fallback), `useProPass.js` (260L), `useWebSocket.js` (145L), `useGenericCRUD.js` (240L), `useStages.js` (1–50 + grep across file; `useExamCategories`/`useTestCategories` via grep pattern-match).

**apps/frontend/src/shared/lib:** `apiClient.js` (160L — thin factory wrapper + GET dedup + `fetchFromAPI`), `apiBase.js` (51L), `api.js` (13L re-export), `dataService.js` (670L — CacheService + DataService + convenience exports), `practiceAPI.js` (158L), `aiAPI.js` (14L), `aiStreaming.js` (162L), `vectorSearch.js` (126L), `enrollment.js` (157L — local fork), `dashboardCache.js` (27L), `bookmarksAPI.js` (28L), `websocket.js` (1–80 of 205L), `telemetry/TelemetryService.js` (573L), `telemetry/OfflineQueue.js` (103L), `offline/IndexedDBAttemptVault.js` (470–519 slice).

**apps/admin-panel/src/shared/lib:** `apiClient.js` (358L — full fork, not factory), `apiBase.js` (67L), `dataService.js` (492L), `cacheService.js` (111L), `enrollment.js` (29L — clean delegation), `logger.js` (69L — fork), `errorReporter.js` (1–60), `api/` dir listing (9 split modules).

## 2. Issues

### A. apiClient — 3 implementations, 1 canonical + 1 wrapper + 1 fork

- **Admin is a full fork, not a factory consumer.** `admin-panel/src/shared/lib/apiClient.js:107-322` re-implements request/response interceptors instead of calling `createApiClient` (frontend `frontend/.../apiClient.js:33-50` does it correctly). Drift is already real — see below. `file:line → admin-panel/src/shared/lib/apiClient.js:107-322` vs `packages/shared-config/src/apiClient.js:28-237`.
- **BaseURL / path convention mismatch (cross-copy hazard).** Frontend: `baseURL = host origin`, callers use `/api/...` (`frontend/.../apiClient.js:12,33`). Admin: `baseURL = origin + /api` + strips leading `/api/` (`admin-panel/.../apiClient.js:13,123-125`). Admin `dataService.js:434-441` even carries a "do NOT add /api prefix" comment. Copying an endpoint string between apps breaks silently (`/api/api/...` or stripped path).
- **Auth-endpoint match divergence.** Factory default `authUrlMatch:"includes"` (frontend passes `includes`, `frontend/.../apiClient.js:47`); admin hardcodes `startsWith` (`admin-panel/.../apiClient.js:211-215`). After admin's URL strip this happens to work, but the two apps match different URL shapes — fragile.
- **CSRF rotation capture divergence.** Factory captures `headers + data.data.csrfToken + data.csrfToken` (`shared-config/src/apiClient.js:94-102`) and frontend opts in via `captureCsrfOnError:true` (`frontend/.../apiClient.js:48`). Admin success path checks **headers only** (`admin-panel/.../apiClient.js:159-161`), missing body-rotated tokens; error path checks headers + `data.csrfToken` but not `data.data.csrfToken` (`:174-177`).
- **Admin-only 403-CSRF single retry** (`admin-panel/.../apiClient.js:185-205`) has no equivalent in factory/frontend. Behavior differs per app for the same backend response.
- **Queued-waiter replay inconsistency (refresh path).** Factory waiters replay `originalRequest` unchanged (`shared-config/src/apiClient.js:195-197`) — replaying a stale `Authorization: Bearer <expired>` header. Admin waiters explicitly delete `Authorization` before replay (`admin-panel/.../apiClient.js:271-279`) so cookie auth wins. Neither is clearly correct for both auth modes; they disagree with each other.
- **Fatal-refresh errors are untyped.** Both implementations `reject(refreshError)` raw (`shared-config/src/apiClient.js:186-193`; `admin-panel/.../apiClient.js:262-269`) — callers expecting `AuthenticationError` get raw axios on the most important failure.
- **Admin `fetchFromAPI` destroys error types** (`admin-panel/.../apiClient.js:324-355`): spreads all `options` into axios config (no allowlist) and wraps `error.response.data` in a generic `DataError`, discarding the interceptor's `ValidationError/AuthenticationError/NotFoundError`. Frontend `fetchFromAPI` (`frontend/.../apiClient.js:94-157`) has an allowlist and preserves mapped types. Same function name, different contracts.

### B. Refresh-loop verdict

- No infinite loop: both guard with `_authRefreshAttempted` + auth-endpoint bypass, and the refresh POST carries `_authRefreshAttempted:true`. `shared-config/src/apiClient.js:122-130,146-148`; `admin-panel/.../apiClient.js:216-226,240-244`. Single-flight queue via `isRefreshing`/`failedQueue` is sound in both.

### C. fetch-vs-axios inconsistency (shared-hooks bypasses every guard)

- `shared-hooks/apiClientConfig.js:15-34` `request()` falls back to **raw `fetch`** with hardcoded `http://localhost:5001`, no `credentials:include`, no CSRF header, no `ok`-check, no typed errors. Prod leak if env vars missing.
- `shared-hooks/useStages.js:27-33` (and by template `useExamCategories`/`useTestCategories`): when `getSharedApiClient()` is null (app forgot `setSharedApiClient`), taxonomy calls go over that raw fetch — no cookies, no CSRF, untyped errors surfaced only as `setError(err.message)` (`useStages.js:39-40`). Feels like a silent 401 factory.
- `frontend/.../offline/IndexedDBAttemptVault.js:484-499` fallback fetch reads dead key `trstprep_auth_token`, sends `Authorization: Bearer` from localStorage, sets **no `credentials:include`, no CSRF header** on `POST /api/attempt/:id/sync-replay`. Contradicts the httpOnly model the rest of the tree just migrated to.

### D. CSRF injection gaps

- `aiStreaming.js:57-63` native fetch **does** send CSRF + `credentials:include` (good) but has **no 401-refresh retry** (can't reuse axios interceptors), captures no rotated token, maps all failures to `onChunk({error: rawText})`, and `streamChatAsync:160` rethrows generic `Error(string)` — status/type lost. `res.body.getReader()` (`:71`) has no null guard.
- `TelemetryService.flushSync:274-286` uses `navigator.sendBeacon(Blob)` — **headers cannot be set**, so no CSRF token on unload flush; `fallbackFlushSync:289-302` sets `withCredentials` but still no `X-CSRF-Token`. Unload-time telemetry is likely rejected by CSRF middleware (server side unverified — forbidden path) = silent event loss.
- Two socket stacks coexist: `frontend/.../websocket.js:13-46` `initWebSocket({token})` still forwards `auth.token` from JS, while `shared-hooks/useWebSocket.js:69-83` deliberately reads no storage (cookie-only, `token` back-compat only). Different reconnect policies (`Infinity` vs 10 attempts). Double-connection risk if both are mounted.

### E. Error swallowing / wrong mapping

- No `ForbiddenError`/`RateLimitError`: 403 → `AuthenticationError("Access forbidden")` (`shared-config/.../apiClient.js:211-213`), 429 → generic `DataError HTTP_429`, 500 message replaced with `"Server error"`, discarding backend detail (`:217-218`).
- Frontend `dataService.fetchWithCache:188-193` retries everything except Validation/Auth — including 403/404/429 — 3× with backoff.
- `useGenericCRUD.js`: `fetchItems` catch returns `[]` (`:65-68`); `saveItem`/`deleteItem` return `false` + toast (`:103-108,:143-148`); `console.error` only. Assumes `response.data.success` envelope (`:58,:94,:133`) — mismatches list-returning endpoints. `deleteItem:134-137` does optimistic filter **plus** full refetch (redundant). `toggleActive:183-186` PUTs the whole item (read-only field overwrite risk). `editItem:165` uses `_id||id`, ignoring `public_id` — an item keyed only by `public_id` yields `PUT <endpoint>/null`.
- `bookmarksAPI.getAll:4-15` returns `r.data` (envelope) while `getCount:16-17` returns `r.data?.data` — inconsistent unwrap; admin `getBookmarks` delegates to `adminAPI` instead (different shape again).
- `vectorSearch.js`: `deleteEmbedding:92-95` returns `r.data` vs everything else `r.data?.data`; `findSimilarQuestions:121` appends `?` even with empty params; `semanticSearch:103-108` (`/api/search/vector/semantic`) overlaps `searchSimilar:20-26` (`/api/embeddings/search`) with no canonical-choice note; no empty-query validation.

### F. Logger — "pino redaction" contract NOT met in territory

- `shared-config/src/logger.js:52-79` is `console.*` with a DEV gate. **No pino, no redaction** — `logger.error(...args)` forwards tokens/PII verbatim to console → Loki. `admin-panel/.../logger.js:16-69` is a second fork (same no-redaction behavior + extra `timer()`). `logger.d.ts` types plain passthrough. If redaction exists, it lives in backend (forbidden path) — unverified.

### G. Hooks

- `useProPass` coupling **fixed**: DI via `initProPassAuth(useAuth)` (`shared-hooks/useProPass.js:14-23`), degrades to warn + defaults (`:30-54`) instead of throwing. Residual: forgotten `init` renders **silent "Free Plan" for pro users**; `isAdmin` trusts client fields (`:59-60`, UI-gating only — must not be treated as authz).
- `formatRemainingDays` duplicated identically in `shared-config/src/index.js:342-350` and `shared-hooks/useProPass.js:201-209` — drift risk.
- `useWebSocket` singleton + refcount (`shared-hooks/useWebSocket.js:28-29,66-116`) is correct for StrictMode; `SOCKET_URL` frozen at module load (`:25`) so late env changes are ignored (minor).

### H. dataService / cache / enrollment / dashboardCache

- Cache key divergence: frontend `generateKey` (`frontend/.../dataService.js:66-72`) uses raw interpolation, no encoding, `[object Object]` for nested params. Admin `cacheService.js:11-24` encodes + JSON-stringifies. Same inputs → different keys per app.
- Frontend `refreshData`/`forceRefreshAll` deliberately omit `questions` because `getQuestions()` hits admin-only `/api/admin/questions` (`frontend/.../dataService.js:520-521,539`) — but `getQuestions` is still exported/callable from the student app → runtime 403.
- Admin `getTestById:286-305` fetches **all tests then `Array.find`** — O(n), stale-cache-sensitive; no direct `GET /tests/:id`.
- `dashboardCache.js:1-27`: single-slot blob, 5-min TTL, keyed by caller-supplied `userId`. Stale entitlements for 5 min after purchase; correctness depends on every caller passing the right id and on `invalidateDashboardCache` being wired (it is, via `enrollment.js:3-8`, which creates a lib→lib coupling).
- Enrollment fork: frontend `enrollment.js` is a local fork (imports `dashboardCache`); canonical lives in `shared-config/src/enrollment.js`. Real divergence: FE normalizes `extraIdentifiers` via `normalizeEnrollmentEntry` (`frontend/.../enrollment.js:148`), canonical spreads them raw (`shared-config/.../enrollment.js:143-152`) — object extras match in FE, fail in canonical. Admin already delegates cleanly (`admin-panel/.../enrollment.js:10-22`); frontend should do the same.

### I. Telemetry correctness notes

- `TelemetryService.js:194` / `:377` POST via `apiClient` (CSRF + refresh OK). But: `logEvent:138` drops silently when stopped; `flush:200-218` re-queues the whole batch on **any** error including 400/404 → poison-batch infinite retry; `flush` vs `flushOfflineEvents` share `isFlushing` without a mutex (race); `syncServerTime:414` depends on `GET /api/health` shape (backend — unverified); `OfflineQueue` caps at 1000 with silent FIFO eviction (`OfflineQueue.js:13-25`), counts preserved only via `getMetrics`.

## 3. Verification

- Static read-only review only, per contract (no verification commands run). Every claim above cites `file:line` from files actually read. `useExamCategories`/`useTestCategories` fetch-fallback shape inferred from `useStages.js` + grep (same `API_URL`/`fetch(${API_URL}...)` template lines) — recommend a 2-minute read to confirm line numbers before acting.
- No refresh-loop, CSRF, or error-type finding was executed at runtime; interceptor logic was traced by hand, not tested.

## 4. Blockers

- **Forbidden paths blocked server-side confirmation:** backend CSRF exemptions (does `POST /api/attempt/:id/events` / `sync-replay` / sendBeacon-Blobs pass without `X-CSRF-Token`?), `/api/auth/refresh` response envelope (`token` vs `data.token` — both clients handle both, but only one path is tested per app), `/api/health` timestamp shape for `syncServerTime`, Socket.IO `protect` acceptance of `auth.token` vs cookie, and the exact 403-CSRF message string the admin retry sniffs (`admin-panel/.../apiClient.js:188`). All need a backend-territory agent or explicit scope expansion.
- `useAuth` itself lives outside the assigned territory (frontend providers, not `shared/lib`) — only its DI surface (`initProPassAuth`) was verified here.

## 1. Files Inspected

**CI / hooks / root config (11):**

- `.github/workflows/ci.yml`, `security.yml`, `no-env.yml`, `data-guard.yml`
- `.husky/pre-commit`, `.husky/post-commit`, `.husky/graphify-sync.sh`
- `.lintstagedrc.json`, `package.json`, `turbo.json`, `pnpm-workspace.yaml`
- `.nvmrc` (=`22`), `CONTRIBUTING.md`, `.gitignore`, `.env.example`

**Docker / deploy (10):**

- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `docker-compose.scale.yml`
- `apps/backend/Dockerfile` + glob `apps/*/Dockerfile` (all 3 exist)
- `deploy/rolling-deploy.sh`, `deploy/backup-db.sh`, `deploy/setup-ssl.sh`, `deploy/bootstrap.sh`
- `scripts/scale.sh`

**Scripts (sampled ~12/111):**

- `scripts/run-database-audit.js`, `scripts/run-migrations.mjs`, `scripts/validate-routes.js`, `scripts/sync-repo-brain.mjs`, `scripts/dev-sequential.mjs`, `scripts/wait-for-backend.mjs`, `scripts/load-test-telemetry.js`
- Taxonomy: `show-full-taxonomy.mjs`, `import-syllabus.js`, `dump-subjects-units.js` (listed), `generate_taxonomy_html.py`, `build_syllabus_brain.py`, `parse_master_syllabus.js`, `split_languages.cjs` (listed via dir)

**Load tests (6):**

- `tests/load/api.js`, `auth.js`, `realtime.js`, `k6.config.js`, `package.json`, `README.md`

## 2. Issues

### A. CI — pins good, but scope notes

- **Pinned SHAs OK:** `ci.yml:10-13` pins checkout/setup-node/upload-artifact/codeql; all jobs use `node-version: '22'` (`ci.yml:34,54,112,183`), matching `.nvmrc:1` (`22`) and `CONTRIBUTING.md:3` (Node 22). **Dispatch premise "Node 20 / CONTRIBUTING Node 18" is stale — no such mismatch exists in tree.**
- **Unpinned outlier:** `pnpm/action-setup@b906aff...` used 5× in `ci.yml` but NOT in the `ACTION_*` env pin table — inconsistent with H29 comment.
- **Migration in CI fixed:** `ci.yml:186-192` runs `node scripts/run-migrations.mjs` (comment documents old broken path) + `ci.yml:193-196` runs `run-database-audit.js`. Good. Caveat: `test-migrations` service is bare `postgres:16.4` with `trust` auth, no Redis — Redis-dependent migrations/seed paths untested.
- **`sync-repo-brain --check` never wired:** script supports `--check` (`sync-repo-brain.mjs:24,202-207`) but no workflow calls it; staleness guard is dead.
- **`validate-routes.js` never run in CI:** no reference in any workflow; drift gate is orphaned.

### B. `validate-routes.js` — narrow, brittle

- **Only 9 checks** (`validate-routes.js:28-73`): 2 auth + 4 test + 3 admin-realtime. Zero coverage of 72 composition-root mounts, 30 extracted admin routers, 32 module route files.
- Checks file-local `router.get('/pattern')` regex (`:88`), not actual mounts in `app-port5001.js`; will false-pass/false-fail on mount-prefix refactors.
- Input is `apps/backend/openapi-spec.yaml:8` (exists per glob) — but spec freshness vs. mounted routes is itself unverified.

### C. `run-database-audit.js` — stale references, warn-only

- **Stale migration pointers:** `run-database-audit.js:86` "Run migration 121" (junction), `:278` "Run 035/079/137", `:318` "run migration 093", `:385` "run 088/104/115" — current sequence is 000–129; numbers are historical, misleading for next-migration `142_*`.
- **Table-name drift:** expected list (`:52-72`) includes `subject_units/subject_chapters/subject_topics/subject_subtopics` while taxonomy scripts query `units/chapters/topics/subtopics` (e.g. `show-full-taxonomy.mjs:80-162`) — audit may false-fail on canonical names.
- **HNSW vs ivfflat:** audit (`:288-320`) enforces HNSW `m=32/ef=200`; schema docs elsewhere cite ivfflat cosine — tuning check may be wrong index type.
- **Non-blocking:** missing indexes/FKs/encryption only `warnings++` (exit 0, `:427-429`); only RLS-bypass and short keys fail. CI gate is soft.

### D. Taxonomy scripts — hardcoded, coupled

- `scripts/import-syllabus.js:98-112` hardcodes `SUBJECT_MAP` name→ID (e.g. mathematics→22); breaks on reseed. Reads `docs/reference-data/Master Syllabus.txt:122` (likely gitignored by `.gitignore:172 *.txt`); dry-run default (`:115`) safe but easy to mis-run with `--execute`.
- `scripts/import-syllabus.js:119` imports `postgres-helpers.js` pool directly — couples standalone script to backend internals.
- `show-full-taxonomy.mjs` assumes `subjects/units/chapters/topics` + `is_active` flags; no soft-delete (`is_deleted`) awareness, LIMIT 20 samples hide drift.
- `.gitignore:120 *.cjs` ignores all `*.cjs`, yet `scripts/*.cjs` files are tracked (`add-attempt-number-column.cjs`, `split_languages.cjs`, `inspect-ssc-cgl-sections.cjs`) — new `.cjs` tooling silently ignored.

### E. k6 load tests — stale endpoints + dead auth

- **Dead token fetch (confirmed, self-documented):** `tests/load/realtime.js:38` gates login on `__ENV.HTTP` (never set) → `getAuthToken()` always `""`; all WS scenarios unauthenticated. `tests/load/README.md:87-93` admits this.
- **Stale endpoints in `api.js`:** `:85` `/api/test-series`, `:135` `/api/questions?limit=20`, `:154` `/api/user/dashboard` (canonical is `/api/users/*`), `:164` `/api/leaderboard` (canonical `/api/leaderboards`), `:199` `POST /api/test-attempts` (canonical `/api/tests/:id/start`, `/api/attempt/*`), `:210` `/api/questions/search`. Load coverage does not match mounted routes.
- **Defaults wrong:** `k6.config.js:1` defaults `BASE_URL=http://localhost:3000` (frontend port; backend is :5001). `api.js:29`/`realtime.js` require unset `TEST_PASSWORD` → authenticated suites fail by default.
- **No CI:** no workflow runs k6; thresholds (`k6.config.js:15-17` p95<500ms, err<1%) contradict observed 5s practice/bookmark latencies — suite would fail on current perf.
- **Broken script:** `tests/load/package.json:10` `test:all: k6 run ... api.js auth.js realtime.js` — k6 takes one file; multi-file invocation invalid.
- `scripts/load-test-telemetry.js` is a bespoke 1000-event telemetry hammer (hardcoded `TARGET_URL :5001:31`, dummy `$2b$10$dummyhash:55`, forged `jwt.sign:88-92`) — not part of k6 suite, writes/deletes real `attempts/attempt_events`, requires live DB + `JWT_SECRET`.

### F. Docker — base hardened, `scale` fork stale

- **Base `docker-compose.yml` (12 services: backend-1/2, frontend, admin-panel, redis, backend-db, nginx, certbot, certbot-init[profile init], prometheus, grafana, loki):** hardening verified — `cap_drop: ALL`, `no-new-privileges`, `read_only: true` + tmpfs, `127.0.0.1` bindings, 3-network isolation (`monitoring-net internal:true:444`), per-backend 512M/1.0 CPU, Redis `noeviction` (BullMQ-safe), Loki driver with loki itself on `json-file` (avoids self-loop `:416-420`), Grafana `GF_SECURITY_ADMIN_PASSWORD :?` required.
- **`docker-compose.scale.yml` diverged/stale:** standalone 10-service file (not override): runs `pnpm run dev` (`:21,71,121`), host bind-mounts source (`:19-20`), hardcodes `FRONTEND_URL=https://localhost` + `REDIS_URL=redis://redis:6379`, collapses to single `backend-net` (loses frontend/monitoring isolation), drops Loki logging + certbot volumes, `grafana:311-326` has no password/anon-disable env, `frontend` on `backend-net`. Do not use as prod reference.
- **`docker-compose.prod.yml` vs base comment conflict:** header claims base is "production-safe"; prod override still strips `volumes/ports` and swaps to `pnpm start` / `nginx -g 'daemon off'` — one of the two descriptions is outdated.
- **Node skew:** `apps/backend/Dockerfile:1,9` `node:20-alpine` vs `.nvmrc`/CI/CONTRIBUTING Node 22; `engines: >=20` masks it. Frontend/admin Dockerfiles not diffed here but same check recommended.
- **Deploy scripts OK:** `rolling-deploy.sh` (drain+health-gated, `rollback` subcommand, nginx reload), `backup-db.sh` (globals+custom dumps, 7d/4w retention), `setup-ssl.sh` (validates `DOMAIN/CERTBOT_EMAIL`, profile-init certbot), `bootstrap.sh` (Loki plugin + SSL). `scripts/scale.sh` only knows `backend-1..3`/ports 5001-5003 and `docker-compose.scale.yml` — tied to stale file.

### G. Pre-commit / lint — prettier-only

- `.husky/pre-commit:4` blocks only `.env/.env.local/.env.production/.env.staging`; `.lintstagedrc.json:2-3` runs just `prettier --write` — no eslint, no secret scan at commit time. Uses `npx` while repo is pnpm (`package.json:28` `prepare` also uses npm-style `husky install` under husky v9).

### H. Secret-scan gaps (`file:line`)

- `.github/workflows/no-env.yml:39` excludes `\.(lock|example|md|html|sql|css|png|jpg|svg|ico|woff|map|json)$` — **secrets in `*.json`/`*.sql`/`*.md`/`*.html` never scanned**; `:38` excludes `docs/archive`, `docs/database/Open`; `:50-51` second pass excludes `docs|archive` + `\.(lock|example|md|html|sql|css)$`. Git-history leaks (Supabase URL, Razorpay keys per AGENTS.md) live exactly in excluded shapes.
- `.github/workflows/data-guard.yml:42` allowlists `scripts/*schema_dictionary*.json`, `src/data/collections/`; `:62` excludes `^docs/|\.md$|__tests__|/test/|SECURITY_POSTURE|REMEDIATION_PLAN|AGENTS.md` — placeholders vs live secrets indistinguishable to scanner.
- CI `no-env.yml:20` checks only `(^|/)\.env$` + `M3 Key.txt` (`data-guard.yml:54`) — misses `.env.local/.env.production/.env.staging` variants that pre-commit blocks; `.gitignore:29 *.env` covers them from ignore but not from CI detection.
- `.env.example:40-49` ships placeholder-shaped `JWT_SECRET/.../DB_ENCRYPTION_KEY` (sub-32-char? contains `generate_a_...`); scanners keyed on 32+ char values won't trip on placeholders — correct, but means example rotation can't be validated.

### I. `CONTRIBUTING.md` / misc stale (minor)

- `CONTRIBUTING.md:55` "next is `136_*`" vs worktree 130 files (000–129); `:68` "scripts/ (108 files)" vs actual 111; `:56` "admin `generate-questions` is a stub" vs live OpenRouter gateway. Version lines themselves (Node 22) are current.
- `.env.example:83-84` `AI_FREE_HOURLY_LIMIT=30 / AI_PRO=120` vs documented 50/500 elsewhere.

## 3. Verification

- **Static read-only only** (per contract `Verification Commands: none`): all claims from file reads + globs above; no code executed, no DB/Redis probed, no `git` writes.
- **Cross-checked:** pin SHAs line-by-line in all 4 workflows; `node-version` strings; `.nvmrc` vs `engines` vs CONTRIBUTING; compose service list counted from `docker-compose.yml:32-422`; `apps/*/Dockerfile` glob = 3 hits (no missing Dockerfiles); `openapi-spec.yaml` exists via glob; `modules/tests/test.routes.js` exists (so validate-routes file targets resolve, but coverage still 9/100+ endpoints); k6 dead-code confirmed at `realtime.js:38` + README admission.
- **Not verified (needs live env):** actual migration run, `run-database-audit.js` output, k6 runs, `docker compose config` on scale/prod overrides, graphify hook end-to-end (log lives at `~/.cache/graphify-rebuild.log`, outside repo).

## 4. Blockers

- None for research scope. No writes performed; forbidden paths (`apps/backend/src`, `apps/frontend/src`, `apps/admin-panel/src` edits, git writes) untouched.
- Follow-ups requiring execution (out of scope): run `node scripts/run-database-audit.js` against live DB, `docker compose -f docker-compose.yml -f docker-compose.prod.yml config`, k6 smoke with `TEST_PASSWORD` set, and `node scripts/sync-repo-brain.mjs --check` in CI.

## 1. Files Inspected

**Composition root & route indexes:**

- `apps/backend/src/app-port5001.js:50,651-1047,1076` — all `app.use()` mounts; `mountExtractedRoutes` import + call; no `mountAdminRoutes` call
- `apps/backend/src/api/routes/admin.js:1-124` — canonical admin router, aggregates ~38 modular routers (`admin-activity.js:23` … `admin-live-tests.js:60`), guard stack `normalizeFields:65 → restrictAdminOrigin:66 → validateAdminApiKey:67 → protect:68 → admin:69 → CSRF:70 → loadAdminPermissions:71 → requireAdminPermission:72 → audit:75-80`
- `apps/backend/src/api/routes/admin-routes-index.js:1-19` — dead wrapper, only forwards to `admin.js`
- `apps/backend/src/api/routes/public-routes-index.js:1-42` — `mountExtractedRoutes(app)`, 16 public routers

**Alleged unmounted controllers:**

- `apps/backend/src/modules/tests/test.controller.js:1-246` (own `express.Router`, `GET /`, `PUT /:id/state`)
- `apps/backend/src/modules/attempts/attempt.controller.js:1-65` (own router, `POST /start|/save-progress|/pause|/resume`)
- `apps/backend/src/modules/questions/question.controller.js:1-284` (own router + multer bulk upload, `adminAuth` stack `:22-28`)
- `apps/backend/src/modules/sessions/session.controller.js:1-683` + `session.routes.js:1-19` (wired: `GET /`, `DELETE /`, `DELETE /:sessionId` via controller methods)
- `apps/backend/src/modules/tests/test.routes.js:1-30` (1834 lines, inline handlers, canonical `/api/tests` target)
- `apps/backend/src/modules/attempts/attempt.routes.js:1-30` (1381 lines, inline handlers, canonical `/api/attempt` target)

**Duplication/residue candidates:**

- `apps/backend/src/middleware/responseCache.js:1-9` + `responseCache.middleware.js:1-277`
- `apps/backend/src/config/upload.js:1-44` (multer `fileUpload` + `uploadLimiter`)
- `apps/backend/scripts/check_user_attempts.js:1-47` (PII-safe argv/env version)
- `docs/legacy-migrations/005_create_user_sessions.sql,007_create_test_sections.sql,008-standardize-ids-and-fix-relations.sql,009-full-schema-audit.sql,010-section-series-stage-linking.sql` (+ 9 other legacy files)
- `scripts/validate-routes.js:1-105` + `apps/backend/openapi-spec.yaml` (exists)
- `apps/frontend/src/App.jsx:82,256` ; `apps/frontend/src/pages/index.js:45-46,50` ; `apps/frontend/src/pages/exams/index.js:3-4,8` ; `ExamCompare.jsx:16`, `ExamDetails.jsx:32`
- `apps/admin-panel/src/features/admin/index.js:1-66` ; `apps/admin-panel/src/App.jsx:114-115,148-152,297-299` ; `study-materials/SubjectHierarchyManager.jsx:40,902`
- Graph: `graphify-out/GRAPH_REPORT.md` (15567 nodes, 21022 edges, 1053 communities; god nodes `dbHelpers:138, pool:113, protect():101, admin():71, PostgresHelpers:52`; communities `_COMMUNITY_API Routes & Auth, Test Routes & Attempts, Admin Analytics Routes, Sessions & Bookmarks`)

## 2. Issues

### A. Confirmed orphans / dead code

| #   | Finding                                                                                                                                                                                                                                                                         | Location                                                                              | Severity                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| A1  | `test.controller.js` defines a full router but nothing imports it; canonical mount uses `test.routes.js` inline handlers (`app-port5001.js:977`)                                                                                                                                | `modules/tests/test.controller.js:18-40`                                              | Medium — dead code, confusion risk                  |
| A2  | `attempt.controller.js` defines a full router but nothing imports it; canonical mount uses `attempt.routes.js` (`app-port5001.js:1001` behind `protect`)                                                                                                                        | `modules/attempts/attempt.controller.js:8-40`                                         | Medium — dead code                                  |
| A3  | `question.controller.js` defines a full router + multer bulk path but nothing imports it; `admin-questions.js:751` itself notes "unmounted question.controller.js but was never exposed"                                                                                        | `modules/questions/question.controller.js:20-40`, `api/routes/admin-questions.js:751` | Medium — dead code                                  |
| A4  | `mountAdminRoutes` dead: defined in `admin-routes-index.js:11-17` but zero call sites in `app-port5001.js` (only `mountExtractedRoutes` at `:1076`). Docs (`REPO_BRAIN.html:1691`, `UNIFIED_TRSTPREP_AUDIT.md:1243,8423`) still describe the old dual-mount world — stale prose | `api/routes/admin-routes-index.js:11`                                                 | Low — delete wrapper or doc note; no runtime effect |
| A5  | `src/config/upload.js` residue: exports `uploadLimiter`/`fileUpload`, zero importers in `src/` (grep `config/upload` = 0 hits). Live upload path is `infrastructure/storage/upload.js` via `admin-assets.js`                                                                    | `src/config/upload.js:4-16`                                                           | Low — safe delete                                   |
| A6  | `check_user_attempts.js` debug helper lives under `apps/backend/scripts/` (not `src/`); PII-hardened (argv/env, no hardcoded email). Not part of build                                                                                                                          | `apps/backend/scripts/check_user_attempts.js:1-16`                                    | Info — keep or move to `scripts/`; not a leak       |
| A7  | Frontend barrel drift: `ExamsNew`, `ExamDetails` exported from `pages/exams/index.js:3-4` and re-exported `pages/index.js:45-46` but never `lazy()`-imported or routed in `App.jsx` (only `ExamCompare` at `App.jsx:82,256`)                                                    | `frontend/src/pages/exams/ExamsNew.jsx`, `ExamDetails.jsx:32`                         | Low — bundle dead weight                            |
| A8  | `SubjectHierarchyManager.jsx:40` (+ named `SubjectHierarchyView:902`) has no `<Route>` in `admin-panel/src/App.jsx` (grep = 0 route hits; only Payments/Moderation/TwoFactor at `:297-299`)                                                                                     | `admin-panel/.../SubjectHierarchyManager.jsx:40`                                      | Low — unrouted, sidebar-only                        |
| A9  | Legacy migrations `005,007,008,009,010` in `docs/legacy-migrations/` are reference-only, superseded by `src/infrastructure/database/migrations/000-129`                                                                                                                         | `docs/legacy-migrations/005_*.sql` … `010-*.sql`                                      | Info — keep with README guard, do not run           |

### B. Downgraded / no-longer-issues (verify before acting)

| #   | Prior claim                                            | Current truth                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | "Dual admin mounting (legacy + 30 extracted)"          | **Resolved.** `admin.js:23-60` now aggregates modular routers internally; single mount at `app-port5001.js:973`. No double `app.use("/api/admin")`.                                                                                                                           |
| B2  | "Two responseCache implementations"                    | **Resolved.** `responseCache.js:6-9` is a 9-line re-export shim over `responseCache.middleware.js`. Mixed import styles persist (`exams-public.js:7`, `live-tests-public.js:7`, `pyp-public.js:7` use default; ~40 files use named) but single implementation. Cosmetic only. |
| B3  | "Empty learnerIntelligence dir"                        | **No dir on disk.** Glob `src/modules/*` lists no such dir; only stale mentions in `REPO_BRAIN.html:1769,1868,2403`. Doc cleanup only.                                                                                                                                        |
| B4  | "Committed graphify-out artifacts in backend modules"  | **Not found.** Glob `apps/backend/**/graphify-out/**` = 0 hits. Only repo-root `graphify-out/` exists.                                                                                                                                                                        |
| B5  | "ExamCompare sample-data fallback"                     | **Not found.** Grep `getSampleData\|sample` in `pages/exams/` = 0 hits. Already fixed.                                                                                                                                                                                        |
| B6  | Admin barrel "dead VideosManager/MediaLibrary exports" | **Not found.** `features/admin/index.js:1-66` has no such exports. Already cleaned.                                                                                                                                                                                           |

### C. Intentional aliases (not duplication)

- `app-port5001.js:1033-1036` — `/api/live-mock` (liveMock.routes) vs `/api/live-tests` (live-tests-public.js via `mountExtractedRoutes`): distinct routers, explicit no-double-mount comment. OK.
- `app-port5001.js:1039-1040` — `/api/smart-revision` + `/api/revision` share `smartRevisionRoutes`: intentional alias. Low risk.
- `app-port5001.js:993-994` — `/api/blogs` + `/api/blog` share `blogRoutes`: intentional alias.
- `public-routes-index.js:38-39` — `/api/settings` + `/api/site-settings` share handler: intentional.

### D. `validate-routes` coverage gap

`scripts/validate-routes.js:27-73` checks only ~9 hardcoded paths (auth login/2FA, 4 test paths, 3 admin-realtime paths) against `openapi-spec.yaml`. It does **not** cover admin extraction ownership, `mountExtractedRoutes` coverage, `smart-revision`/`revision` alias, `live-mock` vs `live-tests`, or unmounted `test/attempt/question.controller` detection. A stale/missing spec path silently narrows the check. Severity: Low-Medium (guard exists but thin).

## 3. Verification

- Mount inventory: grepped `app\.use\(|mountAdminRoutes|mountExtractedRoutes` across `apps/backend/src` — 100 hits; enumerated canonical mounts `app-port5001.js:651-1047`; confirmed `mountAdminRoutes` has definition-only (1 file) and `mountExtractedRoutes` has 1 import + 1 call.
- Orphan wiring: grepped `test.controller|attempt.controller|question.controller|session.controller|learnerIntelligence` in `src` — only `session.controller` (wired via `session.routes.js:2` + `admin-sessions.js:2` + 1 test) and the self-referential comment in `admin-questions.js:751`. Reverse-grepped `from.*test\.controller` / `from.*attempt\.controller` in their module dirs — 0 hits.
- Cache: read both `responseCache*.js` files — shim confirmed; grepped importers (~50 hits) — all resolve to one implementation.
- Residue: read `src/config/upload.js`; grepped `config/upload` importers — 0 hits. Globbed `src/modules/*` — no `learnerIntelligence`, no `graphify-out`. Globbed `docs/legacy-migrations/*` — 14 files incl. 005–010. Read `backend/scripts/check_user_attempts.js:1-30` — PII-safe.
- Frontend/admin: grepped `ExamsNew|ExamDetails` (barrel-only, no `App.jsx` route), `SubjectHierarchyManager` (component-only, no admin route), `ExamCompare` sample fallback (0 hits). Read admin barrel `index.js:1-66`.
- Graph correlation: `GRAPH_REPORT.md` god nodes (`dbHelpers 138`, `pool 113`, `protect() 101`, `admin() 71`) align with the composition-root + guard-stack centrality claimed above; relevant communities: API Routes & Auth, Test Routes & Attempts, Sessions & Bookmarks, Admin Analytics Routes.

## 4. Blockers

None. Read-only contract observed: no git writes, no code writes, no `.env` values accessed.

## 1. Files Inspected

**Middleware (territory):**

- `apps/backend/src/middleware/responseCache.middleware.js:36-190` — `responseCache()` dual-signature (object-form + positional `(namespace, ttl, options)`); both default `userScoped=true`, key = `{ns}:{u:id|anon|global}:{originalUrl}`; in-flight `Map` barrier; only caches `statusCode<400 && body.success!==false`; `swrCache()` at :201-275.
- `apps/backend/src/middleware/responseCache.js:1-9` — now just re-exports `responseCache` (two-impl duplication **resolved**; god-node `responseCache` 39-edge concern closed).
- `apps/backend/src/middleware/requestDedup.js:29-63` — GET-only, key = `METHOD:originalUrl:sha256(authHeader||cookie)[0:16]`; `anon` bucket for public; 10k cap, 30s TTL, 503/504 guards. Correctly does **not** collapse across identities.
- `apps/backend/src/middleware/queryCache.js:34-80` — opt-in `cachedQuery()` only, SELECT-only, blocklists `users/auth/sessions/password/tokens/csrf/otp/phone_auth/api_keys`; `invalidateCache()` uses `SCAN` not `KEYS` (:90-107).
- `apps/backend/src/middleware/cacheControl.js:1-43` — `no-store` for `/api/users|/me|/sessions|/auth`, `max-age=300` for static-prefix list, `immutable 1y` for `/assets|/uploads`. Note: does **not** list `/api/bookmarks`, `/api/practice`, `/api/tests/*/result`.
- `apps/backend/src/middleware/monitoring.js:183-187` — `>1000ms` → `[SLOW REQUEST]` warn; all six watchlist signals except settings would fire this.
- `apps/backend/src/middleware/compression.js:7-10` — level 6, threshold 1024; client `x-no-compression` override removed (good).

**Routes:**

- `apps/backend/src/api/routes/practice.js` — `POST /sessions` :1128-1254; `pickPracticeQuestionIds()` :175-356 (`ORDER BY RANDOM()` :341-351); `resolvePracticeFilters()` :69-170 (up to 4 slug lookups); `GET /sessions/:id/questions/:idx` :1448-1481; `GET /practice/bookmarks` :1793-1837 (`SELECT q.*` :1801); `GET /questions/:id/similar` :2828-2856 (`ORDER BY RANDOM()` :2842); dashboard :2001-2137 (cached 60s, 7-way `Promise.all` — good).
- `apps/backend/src/api/routes/bookmarks.js` — `GET /` :238-293 (`includeDetails !== "false"` default true :246; fast-path :260-268; `batchResolveBookmarkEntities` :96-208 with `SELECT *` at :154, :170, :186); duplicate-check full-scan + JS `.find` at :331-336, :464-470, :510-516; **no `responseCache` on list/count/check**.
- `apps/backend/src/api/routes/settings.js:52-53` — `responseCache('public-settings',120)` + `responseCache('site-settings',120)` positional form.
- `apps/backend/src/modules/tests/test.routes.js:1593-1596,1727-1730` — `responseCache("test-result-attempt",300)` and `responseCache("test-result",300)` positional (default `userScoped=true`); latest-result handler :1759-1762 parallel `results`+`attempts` lookup with canonical-ID fast path (:1745-1758).
- `apps/backend/src/app-port5001.js:708-750` (`/uploads` auth guard + `/assets/avatar` static → SVG placeholder fallback :741-749), `:768` (`/uploads` imageOptimization after static — dead position), `:1124-1125` (`server.setTimeout(30000)`, `headersTimeout=31000`).
- `apps/backend/src/modules/auth/auth.routes.js:44-51` — `availableProfileAsset()` nulls missing local avatar files instead of advertising a guaranteed-404 path.
- `apps/backend/src/modules/users/user.routes.js:141-168,258` — avatar delete guards `/assets/avatar/` prefix; new uploads return `/assets/avatar/<file>`.

**Frontend call-sites:**

- `apps/frontend/src/shared/lib/practiceAPI.js:3-8` (`getSessionId` throws on `undefined/null/""`), `:10-25` (`normalizeSession` accepts `id|sessionId|session_id`), `:40-46` (`startSession` throws if response has no ID).
- `apps/frontend/src/shared/lib/bookmarksAPI.js:4-11` — forwards `includeDetails` param.
- `apps/frontend/src/pages/tests/TestInterface.jsx:436-439` — `getAll(1,100,{includeDetails:false})` (lightweight path correctly used here).
- `apps/frontend/src/pages/dashboard/Bookmarks.jsx:642` — copy only, no fetch logic inspected (out of narrow territory but no `includeDetails=false` usage found there via grep).

## 2. Issues (per-signal)

### S1 — `POST /api/practice/sessions` 200 in 5190ms — HIGH

- **Root cause (compound, all in `practice.js`):** (a) `resolvePracticeFilters()` runs **twice** per start — once inside `pickPracticeQuestionIds()` (:187) and again at :1175-1180 for the INSERT — up to 8 slug-lookup queries before any work. (b) `pickPracticeQuestionIds` main query (:346-353) is `SELECT q.id … ORDER BY RANDOM() LIMIT $n` with non-sargable filters: chapter clause `OR q.topic_id IN (SELECT…)` (:244-249) and subject clause with 3-way `OR` + 2 correlated subselects (:251-263); `RANDOM()` forces full seq-scan + sort of every matching row. (c) `weak_topic` mode adds an extra aggregate over all user `practice_answers` (:306-320) in series. (d) After INSERT, `getSafeQuestions()` (:1237) hydrates **full** question bodies (options/explanations/Hindi/tests JOIN) in the same request — payload + query cost counted in the 5.2s. (e) Hygiene `UPDATE`s (:1193-1210) run serially before INSERT. (f) `requestDedup` is GET-only — concurrent POST starts each run the full RANDOM scan → pool pressure; 5.2s is ~17% of the 30s `server.setTimeout` (app-port5001.js:1124), so p95 under load risks socket-timeout instead of JSON error.
- **File:line:** `api/routes/practice.js:187` + `:1175` (double resolve); `:244-263`, `:341-351` (RANDOM scan); `:1128-1254` (no cache/POST-dedup).
- **Recommended fix:** single `resolvePracticeFilters` call, pass through; replace `ORDER BY RANDOM()` with `TABLESAMPLE BERNOULLI` or precomputed `random_sort_key` column + `WHERE random_sort_key > rand() ORDER BY random_sort_key LIMIT n`; add covering indexes `questions(topic_id, is_active, is_deleted)`, `questions(chapter_id, …)`, `questions(subject_id, …)`, `practice_answers(user_id, topic_id)` / `(user_id, is_correct)`; return IDs on POST and hydrate questions via cached `GET /sessions/:id` (or cap `targetCount` default 20, already capped at 200); add POST idempotency key or short user-scoped lock — do **not** extend the 30s timeout to mask it.
- **Body-shape note:** 200 is not proof — response must contain `data.id && data.sessionId && Array(data.questions)` (`practiceAPI.startSession` :42-45 now enforces this; older client did not).

### S2 — `GET /api/practice/sessions/undefined/questions/0` 500 — MEDIUM (now guarded, verify deploy)

- **Root cause:** old frontend interpolated an uninitialized session id into the URL (`"…/sessions/undefined/…"`). Current `practiceAPI.js:3-8` **throws client-side** before fetch, and `practice.js:1291-1296` (`parsePositiveInt`) + `:1452-1456` (idx check) return **400** (`Invalid practice session ID`), while `toNullableInt` (:434-446) explicitly maps `"undefined"/"null"/""` → null. So the 500 signature matches a **pre-guard build** (or a direct curl); current tree should emit 400, and `startSession` (:43-44) throws `Practice session response did not include an ID` instead of storing `undefined`.
- **File:line:** `frontend/src/shared/lib/practiceAPI.js:3-8,43-44`; `backend/src/api/routes/practice.js:429-446,1291-1296,1448-1457`.
- **Recommended fix:** none in code — confirm deployed frontend ≥ this guard; add backend regression test asserting `GET /sessions/undefined/questions/0 → 400` (not 500) and a client test that `getSession(undefined)` throws before network.
- **Body-shape note:** any 200 with `{id: undefined}` must be treated as failure — `normalizeSession` (:10-25) only backfills when id is non-null.

### S3 — `GET /api/bookmarks?page=1&limit=100` 200 in 5298ms — HIGH

- **Root cause:** default `includeDetails=true` (bookmarks.js:246) with `limit=100` runs full enrichment: `batchResolveBookmarkEntities` fans out to up to 4 batched queries but each is **`SELECT *`** (`tests` :154, `study_materials` :170, `subject_videos` :186 — heavy JSONB/options/explanation columns × 100 rows) plus a wide `questions` column list (:125-129). No `responseCache` on `GET /`, `/count`, or `/check`. `dbHelpers.find("bookmarks",…)` has no explicit `ORDER BY` (pagination instability) and duplicate-check paths (`POST /` :331-336, `/check` :464-470, `/toggle` :510-516) load **all** user bookmarks then JS-`.find` — O(n) per toggle. `limit=100` is the max allowed (:241-244) so the worst case is the observed case.
- **File:line:** `api/routes/bookmarks.js:238-293` (no cache), `:246` (default), `:154/:170/:186` (`SELECT *`), `:331-336/:464-470/:510-516` (full-scan duplicate check).
- **Recommended fix:** (1) default `limit` 20 already; make `Bookmarks.jsx` dashboard page pass `includeDetails=false` for the list paint and lazy-load details (TestInterface.jsx:439 already does). (2) Add `responseCache("bookmarks-list",30)` user-scoped (default true — correct here) + invalidate on POST/PUT/DELETE. (3) Replace `SELECT *` with explicit column lists. (4) Indexes: `bookmarks(user_id, is_active)`, `bookmarks(user_id, item_type, is_active)`, `question_bookmarks(user_id)`, `questions(id) WHERE is_deleted=false` (if absent — verify via `run-database-audit.js`, forbidden to DDL here). (5) Rewrite duplicate-check as `SELECT 1 … WHERE user_id AND item_type AND item_id LIMIT 1` instead of fetch-all + JS match.
- **Cache-key note:** user-scoping is **required** here (per-user bookmarks) — global cache would leak; current absence of cache is the perf bug, not a scoping bug.

### S4 — `GET /assets/avatar/avatar_1_*.webp` 404 — LOW (mitigated in tree)

- **Root cause:** profile referenced a local `/assets/avatar/` file absent on this deployment (ephemeral `uploads/avatars/` or storage-provider mismatch local-vs-S3/Supabase). Current tree already mitigates twice: `auth.routes.js:44-51` suppresses advertising missing local files (returns `null`), and `app-port5001.js:741-749` serves a deterministic **200 SVG placeholder** instead of a 404 for any unmatched `/assets/avatar/*`. So a 404 implies the log predates this fallback or came from a CDN edge caching the old 404 (`immutable max-age=30d` at :735-737 makes stale 404s sticky).
- **File:line:** `app-port5001.js:726-750`; `modules/auth/auth.routes.js:44-51`; `modules/users/user.routes.js:167-168,258`.
- **Recommended fix:** purge CDN/edge cache for `/assets/avatar/*` after deploy; verify `STORAGE_PROVIDER` + `uploads/avatars` volume mount; add client `onError` avatar fallback (outside this territory's backend scope). No server change needed. Also note `app.use("/uploads", imageOptimization)` at :768 is registered **after** the `/uploads` static handler (:708-723) so it never runs for static hits — move before static if optimization is desired (separate issue, not the 404).

### S5 — `GET /api/tests/…/result` 200 in 1555ms — LOW (healthy, watch)

- **Root cause:** none — 1.5s is expected for this handler: `findTestByIdentifier` + `fetchAttemptSnapshotQuestions`/`fetchTestQuestions` + parallel `getRankAndPercentile` + `fetchTestCommunityQuestionStats` (`test.routes.js:1666-1676`) + series lookup (:1685-1693). `responseCache("test-result[-attempt]",300)` is user-scoped by default (positional form defaults `userScoped=true` — correct, prevents cross-user result leakage) and key includes full `originalUrl` so per-attempt entries are isolated.
- **File:line:** `modules/tests/test.routes.js:1593-1645,1666-1693,1727-1762`.
- **Recommended fix:** keep 300s TTL; optional: shorten to 60-120s if live-rank staleness complaints arise (cached rank can lag the live leaderboard by 5 min); confirm `attempts(user_id, test_id, is_completed)` and `results(user_id, test_id)` indexes exist. No action unless p95 grows.

### S6 — `GET /api/settings/public` 304 in 1ms — HEALTHY (with efficiency note)

- **Root cause:** none — 304 is ETag conditional-cache behavior, 1ms is optimal.
- **File:line:** `api/routes/settings.js:52-53`; handler sets `Cache-Control: public, max-age=30, s-maxage=60` (:10).
- **Efficiency note (not a bug):** both mounts use positional `responseCache(ns,120)` with no options → `userScoped` defaults **true** (`responseCache.middleware.js:121`), so identical public settings are cached **per user** (`u:<id>` + `anon` buckets) instead of once globally. Recommend `responseCache("public-settings",120,{userScoped:false})` (same pattern already used correctly by `practice-tree` at `practice.js:580` and `tests-series-v2` at `test.routes.js:164`) and likewise for `site-settings`. Also `settings.js` has a silent catch-all fallback (:22-44) returning 200 synthetic settings — a DB outage is indistinguishable from success; consider logging + `X-Settings-Fallback: 1` header.
- **Severity:** informational.

### Cross-cutting cache-key audit (requested)

- `responseCache` both signatures default `userScoped=true` — safe for user data (results, dashboard, mistakes, bookmarks if added). Only genuinely public endpoints should opt `userScoped:false` (`practice-tree`, `tests-series-v2` do; `settings public/site-settings` do not — fix above).
- `requestDedup` fingerprint (`sha256(authHeader||cookie)`) correctly prevents cross-user response sharing; anonymous shared bucket is safe for public data.
- `queryCache` blocklist covers auth/session/OTP keys — do not add `cachedQuery` to practice-session or bookmark-mutation paths.

## 3. Verification

- Read-only inspection only (per contract): no commands run, no code written, no migrations touched.
- `ORDER BY RANDOM()` confirmed at `practice.js:343-344,349` and `practice.js:2842`; `SELECT *` confirmed at `bookmarks.js:154,170,186` and `SELECT q.*` at `practice.js:1801`; double `resolvePracticeFilters` confirmed at `practice.js:187` + `:1175`; 30s timeout confirmed at `app-port5001.js:1124-1125`; avatar placeholder-fallback confirmed at `:741-749`; result 300s user-scoped cache confirmed at `test.routes.js:1596,1730` + middleware default `:121`; settings per-user cache inefficiency confirmed at `settings.js:52-53` + middleware `:121`; frontend `undefined` guard confirmed at `practiceAPI.js:3-8,43-44`.
- Not verified (needs owner with DB access): actual index presence (`run-database-audit.js` + `pg_stat_statements`/`EXPLAIN ANALYZE` on the practice RANDOM query and bookmarks enrichment), Redis hit rates (`X-Cache`/`X-Dedup` headers), and whether the 404 log predates the avatar-fallback deploy (compare log timestamp vs deploy of `app-port5001.js:741`).

## 4. Blockers

- None for research. Forbidden paths respected: no reads in `apps/admin-panel`, `packages`, migrations DDL, or git history; no writes performed.

12-agent read-only sweep complete. Exclusive territories, no writes, graph-first per `MULTI_AGENT_DEPLOYMENT_RULE.md`.

# Critical

- `middleware/auth.middleware.js:954-968` — `secondTier` == `admin`. Any admin passes second-tier gates (roles, backups, audit delete).
- `modules/auth/auth.controller.js:1558` + `:1465` — password change/reset don't revoke other sessions. Stolen refresh survives rotation.
- `api/routes/phoneAuth.js:334-339` — phone JWT 30d signed with `JWT_2FA_SECRET`, accepted as full auth by `protect()` (`auth.middleware.js:482-490`). No type isolation.
- `middleware/csrf.middleware.js:405-431` — all 2FA mutations CSRF-exempt. 2FA can be armed/disarmed cross-site.
- `infrastructure/queue/outboxPoller.js:16-26` — `SELECT FOR UPDATE SKIP LOCKED` outside txn = no lock. Dual backends double-process. Plus emit-before-mark `:44-52` with no txn.
- `api/routes/payments.js:471-485` vs `:867-884` — webhook has advisory lock, `/verify` has none. Concurrent verifies grant Pro twice + double-count coupons.
- History still dirty: `.env` in 2 commits (`DATABASE_URL`, `JWT_*`, Razorpay), `M3 Key.txt`, 528 `test_attempts` rows / 196 users. Rotation + `filter-repo` OPEN per `docs/REMEDIATION_PLAN.md` Phase 0/2.1. DPDP notice partial.

# High

- Auth: `lockout.middleware.js:200-202` skips lockout for authed admins on 2FA routes; `auth.controller.js:2022` + `lockout.middleware.js:58` — 2FA brute-force uncounted (null email); `phoneAuth.js:375` `link-phone` no CSRF/rate-limit/unbounded guesses; `phoneAuth.js:224-233` unverified email insert + token in JSON body.
- Test/Practice: `modules/tests/test.routes.js:754-764` start scans all user attempts (N+1); `api/routes/practice.js:187+1175` double filter resolve + `ORDER BY RANDOM() :341-351` = 5.1s; `practice.js:1450-1471` null `questions_json` → 500 not 400; `bookmarks.js:246` defaults `includeDetails=true` + `SELECT * :154,170,186`, no `ORDER BY`, no cache = 5.2s; `test.routes.js:1122` `timeSpent` undefined → `NaN` persisted.
- DB drift: `revision_queue.priority` VARCHAR (`018:116`) vs live INTEGER — no `ALTER TYPE`, `138:101-104` no-op on existing DBs. `140:16,26` attaches trigger without `pg_proc` guard. `129:6-47` unguarded cascades contradict soft-delete. `104` regresses `088` (no `search_path`, drops phone→mobile mirror). RLS: `000a:61,66` anon bypass never dropped; `099` uses `auth.uid()` never set by app; `user_recommendations`, `webhook_events`, `practice_ai_cache` no RLS.
- AI: `modules/ai/aiClient.js:54-59` sends `Bearer undefined` if keys absent, no retry/timeout, `choices[0]` unchecked; `admin-catalog.js:625-680` template fallback inserts fake questions as real rows; RAG `rag.service.js:60-88` FTS-only, no vectors, English stemmer kills Hindi; `practice_ai_cache` zero call sites (only `base.repository.js:89` allow-list); `AICache` frozen `global.redis` at import (`aiMentor.service.js:37`) = silently disabled; hourly limiter bypassed by `daily-tip`, node-engine, search, embeddings; fail-open on Redis outage; `AiGenerationLog.js:3-8` stale pricing.
- Infra: `queueManager.js:67-75` drops jobs silently when Redis down; EVENTS queue unconsumed if worker not deployed; `queueManager.js:190,233` shares live Redis connection; subscription sweeper `app-port5001.js:1220` no distributed lock + never cleared; WS `websocketManager.js:293-333` any authed socket joins any test room; `gracefulShutdown :1249-1279` never closes WS/broker/`server.close()`; cross-instance bus gap (`setupEventBusListeners :464` listens in-process only); `responseCache.middleware.js:100-116` barrier leaks on `res.send`; S3 fail-open to ephemeral local (`storageProvider.js:300-325`) = avatar 404 source.
- Admin frontend: `ProtectedRoute.jsx:88-89` fail-open — `admin` + empty perms → `isSuper=true`; `rbac.js:58` unknown segments → `content`, any `content:read` views all unmapped sections.

# Medium / Low

- Frontend: `Bookmarks.jsx:63,126,150` omits `includeDetails=false` (TestInterface `:436` correct); avatar 404 no `onError` fallback (`types/index.js:148`, `assets-config.js:310`); `useProPass.js:12` coupling (fixed via DI, silent Free on missing init); `ExamDetails.jsx:1-773` orphan, `ExamsNew.jsx:1` benign alias; ExamCompare/ExamYear sample fallbacks already fixed.
- Shared lib: 3 apiClients — admin `admin-panel/.../apiClient.js:107-322` forked, baseURL `/api` vs origin, CSRF capture + waiter replay diverge; `shared-hooks/apiClientConfig.js:15-34` raw `fetch localhost:5001` no cookies/CSRF; `aiStreaming.js:57` no refresh; `sendBeacon` no CSRF; 403→AuthError, 429 untyped; `useGenericCRUD:65` returns `[]`/`false` swallowing errors; loggers (`shared-config/logger.js:52`, admin `logger.js:16`) console-only, no pino/redaction; `enrollment.js` FE fork diverges on extras; `dashboardCache.js:1-27` single-slot 5m stale entitlements.
- Dead code: `test.controller.js:18`, `attempt.controller.js:8`, `question.controller.js:20` unmounted routers; `admin-routes-index.js:11` dead wrapper; `config/upload.js:4` zero importers; `SubjectHierarchyManager.jsx:40` unrouted; `TopicsManager` redirect to missing tab; barrel `features/admin/index.js` missing Payments/Moderation/2FA/Live exports; `validationSchemas.js:82-97` vacuous refine; responseCache dup + learnerIntelligence + graphify artifacts already resolved.
- CI/Docker/tests: pins OK, Node 22 consistent (old Node 18/20 claims stale); `validate-routes.js:28-73` only 9 checks, never run in CI; `sync-repo-brain --check` never wired; `run-database-audit.js:86,278` stale numbers, warn-only; k6 `realtime.js:38` dead auth, `api.js` stale endpoints, `BASE_URL :3000` wrong, never run in CI; `docker-compose.scale.yml` stale (dev cmd, single net, no Loki); backend Dockerfile Node 20 vs 22; pre-commit prettier-only, `no-env.yml:39` excludes `*.json/*.sql/*.md` where leaks live; `*.cjs` ignored yet tracked.
- Perf: practice/bookmarks root-caused above; test-result 1.5s healthy (300s user-scoped cache correct); settings 304 healthy but per-user cache should be `userScoped:false`; avatar 404 already mitigated by SVG placeholder `app-port5001.js:741-749` — purge CDN.
- PII hygiene: fixtures clean, `sanitizeError.js:1-17` fail-closed, `audit_logs` canonical, no live hardcoded secrets. Gaps: logger misses `phone/email/otp/aadhaar`, `user_email` in 6 admin lists by design, `.gitignore` over-broad `*.cjs/*.txt`, JWT 10 sites no `algorithms`.

Follow-ups: verify `swrCache("auth-me")` keying, live `information_schema` for drift, `EXPLAIN ANALYZE` practice RANDOM query, Razorpay concurrent-verify replay, worker deployment, prod `PGCRYPTO_KEY` name + backfill before dropping plaintext.
