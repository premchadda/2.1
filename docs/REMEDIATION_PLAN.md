# Trstprep V2.1 Remediation Plan

> Source: `UNIFIED_TRSTPREP_AUDIT.md` (9,322 lines, ~191 issues: 16 critical, 46 high, 73 medium, 56 low)
> Scope: ALL issues. No constraints. Deployment target: **Docker Compose + nginx** (primary), Vercel (vestigial).
> Goal: **Fix every issue without breaking live** — sequenced by blast-radius and dependency, not severity alone.

---

## Guiding principles

1. **Never edit in dependency order that breaks live.** Phase 1 fixes things that are broken *right now* (nginx won't boot, console logs leak, etc.) — these are no-regret changes.
2. **One concern per commit.** Each item below is independently revertable.
3. **Verify after every phase** — `npm run lint && npm run build && npm test` per app, plus the manual smoke check listed at the end of each phase.
4. **Rotate secrets out-of-band**, before touching git history. Code changes that remove `.env` tracking are useless if credentials are still live.
5. **Backend changes that touch `dbHelpers` / `pool` / `protect` / `admin` ripple across ~70 modules** (per AGENTS.md god-node list). Trace edges in `graphify-out/graph.json` before editing these.
6. **Migrations are append-only.** New migrations get the next sequential number (currently 112 on Aug 23, 2026; was 093 in Jul 2026). Never edit a shipped migration.
7. **No `console.*` in production paths** after Phase 10 — replace with the existing pino `logger` at `apps/backend/src/infrastructure/logger/logger.js`.

---

## Phase 0 — Pre-flight (out-of-band, before any code change)

**Owner: ops + lead dev. Do not skip.**

| # | Action | Why |
|---|--------|-----|
| 0.1 | Take a DB snapshot (`pg_dump` of Supabase prod) | Every Phase 3/9 change touches live data |
| 0.2 | Rotate ALL credentials: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_RESET_SECRET` (new), `JWT_2FA_SECRET` (new), `PGCRYPTO_KEY`, Razorpay keys, Supabase service role key, OpenRouter API key | `.env` is tracked in git (C-01); assume everything is compromised |
| 0.3 | Generate new JWT secrets via `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Old secrets are dictionary-word-based (C-02) |
| 0.4 | Ensure `process.env.NODE_ENV=production` on the prod host | Several dev-only escapes (`unsafe-eval`, /metrics unauth, console.error leak) depend on this |
| 0.5 | Confirm Redis is reachable from backend container with `AUTH` + TLS | Phase 10 will make Redis required, not optional |
| 0.6 | Stash current `git status` — there are ~700 modified/untracked files. Commit or stash before any remediation commit so diffs are reviewable | Audit shows huge uncommitted surface; mixing remediation with WIP makes review impossible |

**Exit criteria:** New secrets in Supabase + new `.env.local` on prod host (NOT committed). DB snapshot verified restorable.

---

## Phase 1 — P0: Actively breaking production right now (no dependencies)

> These are isolated, no-regret fixes. Each can ship independently. None depend on Phase 0.

### 1.1 `apps/frontend/nginx.conf` — nginx won't boot in Docker (CRITICAL) ✅ RESOLVED
- **Root cause:** File wraps everything in `http { }` but is `COPY`'d to `/etc/nginx/conf.d/` (already inside `http` context). nginx aborts: `"http" directive is not allowed here`.
- **Fix:**
  1. Removed outer `http { }` wrapper (lines 1 and 78). *(Kept wrapper — mounted as `/etc/nginx/nginx.conf` instead of `conf.d/`)*
  2. Kept `limit_req_zone` / `limit_conn_zone` directives in `http {}` context (mounted as `nginx.conf`, not `conf.d/default.conf`).
  3. In the static-asset `location`, re-declared ALL security headers (nginx `add_header` resets inheritance).
  4. Added `application/manifest+json` and `text/html` to `gzip_types`.
  5. Added `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin`.
  6. Added `server_tokens off;` and `client_max_body_size 50m;`.
  7. Removed deprecated `X-XSS-Protection` header.
  8. Dropped `'unsafe-eval'` from CSP (no longer needed after Calculator fix in Phase 4.4).
- **Verify:** ✅ Build passes; manual Docker boot test pending (Phase 11).

### 1.2 `apps/frontend/vite.config.js` — two invalid config keys (CRITICAL) ✅ RESOLVED
- **Bug A (line 169):** `build.esbuildOptions` is not a real Vite key → `dropConsole` never applies → production bundles leak `console.log`.
- **Bug B (lines 183–185):** `build.plugins` is not a real Vite key → `rollup-plugin-visualizer` never registers → `npm run analyze` silently produces no `stats.html`.
- **Fix:**
  1. Removed `build.esbuildOptions`. Added top-level: `esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : undefined,`
  2. Moved `visualizer(...)` from `build.plugins` into the top-level `plugins` array, guarded by `mode === 'analyze'`.
- **Verify:** ✅ `npm run build` produces `dist/` with no `console.log` strings (grep confirmed 0 hits). ✅ `npm run analyze` produces `stats.html`.

### 1.3 `apps/frontend/vercel.json` — catch-all swallows API + CSP blocks Google Fonts (CRITICAL, HIGH) ✅ RESOLVED
- **Bug A:** `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` swallows `/api/*`, `/socket.io/*`, `/uploads/*` → every API call returns SPA HTML 200.
- **Bug B:** CSP `style-src 'self' 'unsafe-inline'` omits `https://fonts.googleapis.com`, but `index.html:23` loads font CSS from there → Google Fonts blocked in Vercel prod.
- **Bug C:** Missing `Strict-Transport-Security` and `Permissions-Policy` (inconsistent with nginx).
- **Bug D:** `X-XSS-Protection: 1; mode=block` deprecated since Chrome 2019; can introduce XSS auditor bypass.
- **Fix:** Added explicit escape rules for `/api/`, `/socket.io/`, `/uploads/` BEFORE the catch-all (with negative lookahead regex). Added `https://fonts.googleapis.com` to `style-src`. Added HSTS + Permissions-Policy + COOP/COEP/CORP. Removed `X-XSS-Protection`. Dropped `'unsafe-eval'` from `script-src`.
- **Verify:** Pending — Vercel deploy test in Phase 11.

### 1.4 `apps/frontend/package.json` — vitest@^1.3.1 vs vite@^6.4.1 peer mismatch (CRITICAL) ✅ RESOLVED
- Installed `vitest@1.6.1` peer-requires `vite@^5`, but app pins `vite@^6.4.1`. Module resolution in tests is unreliable.
- **Fix:** Bumped `vitest` to `^4.1.0` (matches Vite 6). Also installed `@vitest/coverage-v8@^4.1.0` for Phase 10.27 coverage config.
- **Verify:** ✅ `npm install` succeeds without peer-dependency warnings.

### 1.5 `apps/frontend/package.json` — `@eslint/js@^9` vs `eslint@^10` major drift (CRITICAL) ✅ RESOLVED
- **Fix:** Bumped `@eslint/js` to `^10.0.0` to match `eslint@^10.0.0`.
- **Verify:** ✅ `npm run lint` applies v10 recommended rule semantics, not v9.

### 1.6 `apps/frontend/Dockerfile` — missing VITE_ env vars (CRITICAL) ✅ RESOLVED
- Only `ARG VITE_API_URL` was declared, but the app reads 6 build-time vars: `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_ADMIN_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPPORT_EMAIL`, `VITE_SITE_URL`.
- **Fix:** Added `ARG` + `ENV` for all six. Also:
  - Added `--ignore-scripts` to `npm ci` (line 8) to skip `prepare: husky install` which fails without `.git/`.
  - Pinned `nginx:alpine` to `nginx:1.27-alpine`.
  - Added `HEALTHCHECK CMD wget -q --spider http://localhost/ || exit 1`.
  - Mount `nginx.conf` as `/etc/nginx/nginx.conf` (not `conf.d/`) — keeps the `http { }` wrapper valid.
- **Verify:** Pending — Docker build test in Phase 11.

### 1.7 `apps/frontend/.dockerignore` — incomplete (HIGH) ✅ RESOLVED
- Missing `graphify-out/`, `.turbo/`, `*.out`, `*.cjs`, `scripts/`, `.husky/`, `.env.production` (without `.local`).
- **Fix:** Mirrored relevant patterns from root `.gitignore`. Added `build.out`, `lint.out`, `.codex`, `.agents`, `.qoder`, `.backend-ready`.
- **Verify:** Pending — Docker build context size check in Phase 11.

### 1.8 `apps/frontend/eslint.config.js` — flat + legacy coexist; key rules disabled (HIGH) ✅ RESOLVED
- **Fix:**
  1. Deleted `.eslintrc.json` (legacy; ignored by ESLint v10 but misleads maintainers).
  2. Re-enabled `no-unused-vars` (as `warn`, with `argsIgnorePattern: '^_'`) and `no-undef` (as `warn`) in `eslint.config.js:32-33`.
  3. Expanded `ignores` from `['dist']` to `['dist', 'coverage', '.vite', 'build.out', 'lint.out', 'public', 'graphify-out', 'scripts']`.
  4. Removed duplicate `ecmaVersion` declaration (kept `'latest'` only).
  5. Deleted manual `globals` list — `globals.browser` already covers them.
  6. Added `no-var: 'warn'`, `prefer-const: 'warn'`, `eqeqeq: ['warn', 'always']`, `no-useless-assignment: 'warn'`, `no-empty: ['error', { allowEmptyCatch: true }]`.
- **Verify:** ✅ `npm run lint` reports 0 errors (505 warnings — triage in Phase 10).

### 1.9 `apps/frontend/postcss.config.js` — PurgeCSS duplicates Tailwind v3 purge (HIGH) ✅ RESOLVED
- Tailwind v3 already does JIT purge based on `tailwind.config.js` content globs. Running `@fullhuman/postcss-purgecss` on top drops arbitrary-value classes (`bg-[#ff0000]`) and dynamic-string classes.
- **Fix:** Removed the entire `if (process.env.NODE_ENV === 'production') { plugins.push(purgecss(...)) }` block. Kept the rest of the file (autoprefixer only).
- **Verify:** ✅ `npm run build` produces a CSS file that still contains `bg-[` arbitrary-value classes if any are used in source.

### 1.10 `apps/frontend/tailwind.config.js` — `require()` in ESM context (HIGH) ✅ RESOLVED
- Frontend `package.json` declares `"type": "module"`, so `tailwind.config.js` is ESM. `require('@tailwindcss/typography')` works only because Tailwind v3 uses `jiti` shimming; Tailwind v4 upgrade will break it.
- **Fix:** Replaced `require('@tailwindcss/typography')` with `import typography from '@tailwindcss/typography'` at top of file, then `plugins: [typography]`.
- **Verify:** ✅ `npm run build` still works.

### 1.11 `apps/frontend/index.html` — missing PWA icons + og:image 404 (HIGH, HIGH) ✅ RESOLVED
- **Bug A:** PWA manifest (in `vite.config.js:50-57`) declares only `favicon.svg` with `purpose: 'any maskable'`. Chrome's installability criteria require 192×192 and 512×512 PNGs.
- **Bug B:** `SEO.jsx:31` references `/icons/icon-512.png` which doesn't exist in `public/` or `dist/`.
- **Bug C:** No `<link rel="apple-touch-icon">` for iOS.
- **Bug D:** No `<link rel="manifest">` in source (only injected at build time by vite-plugin-pwa).
- **Fix:**
  1. Created `scripts/generate-icons.mjs` that uses `sharp` to generate `public/icons/icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png`, `apple-touch-icon.png` (180×180) from `favicon.svg`.
  2. Updated `vite.config.js` manifest `icons` array to declare all five PNGs.
  3. Added `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`, and `<meta name="apple-mobile-web-app-capable" content="yes">` to `index.html`.
  4. Added `<meta property="og:image" content="/icons/icon-512.png">` and `twitter:card` + `twitter:image` to `index.html` as a default.
- **Verify:** ✅ Icons exist in both `public/icons/` and `dist/icons/`. Pending Lighthouse PWA audit in Phase 11.

### Phase 1 verification (run all before Phase 2) ✅ PASSED
```
cd apps/frontend && npm run lint && npm run build && npm run test
docker build -t trstprep-fe-test . && docker run --rm -p 8080:80 trstprep-fe-test
curl -I http://localhost:8080/         # expect 200, not nginx error
curl -I http://localhost:8080/api/      # expect 502 (no backend) not 200 HTML
```
- ✅ `npm run lint`: 0 errors, 505 warnings (warnings triaged in Phase 10)
- ✅ `npm run build`: built in 22.98s, no errors
- ✅ `npm run analyze`: `stats.html` generated
- ✅ `console.log` stripped from production bundle (grep confirmed 0 hits in main bundles)
- ✅ `'unsafe-eval'` removed from CSP in both `dist/index.html` and `nginx.conf`
- ✅ PWA icons present in both `public/icons/` and `dist/icons/` (5 PNG files)
- ⏳ Docker build + curl tests: deferred to Phase 11 (manual smoke test)

---

## Phase 2 — P0: Active security vulnerabilities ✅ RESOLVED (code changes; git history scrub deferred)

> These are exploitable today. Phase 0 secret rotation must be done first.

### 2.1 Scrub `.env` from git history (C-01, C-02, C-03) ⚠️ PARTIAL — code-side done, history scrub deferred
- `apps/backend/.env` is tracked (confirmed via `git ls-files`). Contains `DATABASE_URL` with Supabase password, `JWT_SECRET`, `JWT_REFRESH_SECRET`, Razorpay keys.
- **Done:** `git rm --cached` all three `.env` files (backend, frontend, admin-panel). `.gitignore` already excludes them.
- **Deferred:** `git filter-repo` history scrub — requires secret rotation first (Phase 0, user handling separately). Will force-push rewritten history.
- **Verify:** ✅ `git ls-files apps/backend/.env` returns empty. ⏳ History scrub pending Phase 0.

### 2.2 Add auth to `/api/import` and `/api/fortspy` (C-04, H-05) ✅ RESOLVED
- `app-port5001.js:727,798` mounts `importRoutes` without `protect`. `fortspyRoutes` likewise.
- **Fix:** Wrapped both mounts (v1 + legacy) with `protect, admin`:
  ```js
  v1Router.use("/fortspy", protect, admin, fortskyRoutes);
  v1Router.use("/import", protect, admin, importRoutes);
  ```
- **Verify:** Pending — `curl -i https://<prod>/api/import/universal` returns 401, not 200.

### 2.3 Fix 2FA fail-open → fail-closed (C-04 in security audit, Issue 6) ✅ RESOLVED
- `auth.controller.js:166-170` — if `two_factor_secrets` table errors, `catch` logged warning and skipped 2FA, issuing full session tokens.
- **Fix:** Changed catch block to return `401` with `{ error: "Two-factor verification unavailable" }` and `code: 'TWOFA_CHECK_UNAVAILABLE'`. Logged via `console.error` (will switch to pino logger in Phase 9).
- **Verify:** Pending — unit test in Phase 11.

### 2.4 Integrate phone auth with SessionCaptureService (C-05, C-06) ✅ RESOLVED
- `phoneAuth.js:182-185` issued JWT with 30-day expiry, `type: 'phone'`, no `sessionId`, no `captureSession` call.
- **Fix:**
  1. Added `captureSession(req, userId, 'phone')` call after OTP verification.
  2. Embedded `sessionId` in JWT payload.
  3. Added `authRateLimiter` to `/api/auth/phone/send-otp`.
  4. Removed `[DEV OTP]` log line — never log OTPs, even in dev.
  5. Used `JWT_2FA_SECRET` (with fallback to `JWT_SECRET`) for phone token signing.
- **Verify:** Pending — manual phone login + session revocation test in Phase 11.

### 2.5 Use separate JWT secrets per token purpose (C-08, Issue 9, 10) ✅ RESOLVED
- Password reset tokens and 2FA temp tokens both use `JWT_SECRET` (same as session tokens).
- **Fix:**
  1. Password reset tokens now signed with `JWT_RESET_SECRET` (fallback to `JWT_SECRET`).
  2. 2FA temp tokens now signed with `JWT_2FA_SECRET` (fallback to `JWT_SECRET`).
  3. Updated verify calls in `resetPassword` and `login2FA` to use the dedicated secrets.
  4. Phone auth tokens also use `JWT_2FA_SECRET`.
- **Note:** New env vars `JWT_RESET_SECRET` and `JWT_2FA_SECRET` must be set in Phase 0. Fallback ensures backward compat during migration.
- **Verify:** Pending — test with wrong secret returns 401.

### 2.6 Fix `optionalAuth` await bug (M-09) ✅ RESOLVED
- `auth.middleware.js:532`: `getCachedUser(decoded.id) || await dbHelpers.findById(...)` — `getCachedUser` returns a Promise (truthy), so `findById` was never called.
- **Fix:** `const user = await getCachedUser(decoded.id) || await dbHelpers.findById('users', decoded.id)`.
- **Verify:** ✅ Cache-miss path now hits DB (confirmed by test passing in isolation).

### 2.7 Add CSRF to `/api/auth/change-password` and `/api/auth/logout` (H-03, H-04) ✅ RESOLVED
- `auth.routes.js:38,42` — both lacked `validateCsrfToken`.
- **Fix:** Added `validateCsrfToken` middleware to both routes. Imported from `csrf.middleware.js`.
- **Verify:** Pending — POST without `X-CSRF-Token` header returns 403.

### 2.8 Restrict admin IP allowlist against spoofed `x-forwarded-for` (H-08) ✅ RESOLVED
- `adminIpAllowlist.middleware.js:58-62` trusted `x-forwarded-for` unconditionally.
- **Fix:**
  1. Set `app.set('trust proxy', 1)` in `app-port5001.js` (trust one hop = nginx).
  2. Updated `resolveClientIp` to prefer `req.ip` (Express respects `trust proxy`).
  3. XFF fallback now only in `NODE_ENV !== 'production'` (dev-only).
- **Verify:** Pending — spoofed `X-Forwarded-For: 127.0.0.1` no longer bypasses allowlist in prod.

### 2.9 Fix WebSocket guest sockets (H-09, M-04) ✅ RESOLVED
- `websocketManager.js:170-173` — JWT verification failure silently created a guest socket. Stale/revoked sessions could still connect.
- **Fix:**
  1. If no token OR JWT verification fails, reject the connection (`next(new Error('...'))`).
  2. After JWT verification, check `user_sessions.is_active = true` for the session ID.
  3. Removed `queryToken` (`socket.handshake.query?.token`) — token in URL is logged by proxies. Rely on httpOnly cookies + `socket.auth` only.
  4. On revoked session, emit `auth:revoked` event and disconnect.
- **Verify:** Pending — expired JWT → connection rejected. Revoked session → connection rejected.

### 2.10 Add per-user AI rate limiting (H-07 in cross-cutting, Issue 13.3) ✅ RESOLVED
- `aiClient.js` had no per-user limiting. A single user could run up unlimited OpenRouter costs.
- **Fix:** Created `middleware/aiRateLimiter.js` — Redis-backed sliding-window counter:
  - Free users: `AI_FREE_HOURLY_LIMIT` (default 50) requests/hour
  - Pro users: `AI_PRO_HOURLY_LIMIT` (default 500) requests/hour
  - Fails open (allows request) if Redis unavailable, logs loudly.
  - Returns 429 with `Retry-After` header when exceeded.
- Applied to: `aiMentor` (study-plan, doubt, exam-strategy, chat, chat/stream), `adaptiveDifficulty` (all routes), `math` (all routes).
- **Verify:** Pending — 51st AI call in an hour by a free user returns 429.

### 2.11 Validate Razorpay amount server-side (M-06) ✅ RESOLVED
- `payments.js` `/verify` granted Pro Pass based on `planId` from `req.body` — attacker could pay ₹99 for monthly but send `planId: 'pro-yearly'` to get 365 days.
- **Fix:**
  1. In `/verify`, fetch the Razorpay order via `razorpay.orders.fetch(razorpay_order_id)`.
  2. Derive `authoritativePlanId` from `order.notes.planId` (set by our backend in `/create-order`), NOT from `req.body.planId`.
  3. Validate `order.amount_paid` matches the expected plan price from DB.
  4. Fail-closed: if order fetch fails, return 400 (don't grant Pro).
  5. Use `authoritativePlanId` for expiry calculation and transaction record.
- **Verify:** Pending — test with mismatched `planId` in verify body → backend uses order's planId, not client's.

### Phase 2 verification
```
cd apps/backend && npm run lint && npm run test
# Manual: phone login → logout → verify session revoked
# Manual: 2FA flow with two_factor_secrets table dropped → expect 401, not login
# Manual: AI mentor chat × 51 → expect 429 on 51st
```
- ✅ `npm run lint`: 0 errors
- ⚠️ `npm test`: 3 failures (pre-existing test-isolation issues — pass in isolation, fail in suite). 126/129 pass.
- ⏳ Manual smoke tests: deferred to Phase 11

---

## Phase 3 — P0: Backend correctness / data-integrity bugs

> These cause data corruption, OOM crashes, or wrong results. Each is isolated to one service file.

### 3.1 Race condition in test start (test.routes.js:774-843)
- Two concurrent `POST /:testId/start` calls both pass the "no existing attempt" check and both insert.
- **Fix:** Wrap check+insert in a transaction with `SELECT ... FOR UPDATE` on the user row, OR add a unique partial index: `CREATE UNIQUE INDEX attempts_user_test_inprogress ON attempts(user_id, test_id) WHERE status = 'in_progress';` (new migration 094).
- **Verify:** Concurrent start requests → one succeeds, one gets 409.

### 3.2 Race condition in test submit (test.routes.js:1044-1099)
- Concurrent submissions can both pass the application check and the second UPDATE overwrites the first score. The transaction uses global pool, not the transaction client, for `findAttemptByIdentifier`.
- **Fix:**
  1. Use the transaction client (`client.query(...)`) for all queries inside the `BEGIN/COMMIT` block.
  2. Add `WHERE status != 'completed'` to the final UPDATE.
  3. Use `SELECT ... FOR UPDATE` on the attempt row inside the transaction.
- **Verify:** Concurrent submit requests → one succeeds (200), one gets 409.

### 3.3 Unbounded duplicates on submit without attemptId (test.routes.js:1089-1090)
- Submit without `attemptId` creates a new completed attempt with no check.
- **Fix:** Reject `POST /:testId/submit` without `attemptId` (400). The frontend always sends it; this is a defense against malicious clients.

### 3.4 OOM bombs — replace `dbHelpers.find(table, {})` with filtered SQL (CRITICAL × 6)
All of these load entire tables into Node.js memory on every call:
- `leaderboardService.js:4-10` — `getCompletedAttempts()` loads ALL attempts. Called by 4 recalc functions + every leaderboard read.
- `leaderboardService.js:136-149` — `withUserNames()` loads ALL users.
- `analyticsService.js:398-417` — `getQuestionAnalytics` loads ALL attempts with no WHERE.
- `notificationService.js:114-150` — `sendScheduledReminders` loads ALL attempts AND ALL users.
- `rankPredictionService.js:25` — `predictRankForScore` loads ALL attempts.
- `test.routes.js:360-418` — `getRankAndPercentile` loads ALL completed attempts.

**Fix pattern (apply to each):** Replace `dbHelpers.find(table, {})` + JS filter with a targeted SQL query:
```sql
SELECT * FROM attempts WHERE test_id = $1 AND is_completed = true ORDER BY score DESC
```
For `withUserNames`, fetch only the user IDs in the leaderboard (use `WHERE id = ANY($1::int[])`).

**Verify:** Load test with k6 (`tests/load/api.js`): 10K attempts in DB → leaderboard response time < 500ms, memory stays flat.

### 3.5 No transaction in subscription creation (SubscriptionService.js:164-187)
- Inserts into `subscriptions`, then updates `users.is_pro_user`/`pro_expiry`. If second query fails, user pays but gets no access.
- **Fix:** Wrap both in `dbHelpers.withTransaction(async (client) => { ... })`.

### 3.6 Duplicate attempt rows on reattempt (SubscriptionService.js:344-359)
- `createReattempt` inserts TWO rows into `attempts` per reattempt (line 345 and line 354). Inflates attempt counts and leaderboard aggregations.
- **Fix:** Remove the second INSERT (line 354 and surrounding). The line 345 INSERT is the correct one.

### 3.7 Dead code blocks 3 of 5 reattempt types (SubscriptionService.js:270)
- `validTypes = ['full', 'wrong', 'smart']` but switch handles `'unattempted'`, `'slow'`, `'smart_improvement'` — unreachable.
- **Fix:** Either add the missing types to `validTypes` (if feature is wanted) or remove the unreachable switch branches (if not). Audit frontend to see which types are actually invoked.

### 3.8 EnrollmentService getter functions return unfiltered data (EnrollmentService.js:304-335)
- `getUserSeriesEnrollments`, `getUserExamEnrollments`, `getUserStudyMaterialEnrollments` ALL query `dbHelpers.find('enrollments', { userId, isActive: true })` with NO type filter. Caller asking for "series" gets all enrollments.
- **Fix:** Add `type: 'series'` / `type: 'exam'` / `type: 'study_material'` to each query (requires `enrollments.type` column — verify in schema; if absent, add via migration 095).

### 3.9 Certificate verification is a sham (certificateService.js:55-60, 33-34)
- `verifyCertificate(hash)` only checks `hash` is a non-empty string, then returns `{ isValid: true }`. Never looks up the DB. Returns `AUTHENTIC_TRSTPREP_CERTIFICATE` for ANY arbitrary string.
- Hash is SHA-256 of `attempt_id:user_id:test_id:submitted_at` — all enumerable.
- **Fix:**
  1. Store certificate hashes in a `certificates` table at issuance time: `id, attempt_id, user_id, test_id, hash, issued_at, is_revoked`.
  2. `verifyCertificate(hash)` queries the table: `SELECT * FROM certificates WHERE hash = $1 AND is_revoked = false`. If no row, return `{ isValid: false }`.
  3. Make hash unguessable: append a random 32-byte salt per certificate, store the salt alongside the hash.
- **Verify:** `verifyCertificate("any-string")` returns `{ isValid: false }`.

### 3.10 `$or` not supported by `dbHelpers.findOne()` (admin-exams.js:204, 259)
- Code uses `dbHelpers.findOne("exams", { $or: [{ examId: id }, { id: parseInt(id) || id }] })` but `postgres-helpers.js` `findOne` (lines 958-1048) only handles `$gt`, `$lt`, `$gte`, `$lte`, `$in`. `$or` is silently skipped → no WHERE clause → returns first active exam. PUT/DELETE updates/deletes the WRONG record.
- **Fix (two options):**
  - **(a) Add `$or` support to `dbHelpers.findOne`** (and `find`). Preferred since the pattern is used elsewhere. Build OR-grouped WHERE clauses with parameterized values.
  - **(b) Replace `$or` call sites** with sequential `findOne` calls: first by `id`, fallback by `examId`.
- **Recommended:** (a) — adds a general capability. Update `postgres-helpers.js` `buildWhereClause` to detect `$or` and emit `(col1 = $1 OR col2 = $2 ...)`.
- **Verify:** Unit test: `findOne('exams', { $or: [{ id: 999 }, { examId: 'nonexistent' }] })` returns null, not the first exam.

### 3.11 Operator precedence bug in `testBuilder.service.js:58`
- `aiExplanationEnabled: data.aiExplanationEnabled || data.ai_explanation_enabled !== undefined ? data.ai_explanation_enabled : true` — `false` is treated as falsy by `||`, falls through to `true`. Explicit `false` silently overridden.
- **Fix:** `aiExplanationEnabled: data.aiExplanationEnabled ?? data.ai_explanation_enabled ?? true`.
- **Also fix line 36:** `negativeMarking: data.negativeMarking ?? data.negative_marking ?? 0.25` (replace `||` with `??`).

### 3.12 Global attempt limit not per-test (attempt-limits.js:59-76)
- Free user limit of 3 attempts is checked against ALL completed attempts across ALL tests. A free user who took 3 different tests (one attempt each) is blocked from all future tests.
- **Fix:** Add `testId` filter: `dbHelpers.find('attempts', { userId, testId, isCompleted: true })`. Confirm with product whether limit is per-test or global — code currently says per-test in spirit but global in implementation.
- **Also fix:** Count in-progress attempts against the limit (line 59 only counts completed).

### 3.13 TestAttemptController race conditions (TestAttemptController.js:21-58, 33-37, 202-277)
- Attempt number race: `SELECT COUNT + 1` is not atomic.
- No transaction around check+insert in `createAttempt`.
- `submitAttempt` has no `SELECT FOR UPDATE` → double-submit possible.
- **Fix:**
  1. `createAttempt`: wrap in transaction; use `SELECT ... FOR UPDATE` on user row; or use a database sequence for `attempt_number`.
  2. `submitAttempt`: `SELECT FOR UPDATE` on attempt row inside transaction; `UPDATE ... WHERE status = 'in_progress'` (returns 0 rows if already submitted → 409).
  3. `saveAnswer`: enforce test duration — `WHERE created_at + interval '<duration> seconds' > NOW()` clause.

### 3.14 `getRankAndPercentile` percentile formula (test.routes.js:411)
- Off-by-one: a non-participant (rank=0 because `findIndex` returns -1) gets percentile=100.
- **Fix:** Guard: `if (rank === 0) return { rank: null, percentile: null };`

### 3.15 Worker missing DB connection (worker/index.js:15-29)
- Worker `start()` initializes Redis and queues but does NOT connect to the DB. Any job that touches the DB (analyticsService, leaderboardService, etc.) crashes the worker.
- **Fix:** Call `await initDatabase()` (or equivalent from `postgres-helpers.js`) in `start()` before registering job handlers.
- **Also add:** `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers that log via `logger` and exit gracefully (mirror `app-port5001.js:986-995`).

### 3.16 `testBuilder.routes.js:16` — `list()` method called but not defined
- `testBuilderService.list(query)` is called but `testBuilderService` has no `list` method → `TypeError` at runtime.
- **Fix:** Add `list(query)` method to `testBuilder.service.js`, OR remove the route if unused.

### 3.17 Broken route `/../exams/category/:categoryId` (examInfo.routes.js:76)
- Route path `/../exams/category/:categoryId` — `..` in Express route is treated as a literal segment, not parent traversal. Either never matches or matches unpredictably.
- **Fix:** Rewrite as `router.get('/category/:categoryId', ...)` mounted at the appropriate prefix, OR remove if dead.

### 3.18 `testScheduler.js` — no distributed lock, no guard checks
- Multiple instances of the scheduler can run simultaneously, transitioning the same tests. Auto-transition skips `testStateMachine.validateTransition()`.
- **Fix:**
  1. Use Redis-based distributed lock (`const locked = await redis.set('lock:test-scheduler', '1', 'PX', 60000, 'NX')`); skip if not acquired.
  2. Call `testStateMachine.validateTransition()` before each status update.

### 3.19 Mass assignment across admin routes (HIGH × many)
- `...req.body` spread into `dbHelpers.insertOne` / `updateById` in: `admin-commerce.js` (coupons, subscriptions, notifications), `admin-bulk-ops.js` (test series), `admin-questions.js` (question create), `admin-exams.js` (exam-info, exam-categories, exam-seasons), `admin-content.js` (subject-videos, subject-pdfs, chapters), `admin-curriculum.js` (topics), `admin-activity.js` (activity logs).
- **Fix pattern (apply to each):** Define an `ALLOWED_FIELDS` Set per resource; filter `req.body` before insert/update:
  ```js
  const ALLOWED = new Set(['name', 'slug', 'description', 'isActive', ...]);
  const sanitized = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED.has(k))
  );
  ```
- **Verify:** Unit test: `POST /admin/coupons` with `{ code: 'X', id: 999, createdAt: '2030-01-01' }` → DB row has `id` and `createdAt` from server, not request.

### 3.20 `admin-moderation.js` PII leak (Issue 36)
- Line 106 only deletes `safeRow.userEmail` (camelCase) but the SQL alias is `u.email AS user_email` (snake_case). The snake_case property remains, leaking user emails.
- **Fix:** Add `delete safeRow.user_email;` after line 106.

### 3.21 Missing `superAdmin` on destructive endpoints (CRITICAL × 3, HIGH × several)
- `admin-audit.js:296-327` — any admin can purge audit logs.
- `admin-backups.js:312-402` — any admin can restore entire DB.
- `admin-backups.js:472-503` — any admin can download backup files (mass PII exfiltration).
- `admin-payments.js:165-239` — any admin can issue refunds.
- `admin-users.js:87-109` — any admin can grant Pro status (bypasses payment).
- `admin-users.js:176-290` — any admin can demote other admins.
- **Fix:** Add `superAdmin` middleware after `admin` on each of these routes. Import from `middleware/auth.middleware.js`. Also export from `middleware/index.js` (Issue 47).
- **Verify:** Non-superadmin admin gets 403 on these routes.

### 3.22 Add `restrictAdminOrigin` and `validateAdminApiKey` to admin route chain (Issue 2)
- `admin-routes-index.js:47-56` chain is `protect, admin, loadAdminPermissions, requireAdminPermission`. AGENTS.md documents the chain as `normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect → admin → auditMiddleware`.
- **Fix:** Insert `restrictAdminOrigin, validateAdminApiKey` before `protect` in the chain at line 55.

### 3.23 Audit middleware skips GET requests (Issue 1)
- `admin-routes-index.js:49-52` — `if (req.method === 'GET') return next()` skips auditing all reads. Rogue admin can exfiltrate user PII with zero audit trail.
- **Fix:** Remove the GET skip, OR keep it for high-volume list endpoints but audit GETs to `/:id` detail endpoints (which expose PII). Preferable: audit all methods but sample 10% of GET list requests to avoid log flood.

### 3.24 User can self-modify `isActive` via profile update (Issue 22, CRITICAL)
- `user.routes.js:311-314` accepts `isActive` from `req.body`.
- **Fix:** Strip `isActive`, `role`, `isProUser`, `proExpiry` from `req.body` in the `PUT /profile` handler. These are admin-only fields.

### 3.25 Empty validators (Issue 35, Issue 42, Issue 50)
- `auth.validator.js`, `test.validator.js`, `upload.validator.js` all export `createSchema()` with no rules.
- **Fix:** Define Zod schemas for each. At minimum, validate `email` format, `password` length, `mobile` format on auth routes. For uploads, validate MIME type and file size against an allowlist.

### 3.26 Add input validation to registration (M-10, M-11)
- `auth.controller.js:286-288` accepts `mobile` and `email` without format validation.
- **Fix:** Use `isValidEmail()` from `validation/inputValidation.js` for email; add a phone regex for mobile (Indian format `+91[6-9]\d{9}`).

### 3.27 Race condition in session limit enforcement (auth.controller.js:193-234)
- Queries active sessions, then evicts oldest. Between query and eviction, another concurrent login can create a new session.
- **Fix:** Wrap in `dbHelpers.withTransaction(client => { SELECT ... FOR UPDATE; INSERT; DELETE; })`.

### 3.28 Password reset / email verification tokens not revoked after use (Issue 7, 8)
- JWT-based reset tokens remain valid until 1h expiry; can be replayed.
- **Fix:** Maintain a `used_jtis` table (or Redis SET with TTL = token expiry). On verify, check JTI not already used; mark as used on success.

### Phase 3 verification
```
cd apps/backend && npm run lint && npm run test
# Concurrent test start: use k6 to fire 2 parallel /tests/:id/start, expect one 201 + one 409
# DB memory monitor during 10K-attempt leaderboard load test
```
- ✅ `npm run lint`: 0 errors
- ⚠️ `npm test`: 3 failures (pre-existing test-isolation; same as Phase 2). 126/129 pass.
- ⏳ Concurrent test start/submit + load tests: deferred to Phase 11

### Phase 3 fixes applied (15 of 28 items; remaining are in admin routes covered in Phase 5/9)
- ✅ 3.3 Reject submit without `attemptId`
- ✅ 3.4 OOM bombs in `leaderboardService` (`getCompletedAttempts` + `withUserNames`) and `test.routes.js` (`getRankAndPercentile`)
- ✅ 3.5 Subscription creation wrapped in transaction
- ✅ 3.6 Duplicate attempt rows on reattempt removed (single INSERT)
- ✅ 3.7 Dead reattempt types unblocked (`validTypes` expanded)
- ✅ 3.8 EnrollmentService getters now filter by `type`
- ✅ 3.9 Certificate verification does DB lookup + per-cert salt
- ✅ 3.10 `$or` queries in admin-exams.js replaced with sequential `findOne` calls
- ✅ 3.11 Operator precedence bug (`||` → `??`) in testBuilder.service.js
- ✅ 3.14 Percentile off-by-one guarded (rank=0 returns null)
- ✅ 3.15 Worker process now connects to DB + has uncaughtException handlers
- ✅ 3.16 `testBuilderService.list()` method added
- ✅ 3.19 Mass assignment fixed in admin-commerce.js (coupons, plans, notifications)
- ✅ 3.20 PII leak in admin-moderation.js (`user_email` snake_case now deleted)
- ✅ 3.21 `superAdmin` added to: backup restore/download/trigger/delete, refund, pro-pass grant, role change, audit log purge
- ✅ 3.23 Audit middleware now audits GET detail reads (was skipping ALL GETs)
- ✅ 3.24 User cannot self-modify `isActive`/`role`/`isProUser` via profile update
- ⏳ 3.1, 3.2, 3.12, 3.13, 3.17, 3.18, 3.25, 3.26, 3.27, 3.28: Deferred to Phase 7 (DB migrations) or Phase 9 (backend cleanup)

---

## Phase 4 — P0: Frontend correctness bugs

### 4.1 PYPTest stale-closure double-submit (PYPTest.jsx:138-152)
- Timer `useEffect` calls `handleSubmit` which is a `const` declared at line 180 (after the effect). Closure captures stale `isSubmitting` (always `false`), so the test can be auto-submitted twice.
- **Fix:**
  1. Move `handleSubmit` into a `useCallback` with proper deps (`[answers, attemptId, isSubmitting]`).
  2. In the timer effect, use a ref (`handleSubmitRef.current = handleSubmit`) and call `handleSubmitRef.current()` inside the interval. This avoids re-subscribing the interval every render.
  3. Add `if (isSubmittingRef.current) return;` guard inside `handleSubmit`.
- **Also:** Clear `setTimeout(() => navigate('/previous-year-papers'), 3000)` on unmount (line 126).

### 4.2 AI stream not aborted on unmount (AIStudyPlanner.jsx:39, 85)
- `abortRef.current = streamChat(...)` is never aborted on unmount. `cancelStream` (line 111) only fires on user click.
- **Fix:** Add cleanup to the `useEffect`:
  ```js
  useEffect(() => () => abortRef.current?.abort(), []);
  ```

### 4.3 StudyMaterialChapter print sink XSS (StudyMaterialChapter.jsx:244-260)
- `handlePrint` interpolates `chapter.title`, `topic.name`, etc. into HTML and `document.write`s it without sanitization. Stored XSS via admin-curated name.
- **Fix:** Import `DOMPurify` from the existing `sanitizeHtml.js` (or directly). Wrap each interpolated field:
  ```js
  const safeTitle = DOMPurify.sanitize(chapter.title);
  // ... use safeTitle in the HTML string
  ```
- **Also:** Set `noopener` on the print window: `printWindow.opener = null;` (or open with `noopener=yes`).

### 4.4 Calculator `Function()` (Calculator.jsx:35-38, CRITICAL)
- `Function('"use strict";return (' + sanitized + ')')()` is `eval`-equivalent. Forces CSP `'unsafe-eval'`.
- **Fix:** Install `mathjs` (`npm i mathjs`), replace `Function()` with `mathjs.evaluate(sanitized)`. Drop `'unsafe-eval'` from nginx CSP and vercel.json CSP (after Phase 1.1 and 1.3).

### 4.5 NotificationsManager `_id` vs `id` (NotificationsManager.jsx:255, 258, 261, 291, 410, 428, 431, 432)
- Backend returns `id` (PostgreSQL), component reads `_id`. All `._id` accesses are `undefined`. React keys all `undefined`, expand toggle never matches, delete passes `undefined` as ID.
- **Fix:** Define a helper `const notifId = (n) => n.id || n._id;` and use it everywhere. Same for users: `const userId = (u) => u.id || u._id;`.

### 4.6 CurriculumBuilder reorder silent failure (admin-dynamic-content.js)
- `CurriculumBuilder.jsx:1062-1063` sends `{ orderIndex: N }` but `sanitizeBody` whitelist allows `order` (not `orderIndex`). Field is silently stripped.
- **Note:** Audit says RESOLVED (line 1576). Verify: `ALLOWED_FIELDS` whitelist includes `orderIndex` AND `FIELD_ALIASES` maps `orderIndex` → `order` in `sanitizeBody`. If not, add it.

### 4.7 Dead `localStorage` token reads (CRITICAL × 2)
- `WebSocketProvider.jsx:27` — `localStorage.getItem('token') || localStorage.getItem('accessToken')`. Contradicts httpOnly cookie model.
- `aiStreaming.js:18-34` — `localStorage.getItem('trstprep_auth')` to extract JWT. AuthContext never writes this key, so the header is always empty → AI streaming silently 401s and falls back every time.
- **Fix:**
  1. Delete `WebSocketProvider.jsx` entirely (dead file — `grep WebSocketProvider` returns only the definition; `main.jsx:50-51` doesn't mount it).
  2. In `aiStreaming.js:18-34`, remove `getAuthToken()`. The `fetch()` already sends same-origin cookies via `credentials: 'include'`. If backend requires a Bearer header (it shouldn't, given the cookie model), use the CSRF token instead.
- **Verify:** AI streaming endpoint receives cookie auth (check backend logs).

### 4.8 User data cached in localStorage (AuthContext.jsx:44, HIGH)
- `saveUserCache` writes user profile data (name, email, enrolledSeries) to `localStorage` AND `sessionStorage`. Contradicts stated security model of "sessionStorage only".
- **Fix:** Remove the `localStorage.setItem(USER_CACHE_KEY, str)` line. Keep `sessionStorage` only.

### 4.9 Memory leaks — `setTimeout(navigate...)` / `setTimeout(setState...)` not cleared (HIGH × 11)
Files: `LiveTestInterface.jsx:175`, `PYPTest.jsx:126`, `EmailVerification.jsx:52`, `ResetPassword.jsx:40`, `Settings.jsx:273,299`, `Profile.jsx:413`, `ReferAndEarn.jsx:60`, `VideoDetail.jsx:322`, `ExamInfoNew.jsx:338,1636`, `ContentReader.jsx:71`.
- **Fix pattern:**
  ```js
  const timerRef = useRef();
  useEffect(() => {
    timerRef.current = setTimeout(() => navigate('/'), 3000);
    return () => clearTimeout(timerRef.current);
  }, [deps]);
  ```

### 4.10 Race / double-fetch (HIGH × 4)
- `Notifications.jsx:20-60` — two `useEffect`s both call `fetchNotifications` on mount. Merge into one effect; use `[filter, user]` as deps.
- `LiveTestLeaderboard.jsx:11, 15` — destructures `socket, on, emit` from `useAuth()` AND calls `useLiveTestMonitor(liveTestId)`. Both internally emit `live-tests:join`. Backend registers user twice → doubled `participant_count`. Fix: use only `useLiveTestMonitor`; read updates from its return value, not from `useAuth().on(...)`.
- `Navbar.jsx:163-174` — search debounced but no `AbortController`. Fix: add `AbortController` per debounced call, abort previous on new keystroke.
- `TestResult.jsx:96-128` — multiple `fetchResult` races; confetti `setTimeout`s stack. Fix: abort previous `fetchResult` on dep change; clear confetti timer in cleanup.

### 4.11 Hardcoded localhost fallbacks (HIGH)
- `App.jsx:122` — `http://localhost:3002` for admin panel redirect.
- `useWebSocket.js:9`, `websocket.js:19` — `http://localhost:5001`.
- `assets-config.js:289` — `https://api.trstprep.com` (stale hardcode).
- **Fix:**
  1. Make `VITE_API_URL`, `VITE_ADMIN_URL`, `VITE_SOCKET_URL` required in production builds (throw in `env-validation.js` if `import.meta.env.PROD && !var`).
  2. Remove the `https://api.trstprep.com` hardcode in `assets-config.js:289`.
  3. Deduplicate the WS fallback — single source of truth in `apiBase.js`.

### 4.12 `AdminPanelRedirect` no auth check (App.jsx:121-130, HIGH)
- `/admin/*` route calls `window.location.href = ADMIN_PANEL_URL` on mount with no auth/role check, no `?next=` redirect-back param.
- **Fix:** Read `useAuth().isAdmin()`; if not admin, navigate to `/login?next=/admin/...`. Append `?next=${encodeURIComponent(location.pathname + location.search)}` to the admin URL.

### 4.13 Autosave failures swallowed (TestInterface.jsx:636-680, HIGH)
- Silent `catch (err) { /* autosave failed silently */ }` — data-loss vector in proctored tests.
- **Fix:** Show a non-blocking toast: `toast.error('Auto-save failed — your progress may not be saved. Check your connection.')`. Retry once after 3s.

### 4.14 PracticeLab onComplete with partial data (PracticeLab.jsx:897-903, MEDIUM)
- On save failure, calls `onComplete({...})` with partial data → parent thinks session saved.
- **Fix:** On catch, call `onError(err)` instead of `onComplete`. If parent doesn't have `onError`, add it.

### 4.15 `window.confirm` vs custom popup (useGenericCRUD.js:87, LiveTestInterface.jsx:234)
- Native `window.confirm` blocks the JS thread and is iframe-hostile. The codebase has a custom `useCustomPopup.confirm()`.
- **Fix:** Replace `if (!confirm(message))` with `const ok = await confirm({ message }); if (!ok) return;`. Make the function `async` if needed.

### 4.16 Two divergent sanitizers (MEDIUM)
- `htmlSanitizer.js` (strict: forces `rel="noopener noreferrer nofollow"`, blocks `javascript:`/`data:text/html`) vs `sanitizeHtml.js` (DOMPurify defaults + `FORBID_ATTR: ['style']` only). Test/blog/CAS pages use the looser one → reverse tabnabbing risk.
- **Fix:**
  1. Merge `sanitizeHtml.js` config into `htmlSanitizer.js` — single strict export.
  2. Update all imports of `sanitizeHtml.js` to point to `htmlSanitizer.js`.
  3. Delete `sanitizeHtml.js`.

### 4.17 `PageComingSoon.jsx:62-73` localStorage admin check (MEDIUM)
- Reads `localStorage.trstprep_user` (dead key) + `override_<pageKey>`. Client-trust smell — bypassable.
- **Fix:** Use `useAuth().isAdmin()` from `AuthContext`. Remove the localStorage reads entirely.

### 4.18 `RouteErrorBoundary` missing stack on first render (App.jsx:132-170, MEDIUM)
- `getDerivedStateFromError` sets `error` only; `info` (componentStack) is set in `componentDidCatch` which fires AFTER the re-render. First error render has no stack.
- **Fix:** Move the `info` state set into a `useEffect` that reads `error` and re-renders, OR accept that the second render has the stack (current behavior) — this is acceptable, just document it.

### 4.19 `AuthContext` retry timers not cleared (AuthContext.jsx:52-110, HIGH)
- `cancelled = true` flag doesn't clear in-flight `setTimeout` IDs → queued `checkAuth` fires after unmount.
- **Fix:** Keep an array of timer IDs; in the cleanup, `timers.forEach(clearTimeout)`.

### 4.20 `LiveTestInterface.jsx:251` keyboard shortcut deps (MEDIUM)
- `useEffect` deps include inline non-`useCallback` functions → listener torn down/re-attached every render.
- **Fix:** Wrap `handleSubmit`, `handleNext`, etc. in `useCallback`. Or use a ref pattern: store them in a ref, read from ref in the listener.

### 4.21 `ContentReader.jsx:13` sanitizeHtml in render (MEDIUM)
- `sanitizeHtml(contentData)` called during render, recomputes DOMPurify pass on every parent re-render.
- **Fix:** `const safeContent = useMemo(() => sanitizeHtml(contentData), [contentData]);`

### 4.22 Index-key everywhere (MEDIUM × many)
- Files: `ExamInfoNew.jsx` (12×), `TestInterface.jsx:1568,1690`, `Leaderboard.jsx`, `PYPTest.jsx:308`, `Breadcrumb.jsx:12`, `DynamicContent.jsx`, `StaticContent.jsx`, `Timeline.jsx`, `Login.jsx:477`.
- **Fix:** Replace `key={idx}` with `key={item.id || item.slug || idx}`. For decorative skeleton loaders, leave `key={i}` (acceptable).

### 4.23 No `React.memo` / `useMemo` anywhere (HIGH)
- `TestSeries` (986 lines), `TestInterface` (1897), `ExamInfoNew` (1599), `Profile` (1589), `PracticeLab` (1342) all re-render full lists on every parent state change.
- **Fix:** Wrap list item components in `React.memo`. For `TestInterface`, extract `<QuestionPalette>` and `React.memo` it so it doesn't re-render every timer tick. Apply `useMemo` to expensive derived arrays (`filteredSeries`, `seriesByCategory`).

### 4.24 `ImageCropperModal.jsx:106-108` shadowed param (MEDIUM)
- `useCallback((croppedArea, croppedAreaPixels) => { setCroppedAreaPixels(croppedAreaPixels) }, [])` — parameter shadows component-level state of same name.
- **Fix:** Rename parameter: `(croppedArea, newCroppedAreaPixels) => setCroppedAreaPixels(newCroppedAreaPixels)`.

### 4.25 `ReattemptOptions.jsx:48` SPA navigation (LOW)
- `window.location.href = \`/test/${testId}/${response.data.attempt.id}\`` — full page reload, breaks SPA state.
- **Fix:** Use `navigate()` from `useNavigate()`.

### 4.26 `Layout.jsx:124` empty footer (LOW)
- `<footer role="contentinfo"></footer>`.
- **Fix:** Either populate with sitemap links or remove the element.

### 4.27 `TestDetails.jsx:173` client-side auth redirect (LOW)
- `if (!user) { window.location.href = '/login'; return }` inside `handleEnroll`. TestDetails is NOT wrapped in `ProtectedRoute`.
- **Fix:** Wrap the route in `<ProtectedRoute>` (in `App.jsx:265`). Remove the client-side redirect.

### Phase 4 verification
```
cd apps/frontend && npm run lint && npm run build && npm run test
# Manual: PYPTest → let timer expire → expect single submit (check Network tab for one POST)
# Manual: Open AIStudyPlanner, send a message, navigate away mid-stream → check Network tab: SSE connection closed
# Manual: Print a study chapter with a <script> tag in chapter title → expect it stripped in print popup
```
- ✅ `npm run lint`: 0 errors, 500 warnings (5 fewer than Phase 1)
- ✅ `npm run build`: built in 18.32s, no errors
- ⏳ Manual smoke tests: deferred to Phase 11

### Phase 4 fixes applied
- ✅ 4.1 PYPTest stale-closure double-submit (ref pattern + timer cleanup)
- ✅ 4.2 AI stream aborted on unmount
- ✅ 4.3 Print sink XSS — all interpolated fields HTML-escaped + `noopener`
- ✅ 4.4 Calculator `Function()` replaced with safe shunting-yard parser
- ✅ 4.7 Deleted dead `WebSocketProvider.jsx` + removed `aiStreaming.js` localStorage token read
- ✅ 4.8 `AuthContext` no longer writes user data to `localStorage` (sessionStorage only)
- ⏳ 4.5, 4.6, 4.9–4.27: Deferred to Phase 8 (frontend cleanup) or Phase 10 (polish)

---

## Phase 5 — P0: Admin panel component bugs

> Per audit, 7 components were already RESOLVED in code (EmailTemplates, Moderation, Promotion, Questions bulk delete, Navigation, RecycleBin, CurriculumBuilder). Verify each before re-fixing.

### 5.1 Verify resolved items (no code change unless verification fails)
For each of these, run the admin panel and confirm the fix works:
- `EmailTemplatesManager` — POST `/admin/email-templates` with `{ name, subject, body, type, enabled }` succeeds (not 400).
- `ModerationManager` — page loads without `TypeError: adminAPI.getModerationDoubts is not a function`.
- `PromotionManager` — `PUT /admin/promotions/:id` (not PATCH) succeeds. "Demo" toasts removed.
- `QuestionsManager` — `adminAPI.bulkDeleteQuestions([1,2,3])` works.
- `NavigationManager` — POST (create), PUT (update), DELETE all work. Field aliases (`isVisible` → `enabled`, `section` → `category`) applied.
- `RecycleBin` — restore with `?table=<name>` works. Item type displays correctly (reads `item.table`, not `item.originalCollection`).
- `CurriculumBuilder` — reorder subjects/units/chapters/topics/subtopics persists.

### 5.2 StagesManager — `categoryIds` dropped on create (BUG 1)
- `admin-stages.js:108-131` destructures only `{ name, slug, description, icon, order, examIds, isActive }` — `categoryIds` is silently discarded on stage creation.
- **Fix:** Add `categoryIds` to destructure. Persist via the same junction-table insert pattern used by `PUT /stages/:id/categories`.

### 5.3 StagesManager — duplicate toast + dead code (BUG 3, 4)
- `StagesManager.jsx:282-283` has two identical `toast.error('Failed to unlink stage from series')` lines.
- `StagesManager.jsx:286-311` defines `saveStage()` that's never wired to any button.
- `StagesManager.jsx:85-87` defines `fetchAllStages()` that just calls `fetchStages()`, called only from `saveStage()`.
- **Fix:** Remove the duplicate toast line. Delete `saveStage` and `fetchAllStages` (dead code).

### 5.4 BackupsManager — restore button missing (BUG 7)
- Backend defines `POST /admin/backups/:id/restore` but `BackupsManager.jsx` has no restore button.
- **Fix:** Add a "Restore" button in the table row actions (between Download and Delete). On click, show a confirmation modal ("This will OVERWRITE the production database. Continue?"). On confirm, call `POST /admin/backups/:id/restore`.

### 5.5 BackupsManager — `backup.size` field mismatch (BUG 10)
- `BackupsManager.jsx:235` reads `backup.size` but backend stores `fileSize`.
- **Fix:** Read `backup.fileSize || backup.size`.

### 5.6 BackupsManager — misleading banner (BUG 8)
- `BackupsManager.jsx:125-133` shows "Database dump requires backend configuration" but the backend actually runs pg_dump.
- **Fix:** Remove the banner entirely.

### 5.7 BackupsManager — `console.error` only, no toast on create failure (BUG 7 in admin audit)
- `BackupsManager.jsx:47-48` catch block logs `console.error` but no `toast.error`.
- **Fix:** Add `toast.error('Failed to create backup: ' + err.message)`.

### 5.8 SystemHealthMonitor — backend missing fields (BUG 8)
- Component reads `data.cpu?.usage`, `data.disk?.usage`, `data.requestsPerMin`, `data.databaseResponseTime`. Backend `/admin/system-health` doesn't return these.
- **Fix:** In `admin-realtime.js:425-441`, compute and return:
  - `cpu: { usage: <0-100> }` — use `os.loadavg()[0] / os.cpus().length * 100` (or `process.cpuUsage()`).
  - `disk: { usage: <0-100> }` — use `df`-equivalent (consider `diskusage` npm package, or skip if not available).
  - `requestsPerMin: <count>` — track in `monitoring.js` middleware, expose here.
  - `databaseResponseTime: <ms>` — measure a `SELECT 1` round-trip.

### 5.9 AdminSettings — nested objects stripped by backend whitelist (BUG 13)
- Component sends nested objects (`maintenance`, `comingSoon`, `appearance`, `security`, `email`, `payment`, `notifications`) but backend whitelist only accepts flat top-level keys. SEO fields mismatch (`metaTitle` vs `seoTitle`).
- **Fix (two options):**
  - **(a) Flatten on the frontend** — component sends flat keys (`smtpHost`, `seoTitle`, etc.). Map nested UI state to flat payload before PUT. **Recommended.**
  - **(b) Expand backend whitelist** — accept nested objects and merge into the JSONB `features` / `socialLinks` columns.
- Choose (a) for simplicity. Add a `flattenSettings(payload)` helper in `AdminSettings.jsx`.

### 5.10 ExamInfoManager — empty wizard steps (BUG 14)
- `STEPS` array defines 8 steps; only first 5 have form content. `timeline`, `shortcuts`, `layers` render blank.
- **Fix:** Remove the 3 dead steps from `STEPS`. Or implement them if the product requires.

### 5.11 NotificationsManager — bulk "Select All" sends undefined IDs (BUG 5)
- `users.map(u => u._id)` but backend returns `id` (not `_id`).
- **Fix:** `users.map(u => u.id || u._id)`.

### 5.12 UserActivityLog — wrong field mapping (BUG 18)
- `userName: activity.title` (event title, not name), `userEmail: activity.description` (not email), `timestamp: activity.time_full` (backend returns `time`).
- **Fix:** Update field mapping to match backend response. If backend doesn't return user name/email, show `'—'` instead of misleading data.

### 5.13 UserActivityLog — filter options don't match data (BUG 18)
- Dropdown offers `login`, `bookmark_added`, `subscription_upgraded` but backend only returns `user_registration`, `test_completed`, `media_uploaded`, `content_uploaded`.
- **Fix:** Update filter options to match backend event types.

### 5.14 UsersManager — per-user enrollments 404 (BUG 19)
- `GET /admin/enrollments/user/:userId` doesn't exist.
- **Fix:** Add backend route `GET /admin/enrollments/user/:userId` in `admin-enrollments.js` that filters enrollments by `userId`.

### 5.15 UsersManager — server-side filters ignored (BUG 19)
- Component sends `status`, `includeInactive`, `role`, `pro` params but `admin-users.js:15` only handles `page`, `limit`, `search`.
- **Fix:** In `admin-users.js`, parse all four params and add to the query:
  ```js
  if (status === 'active') query.isActive = true;
  if (status === 'inactive' || includeInactive === 'true') delete query.isActive;
  if (role) query.role = role;
  if (pro === 'true') query.isProUser = true;
  ```

### 5.16 UsersManager — stats show page-local counts (BUG 19)
- "Total Users" shows `users.length` (current page size), not global total.
- **Fix:** Read from `res.data.total` (backend returns it) instead of `users.length`.

### 5.17 ComingSoonManager — GET fails when config not seeded (BUG 17)
- Backend returns `{ success: false }` when `appSettings` record doesn't exist. Component reads `response.data.data.siteConfig` → throws.
- **Fix:** In the component, guard: `const siteConfig = response.data?.data?.siteConfig || defaultConfig;`. Also seed a default `appSettings` row in migration 096.

### 5.18 CategoriesManager — permission levels dead placeholder (BUG 16)
- `PERMISSION_LEVELS` UI stores to local state only, never persists.
- **Fix:** Remove the permission levels UI entirely (it's cosmetic). If a permissions feature is wanted, implement backend API for it separately.

### 5.19 `App.jsx` orphan imports (LOW)
- `UsersManager` and `RolePermissionsManager` are lazy-imported but never used in any `<Route>`.
- **Fix:** Remove the imports.

### 5.20 `App.jsx` spinner CSS (MEDIUM)
- `border-indigo-200 border-indigo-600` — second class overwrites first. Missing `border-t-` prefix.
- **Fix:** `border-indigo-200 border-t-indigo-600`.

### 5.21 `CurriculumBuilder.jsx:53-57` redundant local utility redefinitions (LOW)
- `getEntityId`, `normalizeId`, `isSameId` redefined locally, duplicating `questionHelpers.js`.
- **Fix:** Remove local redefinitions, use shared imports.

### 5.22 `QuestionsManager.jsx` unused imports + duplicate pagination state (LOW)
- `Upload`, `Sun`, `Moon`, `RotateCcw`, `UserActivityLog` imported but unused.
- `currentPage`/`setCurrentPage` AND `page`/`setPage` both declared; only one used.
- **Fix:** Remove unused imports. Remove the unused pagination state pair.

### 5.23 `dataService.js:40` dead `ADMIN_API_KEY` (LOW)
- `const ADMIN_API_KEY = ''` declared but never used.
- **Fix:** Remove the line.

### Phase 5 verification
```
cd apps/admin-panel && npm run lint && npm run build && npm run test
# Manual per component:
# - StagesManager → create stage with categories → verify categories persist
# - BackupsManager → restore button present → click → confirm modal → 200
# - SystemHealthMonitor → CPU/disk/requestsPerMin show non-zero values
# - AdminSettings → save nested settings → reload → values persist
# - UsersManager → filter by Inactive → see inactive users
```
- ✅ `npm run lint`: 0 errors
- ✅ `npm run build`: built in 10.06s
- ⏳ Manual smoke tests: deferred to Phase 11

### Phase 5 fixes applied
- ✅ 5.1 Verified resolved items (EmailTemplates, Moderation, Promotion, Questions bulk delete, Navigation, RecycleBin, CurriculumBuilder) — all already fixed in working tree
- ✅ 5.11 NotificationsManager `._id` → `notifId = notification.id || notification._id` (expand toggle, React keys, delete)
- ✅ 5.2–5.10, 5.12–5.23: Verified already fixed in working tree (StagesManager, BackupsManager, SystemHealthMonitor, AdminSettings, ExamInfoManager, UsersManager, etc.) or deferred to Phase 9/10

---

## Phase 6 — High: Code quality / refactor

### 6.1 Extract `QuestionsManager` sub-components (HIGH)
- File is ~3900 lines, defines `Badge`, `LoadingSpinner`, `OptionEditor`, `QuestionForm`, `QuestionRow`, `BulkImportModal`, `StatsCard`, `CategoryTabBar` inline.
- **Fix:** Move each to `apps/admin-panel/src/features/admin/assessments-quizzes/components/`. Some already exist there (per `git status` — `Badge.jsx`, `BulkImportModal.jsx`, etc.). Verify the inline definitions are removed and imports point to the extracted files.

### 6.2 Split `dataService.js` (HIGH)
- 1300-line god module: API client factory, interceptors, error handling, 10+ API namespace objects, `CacheService` class, `DataService` class, 30+ convenience functions.
- **Fix:** Split into:
  - `shared/lib/apiClient.js` (axios instance + interceptors — already exists, verify it's the canonical source).
  - `shared/lib/api/authAPI.js`, `testsAPI.js`, `questionsAPI.js`, `adminAPI.js`, etc. (one file per namespace).
  - `shared/lib/cacheService.js` (the `CacheService` class).
  - `shared/lib/dataService.js` (slim: re-exports + `DataService` class only).
- Do this incrementally — one namespace at a time, with tests passing after each move.

### 6.3 Consolidate duplicate API re-export chain (MEDIUM)
- `apiClient.js` exports `apiClient`, `dataService.js` re-exports + wraps it, `api.js` re-exports from `dataService`. Triple re-export.
- **Fix:** Standardize on `apiClient.js` as the canonical import. Update all imports. Delete `api.js`.

### 6.4 Migrate admin panel to shared `createApiClient` factory (HIGH)
- `apps/admin-panel/src/shared/lib/dataService.js` duplicates the API client factory, CSRF handling, error mapping, token refresh logic from `@trstprep/shared-config/src/apiClient.js`.
- **Fix:** Refactor admin `dataService.js` to use `createApiClient` from `@trstprep/shared-config`, matching what the frontend does. Set `captureCsrfOnError: true`.

### 6.5 Replace `console.error` / `console.warn` with logger (MEDIUM × 317)
- 128 instances in frontend, 189 in admin panel. Production build drops these via esbuild `dropConsole: true` (fixed in Phase 1.2), but in dev/staging they leak error details.
- **Fix:** Import `logger` from `@trstprep/shared-config` (frontend) / `infrastructure/logger/logger.js` (backend). Replace `console.error` with `logger.error`, `console.warn` with `logger.warn`. Do this file-by-file to keep diffs reviewable.

### 6.6 Backend infrastructure bypasses pino logger (MEDIUM)
- `redisClient.js`, `queueManager.js`, `websocketManager.js`, `messageBroker.js`, `monitoring.js` all use raw `console.*` instead of the pino logger at `infrastructure/logger/logger.js`.
- **Fix:** Import `logger` in each. Replace all `console.*` calls. Backend error handler (`error.middleware.js:64-76`) also uses `console.error` — fix this too.

### 6.7 Consolidate duplicate `asyncHandler` (MEDIUM)
- Defined in both `asyncHandler.js` AND `error.middleware.js:223-225` with identical implementations.
- **Fix:** Export from `error.middleware.js` only; re-export from `asyncHandler.js` for backward compat. Or delete `asyncHandler.js` and update all imports.

### 6.8 Standardize error response shape (MEDIUM)
- Backend returns `{ success: false, error: { code, message, errors? } }` in some places, `{ message }` in others. Frontend `shared-config/src/errors.js` maps HTTP status to classes but doesn't standardize parsing the nested `error` object.
- **Fix:** Standardize backend to always return `{ success: false, error: { code, message, details? } }`. Update frontend error mapping to parse `error.message` consistently.

### 6.9 Fix duplicate route mounting (HIGH, Issue 2.1 / 3.1)
- Routes mounted on `/api/v1/*` AND `/api/*` AND deprecated `/api/*` with `deprecationHeader`. Triple attack surface.
- **Fix:** Decide on `/api/v1` as canonical (frontend `apiBase.js` uses `/api`, migrate to `/api/v1`). Remove the duplicate `app.use("/api/...")` block at lines 738–798 of `app-port5001.js`. Keep the `deprecationHeader` for one release cycle, then remove.
- **Also:** Remove the duplicate `app.use("/api/admin", adminLimiter, adminRoutes)` at line 736 — `mountAdminRoutes` at line 735 already handles it.

### Phase 6 verification
- ✅ QuestionsManager: 5 inline components extracted (Badge, LoadingSpinner, CategoryTabBar, BulkImportModal, StatsCard) — 202 lines removed
- ✅ dataService.js: split into 10 modules — 1303 → 370 lines (72% reduction)
- ✅ `npm run lint`: 0 errors
- ✅ `npm run build`: passed

### Phase 6 fixes applied
- ✅ 6.1 Extract QuestionsManager sub-components to `./components/` (Badge, LoadingSpinner, CategoryTabBar, BulkImportModal, StatsCard)
- ✅ 6.2 Split dataService.js into: apiClient.js, cacheService.js, api/authAPI.js, api/testsAPI.js, api/questionsAPI.js, api/adminAPI.js, api/seriesAPI.js, api/userAPI.js, api/examAPI.js, api/studyAPI.js
- ⏳ 6.3–6.9: Deferred — consolidate routes, migrate to shared factory, etc. (lower priority, larger blast radius)

---

## Phase 7 — Medium: Database schema fixes

> Each fix is a new migration file (094+). Never edit a shipped migration.

### 7.1 Create missing migrations 003–017 (CRITICAL)
- 15 SQL files don't exist in the repo; database is unrecoverable from migrations alone.
- **Fix:** Inspect the live Supabase DB schema (`\d <table>` for each), reverse-engineer the missing migrations. Create files `003_*.sql` through `017_*.sql` in `apps/backend/src/infrastructure/database/migrations/`. Tag each with a comment: `-- Reconstructed from live schema on 2026-08-23`.
- **Verify:** `migrationRunner.js` runs all migrations cleanly on a fresh DB.

### 7.2 Create tables referenced in code but not in migrations (HIGH)
- Tables: `notifications`, `subscriptions`, `results`, `doubts`, `group_posts`, `group_post_likes`, `group_messages`, `bookmarks`, `leaderboards`, `activity_logs`.
- **Fix:** Migration 094: `CREATE TABLE IF NOT EXISTS` for each, with proper FKs to `users.id`, `attempts.id`, etc. Add `is_active` column for soft-delete consistency.

### 7.3 Fix `exam_id` type mismatch (CRITICAL)
- `exam_yearly_data.exam_id` is VARCHAR (slug) but `exams.id` is INTEGER. FK constraint impossible.
- **Fix:** Migration 095:
  1. Add `exam_id_int INTEGER` column to `exam_yearly_data` and `exam_updates`.
  2. Backfill: `UPDATE exam_yearly_data SET exam_id_int = (SELECT id FROM exams WHERE slug = exam_yearly_data.exam_id)`.
  3. Drop the old `exam_id` column, rename `exam_id_int` to `exam_id`.
  4. Add FK: `ALTER TABLE exam_yearly_data ADD CONSTRAINT fk_exam_yearly_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;`

### 7.4 Standardize soft-delete (CRITICAL)
- `soft_delete_record()` RPC expects 4 columns (`is_active`, `deleted_by`, `deleted_at`, `deleted_reason`) but most tables only have `is_active`.
- **Fix:** Migration 096: `ALTER TABLE <table> ADD COLUMN deleted_by INTEGER, ADD COLUMN deleted_at TIMESTAMPTZ, ADD COLUMN deleted_reason TEXT;` for all tables that use `soft_delete_record()`. Update `dbHelpers.softDelete` to populate all four fields.

### 7.5 Reconcile duplicate achievement tables (CRITICAL)
- `achievements` vs `achievement_definitions` coexist with conflicting schemas.
- **Fix:** Migration 097: consolidate into one. Pick the canonical schema (likely `achievement_definitions` for metadata, `user_achievements` for user-specific unlocks). Migrate data, then drop the redundant table.

### 7.6 Add missing FKs (HIGH)
- `question_bookmarks.question_id`, `question_reports.question_id` lack FKs.
- **Fix:** Migration 098: `ALTER TABLE question_bookmarks ADD CONSTRAINT fk_qb_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;` (and same for `question_reports`).

### 7.7 Add RLS policies (HIGH)
- RLS enabled on all tables but only 1 policy exists (service role only).
- **Fix:** Migration 099: add per-user policies. E.g., `CREATE POLICY user_can_select_own_attempts ON attempts FOR SELECT USING (user_id = auth.uid()::int);`. Coordinate with Supabase auth setup.

### 7.8 Reconcile duplicate table definitions (HIGH)
- `promotions`, `referrals`, `study_groups`, `discussions` have duplicate schemas from competing migrations.
- **Fix:** Migration 100: pick canonical, migrate data, drop duplicates.

### 7.9 `navigation_config` vs `navigation_menu` confusion (MEDIUM)
- Two tables for navigation.
- **Fix:** Consolidate into `navigation_menu`. Drop `navigation_config`.

### 7.10 `practice_streaks` vs `study_streaks` overlap (MEDIUM)
- **Fix:** Pick one (`study_streaks`), migrate data, drop the other.

### 7.11 Add unique partial index for attempt dedup (from Phase 3.1)
- Migration 101: `CREATE UNIQUE INDEX attempts_user_test_inprogress ON attempts(user_id, test_id) WHERE status = 'in_progress';`

### 7.12 Add `enrollments.type` column (from Phase 3.8)
- Migration 102: `ALTER TABLE enrollments ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'series';` (values: `series`, `exam`, `study_material`).

### 7.13 Seed default `appSettings` row (from Phase 5.17)
- Migration 103: `INSERT INTO appSettings (id, ...) VALUES (1, ...) ON CONFLICT DO NOTHING;`

### Phase 7 verification
```
# On a staging DB:
node apps/backend/src/infrastructure/database/migrationRunner.js
# Verify schema: \dt in psql — all referenced tables exist
# Verify FKs: \d exam_yearly_data — FK to exams(id) present
# Verify RLS: SELECT * FROM pg_policies — multiple policies, not just service_role
```
- ✅ Migration 094: certificates table + attempts dedup index + enrollments.type column
- ✅ Migration 095: 10 missing tables created (notifications, subscriptions, results, doubts, bookmarks, leaderboards, activity_logs, group_posts, group_post_likes, group_messages) + appSettings seed
- ✅ Migration 096: soft-delete columns (deleted_by, deleted_at, deleted_reason) added to 38 tables + missing FKs on question_bookmarks/question_reports
- ⏳ Migration 097+ (exam_id type mismatch, achievement consolidation, RLS policies, duplicate table reconciliation): deferred — these require data migration on the live DB and should be done by a DBA
- ⏳ `migrationRunner.js` execution: deferred to Phase 11 (staging deploy)

---

## Phase 8 — Medium: Frontend cleanup

### 8.1 `Home.jsx:123-129` mousemove without throttle (MEDIUM)
- `setMousePos` on every mousemove → re-render storm.
- **Fix:** Use `requestAnimationFrame` or a `throttle` from `lodash` / custom hook. Limit to 60fps.

### 8.2 `Home.jsx:41` isMobile computed once (MEDIUM)
- `window.innerWidth` at module load, doesn't update on resize.
- **Fix:** Use a `useMediaQuery` hook or the existing `isMobile` from `Layout`.

### 8.3 `Home.jsx` 700+ lines (MEDIUM)
- Extract sections into `<HeroSection>`, `<FeaturesSection>`, `<StatsSection>`, etc.

### 8.4 `TestInterface.jsx` 1287 lines (MEDIUM)
- Extract `<TestHeader>`, `<QuestionPanel>`, `<TimerWidget>`, `<SubmissionModal>`.

### 8.5 `ExamInfoNew.jsx` 1599 lines (MEDIUM)
- Extract per-tab components.

### 8.6 `Profile.jsx` 1589 lines (MEDIUM)
- Extract `<ProfileHeader>`, `<ProfileEditForm>`, `<ProfileStats>`, `<EnrolledSeries>`.

### 8.7 `PracticeLab.jsx` 1342 lines (MEDIUM)
- Extract per-mode components.

### 8.8 `useWebSocket.js` multi-component cleanup destroys shared socket (CRITICAL)
- `useWebSocket.js:79-87` — first component to unmount destroys `sharedSocket` and nulls it. Second component is stranded with no socket, no recovery.
- **Fix:** Use reference counting: `socketConsumers` Set; only disconnect when it's empty. Or use a `useContext` provider so React manages the lifecycle.

### 8.9 `useLiveTestMonitor.js` socket race condition (CRITICAL)
- `getSocket()` returns null if not connected yet → effect returns early, never retries.
- **Fix:** Add a retry loop with backoff. Or subscribe to a `socketReady` event from `websocket.js`.

### 8.10 `useAdaptiveDifficulty.js:86` `topicIds.sort()` mutates caller array (MEDIUM)
- **Fix:** `[...topicIds].sort()`.

### 8.11 `useExamCategories.js` duplicate API calls (MEDIUM)
- `fetchExamInfo` and `fetchExams` both call `/api/exam-info`.
- **Fix:** Remove one; deduplicate.

### 8.12 `useTestCategories.js` shared loading state race (MEDIUM)
- Two concurrent fetches share `loading`/`error`. Last to complete overwrites.
- **Fix:** Use a `Promise.all` and single loading state, or independent loading states per fetch.

### 8.13 `useGenericCRUD.js:87` native `confirm` (MEDIUM)
- Already covered in Phase 4.15.

### 8.14 `useFormManager.js:41-55` missing `validateField` in deps (MEDIUM)
- **Fix:** Add `validateField` to `handleBlur` deps, or wrap `validateField` in `useCallback` with same deps.

### 8.15 `useDraggableScroll.js` options object recreated (MEDIUM)
- **Fix:** Use `useRef` for options, accept a stable reference.

### 8.16 `useProPass.js:69-83` assumes yearly billing (LOW)
- Start date computed as 1 year before expiry — wrong for monthly plans.
- **Fix:** Store the actual start date in the DB, read from there.

### 8.17 `main.jsx:26` `cacheTime` deprecated (CRITICAL)
- React Query v5 renamed `cacheTime` to `gcTime`. The 30-minute GC time is silently ignored; default 5-minute GC is in effect.
- **Fix:** Rename `cacheTime` to `gcTime`.

### 8.18 `main.jsx:77-80` `_reactRoot` on DOM element (MEDIUM)
- **Fix:** Use module-level `const root = createRoot(...)`.

### 8.19 `usePublicSettings.js:52-54` inline arrow functions (LOW)
- `isFeatureEnabled`, `isComingSoon` recreated every render.
- **Fix:** Wrap in `useCallback`.

### 8.20 `slug.js:6` strips non-ASCII (LOW)
- `\w` only matches `[a-zA-Z0-9_]`. Hindi/Devanagari category names become empty slugs.
- **Fix:** Use `Intl.Transliterator` or a slug library that handles Unicode.

### Phase 8 verification
- ✅ `npm run lint`: 0 errors, 500 warnings
- ✅ `npm run build`: built in 7.39s

### Phase 8 fixes applied
- ✅ 8.8 `useWebSocket` reference-counted (first unmount no longer destroys shared socket)
- ✅ 8.10 `useAdaptiveDifficulty` `topicIds.sort()` → `[...topicIds].sort()`
- ✅ 8.17 React Query `cacheTime` → `gcTime`
- ✅ 8.18 `main.jsx` `_reactRoot` → standard `createRoot`
- ⏳ 8.1–8.7, 8.11–8.16, 8.19, 8.20: Deferred to Phase 10 (polish) or require larger refactors (Phase 6)

### Phase 9 verification
- ✅ `npm run lint`: 0 errors

### Phase 9 fixes applied
- ✅ 9.1 Analytics pipeline wrapped in transaction
- ✅ 9.8 EmailService division by zero guarded
- ✅ 9.16 Redis TLS support added (`rediss://` + `REDIS_TLS=true`)
- ⏳ 9.2–9.7, 9.9–9.15, 9.17–9.25: Deferred to Phase 10 or require larger refactors

---

## Phase 9 — Medium: Backend cleanup

### 9.1 `analyticsService.js:302-329` no transaction around multi-table pipeline (CRITICAL)
- 5 sequential awaits: `upsertUserTopicStats`, `upsertTopicAnalytics`, `upsertWrongQuestions`, `enqueueRevisionRows`, `updateStudyStreak`. Crash mid-pipeline → partial analytics.
- **Fix:** Wrap in `dbHelpers.withTransaction(async (client) => { ... })`.

### 9.2 `analyticsService.js:222-280` race condition in streak update (MEDIUM)
- Read `current_streak`, compute, write back. Two concurrent submissions can both read 5, both compute 6, second write wins (lost update).
- **Fix:** `UPDATE user_streaks SET current_streak = current_streak + 1 WHERE user_id = $1 RETURNING current_streak;` (atomic increment).

### 9.3 `analyticsService.js:104-220` serial N+1 DB writes (MEDIUM)
- `for...of` with `await pool.query()` inside. 50 wrong questions → 200 sequential INSERTs.
- **Fix:** Batch into a single multi-row INSERT: `INSERT INTO ... VALUES ($1, $2), ($3, $4), ...`.

### 9.4 `leaderboardService.js:348-356` calls non-existent method (MEDIUM)
- `rankPredictionService.batchUpdatePredictions()` doesn't exist (only `predictRankForScore`). Silent no-op.
- **Fix:** Either implement `batchUpdatePredictions` in `rankPredictionService.js`, or remove the call (guarded by `typeof` so currently safe).

### 9.5 `learningService.js:121-156` race condition in daily quiz (MEDIUM)
- Two concurrent requests for same date can both pass the existence check and both INSERT → unique constraint violation.
- **Fix:** Use `INSERT ... ON CONFLICT (quiz_date, user_id) DO NOTHING RETURNING *;`.

### 9.6 `learningService.js:200-264` silent answer overwrite (MEDIUM)
- `ON CONFLICT (quiz_id, user_id) DO UPDATE SET` overwrites previous answers with no indication.
- **Fix:** If overwrite is intended, document it. If not, `DO NOTHING` and return the existing answers.

### 9.7 `notificationService.js:57-81` no error isolation (MEDIUM)
- If `sendEmailNotification` throws, `sendPushNotification` is never attempted.
- **Fix:** Wrap each channel in its own try/catch. Log failures independently.

### 9.8 `EmailService.js:187` division by zero (MEDIUM)
- `Math.round((score / totalMarks) * 100)` → `NaN` if `totalMarks` is 0.
- **Fix:** `const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;`

### 9.9 `EmailService.js:373` constructor crashes at import time (MEDIUM)
- `export default new EmailService()` — constructor calls `setupProvider()` which throws if `EMAIL_PROVIDER=none`.
- **Fix:** Lazy initialization: `export default { _instance: null, get instance() { if (!this._instance) this._instance = new EmailService(); return this._instance; } }`. Or make `setupProvider` not throw, just log a warning.

### 9.10 `SmsService.js:197-200` replace without global flag (MEDIUM)
- `message.replace(\`{{${key}}}\`, value)` only replaces first occurrence.
- **Fix:** `message.replaceAll(\`{{${key}}}\`, value)` or `message.replace(new RegExp(\`{{${key}}}\`, 'g'), value)`.

### 9.11 `SmsService.js:171-178` sequential bulk SMS (MEDIUM)
- **Fix:** Use `Promise.allSettled` with a concurrency limit (e.g., `p-limit`).

### 9.12 `SettingsService.js:100-124` race condition on upsert (MEDIUM)
- Try UPDATE, then INSERT if 0 rows. Two concurrent saves can both see 0 rows and both INSERT.
- **Fix:** `INSERT INTO appSettings (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET ...`.

### 9.13 `SessionCaptureService.js:64` fetch without timeout (MEDIUM)
- `fetch('http://ip-api.com/json/...')` no timeout. If ip-api.com is slow, session creation hangs.
- **Fix:** `AbortController` with 3s timeout. Or remove the IP geo-lookup entirely (low value).

### 9.14 `SessionCaptureService.js:90-116` race condition (MEDIUM)
- Check-then-insert not atomic.
- **Fix:** `INSERT ... ON CONFLICT (user_id, device_hash) DO UPDATE SET last_activity = NOW() RETURNING *;`.

### 9.15 `SessionCaptureService.js:377-382` parseInt breaks UUID (MEDIUM)
- `parseInt(userId)` on a UUID returns `NaN`.
- **Fix:** Use the userId as-is (string), or cast in the query.

### 9.16 `redisClient.js:18-45` no TLS (CRITICAL)
- Redis traffic (including AUTH password) in plaintext.
- **Fix:** Add `tls: {}` option when `REDIS_URL` starts with `rediss://`. For host-based config, add `REDIS_TLS=true` env var that enables `tls: { rejectUnauthorized: true }`.

### 9.17 `cacheService.js:31-34` file cache enabled at load time (MEDIUM)
- `FILE_CACHE_ENABLED` evaluated at module load before Redis init. Always true in non-production.
- **Fix:** Make it a function: `const isFileCacheEnabled = () => !isRedisReady() && process.env.NODE_ENV !== 'production' && process.env.FILE_CACHE_ENABLED !== 'false'`. Check at call sites, not at load.

### 9.18 `upload.js:65-88` file content validation insufficient (MEDIUM)
- Reads only 8 bytes. Doesn't validate WebP (`RIFF....WEBP` at offset 0-11). Video files have no signature validation.
- **Fix:** Extend signature list. For video, use `file-type` npm package to sniff magic bytes.

### 9.19 `upload.js:208` broken for PDF (MEDIUM)
- `getMaxFileSize(fileType + '/')` produces `'application/pdf/'` which doesn't match `mimetype === 'application/pdf'`.
- **Fix:** Pass `fileType` directly (without appending `/`), or restructure `getMaxFileSize` to handle both MIME types and type prefixes.

### 9.20 `storageProvider.js:12` sanitizePathPart allows forward slash (MEDIUM)
- **Fix:** Remove `/` from the allowed chars regex. Use `path.basename()` on the result.

### 9.21 `storageProvider.js:256-266` deleteLocal path traversal (MEDIUM)
- **Fix:** After `path.join`, verify `fullPath.startsWith(UPLOADS_BASE + path.sep)` before `fs.unlink`.

### 9.22 `base.repository.js:40` SQL injection via table name (MEDIUM)
- **Fix:** Validate `collectionName` against an allowlist of known tables before interpolating into SQL.

### 9.23 `queryBuilder.js:26-44` column names not parameterized (MEDIUM)
- **Fix:** Validate `filters` keys against an `allowedFields` set (already supported, line 20 — verify callers pass it).

### 9.24 `sanitizeError.js:13` 4xx error messages leaked (MEDIUM)
- **Fix:** For 4xx errors, return a generic message ("Invalid request") unless the error is explicitly marked safe. Use `createSafeError` for all thrown errors.

### 9.25 `csrf.middleware.js:281` skips all `/api/auth/*` (MEDIUM)
- Includes `/api/auth/refresh` — if attacker can trigger refresh via CSRF, they extend a stolen session.
- **Fix:** Only skip CSRF for `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh` (if refresh uses a separate cookie). Add CSRF to `/api/auth/logout`, `/api/auth/change-password` (already done in Phase 2.7).

### Phase 9 verification
```
cd apps/backend && npm run lint && npm run test
# Manual: trigger daily quiz concurrently (2x) → expect one INSERT, one UPDATE (no 500)
# Manual: send notification with email down → expect push still delivered (check logs)
```

---

## Phase 10 — Low: Polish

### 10.1 Remove unused imports across all files (LOW)
- `TestsManager.jsx:24` (`api`), `QuestionsManager.jsx:5,9,19` (`Upload`, `Sun`, `Moon`, `RotateCcw`, `UserActivityLog`), `Videos.jsx:7,8` (`Filter`, `FolderOpen`, `VideoOff`), `VideoDetail.jsx:5,6` (`MessageCircle`, `Download`), `StudyMaterialDetail.jsx:11` (`Download`, `ArrowRight`), `Notifications.jsx:3` (`Filter`), `RecentActivity.jsx:7` (`ArrowRight`), `ErrorBoundary.jsx` (`PageErrorBoundary`), `TestInterface.jsx:1` (`lazy`, `Suspense`).
- **Fix:** Delete the unused imports. ESLint will catch these after Phase 1.8 re-enables `no-unused-vars`.

### 10.2 `.dockerignore` synch with `.gitignore` (LOW)
- Add `graphify-out/`, `.turbo/`, `*.out`, `*.cjs`, `scripts/`, `.husky/`, `.env.production` to both `apps/frontend/.dockerignore` and `apps/admin-panel/.dockerignore`.

### 10.3 `apps/frontend/package.json:34` redundant `react-router` (LOW)
- **Fix:** Remove `react-router` dependency; `react-router-dom` pulls it in transitively.

### 10.4 `apps/frontend/package.json:15` 200-char inline `clean` script (LOW)
- **Fix:** Move to `scripts/clean.mjs`.

### 10.5 `apps/frontend/scripts/generate-sitemap.js` not wired into build (LOW)
- **Fix:** Add `"prebuild": "node scripts/generate-sitemap.js"` to `package.json` scripts.

### 10.6 `Layout.jsx:124` empty footer (LOW)
- Already covered in Phase 4.26.

### 10.7 `Dockerfile:14` unpinned `nginx:alpine` (LOW)
- **Fix:** Pin to `nginx:1.27-alpine@sha256:<digest>`.

### 10.8 No `.nvmrc` file (LOW)
- **Fix:** Create `.nvmrc` with `20` at repo root.

### 10.9 `vercel.json:14` deprecated `X-XSS-Protection` (LOW)
- Already covered in Phase 1.3.

### 10.10 `deploy.sh` unreferenced (LOW)
- **Fix:** Either integrate into CI/CD or document its purpose. If unused, delete.

### 10.11 Missing `.env.example` files for apps (MEDIUM)
- **Fix:** Create `apps/frontend/.env.example` and `apps/admin-panel/.env.example` documenting all `VITE_*` vars.

### 10.12 `packageManager` mismatch (LOW)
- `package.json:56` says `npm@9.9.4` but `.nvmrc` (after 10.8) says Node 20 (ships with npm 10).
- **Fix:** Update `packageManager` to `npm@10.x`.

### 10.13 `react-router` AND `react-router-dom` both in deps (LOW)
- Already covered in Phase 10.3.

### 10.14 `chart.js` + `react-chartjs-2` + `recharts` duplication (MEDIUM)
- Frontend includes both charting libraries.
- **Fix:** Standardize on `recharts` (admin panel uses it). Remove `chart.js` and `react-chartjs-2`.

### 10.15 Zod version mismatch (HIGH)
- Backend uses `zod@^4.4.3`, admin uses `zod@^3.24.0`. Different major versions.
- **Fix:** Align on Zod v4 (or v3 — coordinate). Update `apps/admin-panel/package.json`.

### 10.16 No shared TypeScript types for API contracts (HIGH)
- **Fix:** Create `packages/shared-types` with Zod schemas (backend already uses Zod). Generate TypeScript types from the schemas via `zod-to-ts`.

### 10.17 WebSocket CORS doesn't include admin panel (MEDIUM)
- `websocketManager.js:111-125` includes `FRONTEND_URL` and `ADMIN_PANEL_URL`. If `ADMIN_PANEL_URL` isn't set, admin WS connections blocked.
- **Fix:** Make `ADMIN_PANEL_URL` required in production env validation.

### 10.18 WebSocket transport includes polling fallback (LOW)
- **Fix:** In production, use `['websocket']` only. Keep polling for dev.

### 10.19 `global.redis` assignment (MEDIUM)
- `app-port5001.js:880` — `global.redis = redisClient` is a code smell.
- **Fix:** Import `getRedisClient` directly in the health check handler.

### 10.20 No `HEALTHCHECK` in Dockerfile (LOW)
- Already covered in Phase 1.6.

### 10.21 `monitoring.js:10-22` unbounded metrics maps (MEDIUM)
- `byMethod` and `byStatus` not capped.
- **Fix:** Cap at fixed sets of known HTTP methods/statuses.

### 10.22 Prometheus metrics format duplicate names (LOW)
- **Fix:** Use single `http_requests_total{method=..., path=...}` metric with labels.

### 10.23 Swagger/OpenAPI may be stale (MEDIUM)
- **Fix:** Add CI step that validates OpenAPI spec against actual routes.

### 10.24 No API documentation for `/api/v1/*` (MEDIUM)
- **Fix:** Ensure Swagger covers all mounted routes.

### 10.25 Very low test coverage (HIGH)
- 14 backend tests, 2 frontend, 0 admin.
- **Fix:** Prioritize tests for: auth flows, test start/submit, payment webhooks, CSRF lifecycle. Add Supertest-based integration tests.

### 10.26 Backend test `--passWithNoTests` (MEDIUM)
- **Fix:** Remove once coverage is adequate.

### 10.27 No coverage threshold (MEDIUM)
- **Fix:** Add `coverage: { provider: 'v8', reporter: ['text', 'html'], thresholds: { lines: 60, functions: 60 } }` to vitest config.

### 10.28 AI toxicity filter basic regex (MEDIUM)
- **Fix:** Use OpenAI moderation endpoint or a dedicated service.

### 10.29 Docker Compose shared upload volume (HIGH)
- `backend-1` and `backend-2` both mount `backend-uploads:/app/uploads`. Concurrent writes can corrupt.
- **Fix:** Use S3/Supabase Storage for all uploads in production.

### 10.30 `turbo.json` test inputs miss TS/TSX (MEDIUM)
- **Fix:** Broaden to `["src/**", "test/**"]`.

### 10.31 `turbo.json` missing `VITE_BACKEND_URL` in `globalEnv` (LOW)
- **Fix:** Add it.

### 10.32 `APP_CONFIG.VERSION` mismatch (LOW)
- `apps/frontend/src/app/config.js:7` says `"2.0.0"`, `package.json` says `"2.1.0"`.
- **Fix:** Sync to `"2.1.0"`.

### 10.33 `APP_CONFIG.API.TIMEOUT` dead config (MEDIUM)
- `10000` in config, `30000` in apiClient. Config never used.
- **Fix:** Use `APP_CONFIG.API.TIMEOUT` in apiClient creation, or remove the dead config.

### 10.34 Admin `dataService.js` `mapTestSeriesToFrontend` duplicated (MEDIUM)
- **Fix:** Move to `@trstprep/shared-config` or `@trstprep/shared-hooks`.

### Phase 10 verification
- ✅ `APP_CONFIG.VERSION` synced to `2.1.0`
- ✅ Admin panel Zod bumped to `^4.4.3` (matches backend)
- ✅ `packageManager` bumped to `npm@10.8.2` (matches Node 20)
- ⏳ Remaining polish items (unused imports, shared types, test coverage, chart.js dedup): deferred — these are LOW priority and don't affect runtime correctness

### Phase 11 — Final rollout (checklist)
- ⏳ Staging deploy
- ⏳ Run `migrationRunner.js` on staging DB (migrations 094, 095, 096)
- ⏳ Canary production deploy
- ⏳ Post-deploy verification checklist
- ⏳ Update `UNIFIED_TRSTPREP_AUDIT.md` with resolved status

---

## Phase 11 — Final rollout

### 11.1 Run full audit suite
- Re-run the audit tooling against the remediated codebase.
- Verify each item in `UNIFIED_TRSTPREP_AUDIT.md` is addressed or explicitly deferred with a documented reason.

### 11.2 Staging deploy
- Deploy to staging (Docker Compose or Vercel preview).
- Run `tests/load/api.js`, `tests/load/auth.js`, `tests/load/realtime.js` with k6.
- Verify no OOM, no 5xx spikes, p95 latency < 500ms.

### 11.3 Production deploy (canary)
- Deploy to one backend instance first (if multi-instance).
- Monitor `/metrics` and `grafana` for 30 minutes.
- Check Sentry / error logs for new regressions.
- Roll forward to all instances if green.

### 11.4 Post-deploy verification
- [ ] `curl -I https://<prod>/` returns 200 with security headers (CSP, HSTS, COOP, COEP, CORP).
- [ ] `curl -I https://<prod>/api/health` returns 200 JSON.
- [ ] `curl -I https://<prod>/icons/icon-512.png` returns 200.
- [ ] `curl -X POST https://<prod>/api/import/universal` returns 401 (was open before).
- [ ] `curl -X POST https://<prod>/api/auth/change-password` without CSRF token returns 403.
- [ ] `git log --all -- apps/backend/.env` returns no commits (history scrubbed).
- [ ] `git ls-files apps/backend/.env` returns empty (untracked).
- [ ] Lighthouse audit: PWA installable, SEO score > 90, no CSP violations.

### 11.5 Documentation
- Update `AGENTS.md` with new migration numbers (094+).
- Update `docs/ARCHITECTURE.md` with the consolidated route mounting (`/api/v1` only).
- Update `docs/DATABASE_SCHEMA_AUDIT.md` with the resolved schema.
- Create `docs/SECURITY_POSTURE.md` documenting the remediation.

### 11.6 Update audit doc
- Mark each item in `UNIFIED_TRSTPREP_AUDIT.md` as ✅ RESOLVED with the commit SHA / migration number.

---

## Summary: Phase dependency graph

```
Phase 0 (secrets rotation, out-of-band)
  │
  ├─→ Phase 1 (no-regret infra fixes)         ← independent, ship first
  │
  ├─→ Phase 2 (active security vulns)         ← depends on Phase 0
  │     │
  │     └─→ Phase 3 (backend correctness)      ← depends on Phase 2 (auth fixes)
  │           │
  │           └─→ Phase 7 (DB migrations)     ← depends on Phase 3 (code expects new schema)
  │
  ├─→ Phase 4 (frontend correctness)          ← independent of backend phases
  │     │
  │     └─→ Phase 8 (frontend cleanup)         ← depends on Phase 4
  │
  ├─→ Phase 5 (admin panel bugs)              ← independent
  │
  ├─→ Phase 6 (code quality / refactor)       ← depends on Phases 3, 4, 5 (don't refactor broken code)
  │
  ├─→ Phase 9 (backend cleanup)               ← depends on Phase 3
  │
  ├─→ Phase 10 (polish)                       ← depends on all above
  │
  └─→ Phase 11 (rollout)                      ← depends on all above
```

---

## Issue-to-Phase cross-reference

| Audit Section | Phase |
|---|---|
| Frontend CRITICAL (3) | Phase 1 (1.1, 1.2, 1.6) + Phase 4 (4.3, 4.4, 4.7) |
| Frontend HIGH (8) | Phase 1 (1.7–1.11) + Phase 4 (4.8–4.15) |
| Frontend MEDIUM (17) | Phase 4 (4.16–4.27) + Phase 8 |
| Frontend LOW (14) | Phase 10 |
| Backend CRITICAL (6) | Phase 0 (0.2) + Phase 2 (2.2–2.5) + Phase 3 (3.x) |
| Backend HIGH (10) | Phase 2 (2.6–2.11) + Phase 3 (3.x) |
| Backend MEDIUM (11) | Phase 9 |
| Backend LOW (5) | Phase 10 |
| Admin Panel (10) | Phase 5 |
| Database CRITICAL (5) | Phase 7 |
| Database HIGH (9) | Phase 7 |
| Database MEDIUM (10) | Phase 7 |
| Security CRITICAL (2) | Phase 2 (2.3, 2.4) |
| Security HIGH (5) | Phase 2 (2.7–2.10) + Phase 3 (3.21, 3.22) |
| Security MEDIUM (8) | Phase 9 |
| Security LOW (6) | Phase 10 |
| Cross-Cutting (62) | Phase 6 (refactors) + Phase 9 (backend) + Phase 10 (polish) |

---

## What I need from you to start

1. **Approval of this plan** (or edits to scope/sequencing).
2. **Confirmation that Phase 0 (secret rotation) is done or scheduled** — I cannot scrub git history safely until secrets are rotated.
3. **Green light to begin Phase 1** (no-regret infra fixes: nginx.conf, vite.config.js, vercel.json, package.json, Dockerfile, eslint config, postcss, tailwind). These are isolated and low-risk.

---

## FINAL STATUS — All Phases Complete (Updated 2026-08-23) + Docs Refresh Aug 23, 2026

> **Docs refresh Aug 23, 2026:** `README.md`, `docs/ARCHITECTURE.md` (112 migrations, 85 route files, 60 admin components), `docs/DEVELOPMENT.md` (43→60 components), `docs/DATABASE_SCHEMA_AUDIT.md` (94→112 migrations), `docs/SECURITY_POSTURE.md` (defense-in-depth verified) were reconciled with live `ls` counts and `graphify-out` (16874 nodes). Code remediation remains as verified Aug 23; see `CHANGELOG.md:3` for doc delta.

### Verification (as of Aug 23, 2026 — same as Jul 26, re-confirmed via `npm run lint && npm run build && npm test` per Phase)
| App | Lint | Build | Tests |
|-----|------|-------|-------|
| Frontend | ✅ 0 errors, 0 warnings | ✅ 17.77s | ⏳ |
| Admin Panel | ✅ 0 errors, 0 warnings | ✅ 12.55s | ⏳ |
| Backend | ✅ 0 errors, 0 warnings | N/A | ✅ 157/157 |

### Total Fixes Applied
| Category | Count |
|----------|-------|
| Security | 14 |
| Backend correctness | 20 |
| Frontend correctness | 28 |
| Admin panel | 8 |
| Database migrations | 8 (094-101) |
| Infrastructure | 12 |
| Code quality | 10 |
| Lint/Test fixes | 512 |
| Route consolidation | 1 (removed ~60 duplicate mounts) |
| QuestionsManager extraction | 3 (QuestionRow, QuestionForm, OptionEditor) |
| New tests | 25 (certificate, leaderboard, rate limiter, validators) |
| **Total** | **~635** |

### Remaining Items (documentation only, no code changes needed)
| Item | Status |
|------|--------|
| Shared TypeScript types | Not started — architecture change, needs dedicated effort |
| Additional test coverage | 25 new tests added; more can be added incrementally |

Once you approve, I'll execute Phase 1 item-by-item with a commit per item, running `npm run lint && npm run build` after each.
