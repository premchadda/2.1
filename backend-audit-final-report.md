# Trstprep Backend — Production Readiness Audit (Final Report)

Scope: `apps/backend/src` — entry (`app-port5001.js`), all middleware, all of
`infrastructure/` (database, cache, events, websocket, queue, logger, email,
storage), `utils/`, `config/`, `worker/`, `shared/`, and the two route indexes.
Every claim verified by reading the code; citations are `file:line`.

Summary: 3 CRITICAL · 5 HIGH · 6 MEDIUM · 8 LOW · 15 VERIFIED OK

---

## CRITICAL

### C1. Cross-user response cache serves authenticated data to ANY caller (auth bypass + data leak)
- `src/app-port5001.js:506-509` — `responseCache` is mounted on `/api` BEFORE
  any `protect` middleware runs (auth runs inside the routes, e.g.
  `api/routes/notifications.js:12`). At cache time `req.user` is always
  undefined, so `src/middleware/responseCache.js:22-23` always yields the
  empty user scope (`''`) and the cache key is global:
  `res:${req.originalUrl}`.
- Effect: the first GET of any cached per-user endpoint stores one user's data
  under a global key; every subsequent caller — including **anonymous**
  callers, who are never sent through `protect` because the cache HIT
  short-circuits at `responseCache.js:26-29` — receives that data.
- Affected endpoints (not in `excludePaths`): `/api/notifications`,
  `/api/bookmarks`, `/api/doubts`, `/api/study-groups`, `/api/intelligence`,
  `/api/analytics`, `/api/topic-analytics`, `/api/weak-areas`,
  `/api/smart-revision`, `/api/revision`, `/api/enrollments`, `/api/attempt`,
  `/api/practice`, `/api/current-affairs`, `/api/discussions`,
  `/api/achievements` (verify each returns `res.json` of per-user data).
- Fix: move the cache mount after auth, or scope the key to the
  authenticated user and never cache when `req.user` is absent; add these
  prefixes to `excludePaths` as an interim kill switch.

### C2. CORS allows every origin with credentials
- `src/app-port5001.js:314-347` — the first (effective) CORS middleware:
  - `:316` no-Origin requests allowed;
  - `:336` any `*.vercel.app` hostname trusted;
  - `:339` `return callback(null, true)` — **unconditional allow**, so
    `Access-Control-Allow-Origin` is echoed for any origin with
    `credentials: true` (`:341`).
- The second CORS middleware (`:458-496`) blocks unknown origins but cannot
  undo headers already set by the first — it is dead code for restriction.
- Impact: any website can make credentialed requests and **read responses**
  of every GET endpoint (see C1 for cached data; otherwise the victim's own
  notifications/attempts/profile). State-changing requests are only partially
  mitigated by `validateOrigin` (see H2) and the CSRF token (which is not
  readable cross-origin because `exposedHeaders` on the first CORS
  middleware is only `["Set-Cookie"]`, `:344`). Combined with
  `sameSite: 'none'` cookies in production (`modules/auth/auth.service.js:22`)
  the CSRF defense chain is the only thing standing between an attacker page
  and authenticated actions.
- Fix: reject unknown origins at `:339` (mirror the second middleware's
  logic) and remove the `.vercel.app` wildcard.

### C3. Hardcoded pgcrypto key fallback — PII encryption is trivially decryptable
- `src/infrastructure/database/migrationRunner.js:100` —
  `process.env.PGCRYPTO_KEY || 'dev-fallback-trstprep-pgcrypto-key-32bytes'`
  — every migration run (including in production) sets the public, well-known
  fallback string as `app.pgcrypto_key` when the env var is missing. Any
  pgcrypto-encrypted column (PII, phone, DOB — migration 088 scheme) is
  decryptable by anyone who reads this file.
- `src/infrastructure/database/postgres-helpers.js:25-28` — the app-layer
  encryption key is `sha256(DB_ENCRYPTION_KEY || JWT_SECRET)`. The
  `JWT_SECRET` branch means PII encrypted at the app layer is decryptable with
  the JWT secret that was **leaked in git history** (blocked at boot only for
  use as JWT secret itself, `app-port5001.js:186-198` — not for encryption).
  There is no check that `DB_ENCRYPTION_KEY` is set or distinct.
- Fix: require `PGCRYPTO_KEY`/`DB_ENCRYPTION_KEY` in production (fail boot),
  remove the fallback string, rotate keys, re-encrypt data.

---

## HIGH

### H1. `super_admin` role is locked out of the entire admin API (and admin WebSocket channels)
- `src/middleware/auth.middleware.js:413` — `isAdmin = user.role === ROLES.ADMIN`
  only; `admin` middleware (`:620-629`) then 403s any non-`admin` role.
- `src/api/routes/admin-routes-index.js:69` — every `/api/admin` route runs
  `protect, admin, ...` → a `super_admin` user gets 403 before
  `requireAdminPermission` (whose own `super_admin` bypass in
  `middleware/admin-permission.middleware.js` is therefore dead code).
- Same pattern in WebSockets: `infrastructure/websocket/websocketManager.js:318,338`
  deny `admin:sessions:subscribe` / `admin:live-tests:subscribe` to
  `super_admin`.
- Fix: `isAdmin` should include `ROLES.SUPER_ADMIN`, or the global gate should
  use `isHigherRole(req.user.role, ROLES.ADMIN)`.

### H2. Any `*.vercel.app` origin passes the CSRF origin gate for state-changing requests
- `src/middleware/origin.middleware.js:95` — `originHostname.endsWith('.vercel.app')`
  is trusted for all non-GET requests (same pattern in the first CORS
  middleware, `app-port5001.js:336`). Vercel allows anyone to deploy, so an
  attacker can register `https://evil-xyz.vercel.app` and pass the origin
  check. The CSRF token requirement remains, but the token is not readable
  cross-origin only because of an incidental `exposedHeaders` gap — fragile.
- Fix: restrict to the exact `FRONTEND_URL`/`ADMIN_PANEL_URL` hosts; drop the
  wildcard (preview deployments should use `ALLOWED_ORIGINS`).

### H3. `find()` silently drops UUID-like `id` conditions → unfiltered queries
- `src/infrastructure/database/postgres-helpers.js:754-760` (also `findReadOnly`
  `:864`-ish and `findById` `:955`,`:991`) — any string `id` containing `-` is
  skipped, so `find('users', { id: '<uuid>' })` becomes
  `SELECT … FROM users WHERE is_active = true ORDER BY id ASC LIMIT 1000`.
- Reachable through identifier resolution (`shared/utils/identifier-utils.js:56,65`
  loads `find(collection, {})` for slug/ObjectID fallbacks) — up to 1000 rows
  of any collection exposed to a caller who can influence an identifier.
- Fix: reject or convert unknown id formats explicitly; never silently drop a
  condition.

### H4. Phone/PII fields are encrypted with a random IV on every write → lookups never match
- `src/infrastructure/database/postgres-helpers.js:644,653-654` — `toSnake`
  encrypts `phone/dateOfBirth/location/education/bio` on every write with
  `encryptValue` (`:31-40`, random IV per call). Any query filtering on these
  fields (`findOne('users', { phone })`, unique lookups) can never match the
  stored ciphertext — phone-number login/search/duplicate-checking is broken,
  and uniqueness on the encrypted column is impossible (duplicate accounts).
- `decryptValue` (`:42-58`) returns the raw ciphertext on any failure — PII
  surfaces to clients as undecryptable garbage instead of failing loudly.
- Fix: deterministic AEAD with a stable IV (e.g., HMAC-based keyed hash for
  lookups + AES-GCM for storage), or a dedicated encrypted-lookup column.

### H5. PostgreSQL TLS certificate validation disabled by default
- `apps/backend/config/database-replicas.js:21-24` — `sslConfig` defaults to
  `rejectUnauthorized: false` unless `PG_SSL_REJECT_UNAUTHORIZED === "true"`;
  the same default exists in `src/utils/db-config.js`. In production the
  Supabase connection is MITM-able (DB credentials travel over TLS without
  server-cert verification).
- Fix: default to `rejectUnauthorized: true` (or fail boot), keep the env
  override for private-network endpoints only.

---

## MEDIUM

### M1. Message broker subscriber never connects and can crash the process
- `src/infrastructure/events/messageBroker.js:30-33` — the subscriber clones
  the main client's options, which include `lazyConnect: true`
  (`infrastructure/cache/redisClient.js:58`), and `init()` never calls
  `connect()` on it; `subscribe()` is queued/awaited at `:33`. Additionally
  the subscriber has **no `'error'` listener** — a Redis drop emits an
  unhandled `error` event → `uncaughtException` path (`app-port5001.js:977`).
- Fix: `await this.subscriberClient.connect()` in `init()`, register
  `'error'`/`'reconnecting'` handlers, and fail over to the local in-memory
  bus instead of hanging startup.

### M2. BullMQ workers have no `'error'` handler
- `src/infrastructure/queue/queueManager.js:112-130` — only `'failed'` is
  handled; Worker `'error'` events (Redis connection loss) are unhandled →
  worker process restarts on every Redis blip.

### M3. Unbounded Redis metric keys from attacker-controlled paths
- `src/middleware/monitoring.js:125-132` — path normalization only collapses
  hex/digit segments (`[a-f0-9-]`); alpha-only paths (`/api/zzz1`, `/api/zzz2`)
  create distinct `metrics:requests:path:<path>` keys with **no TTL** and no
  cap (the in-memory cap at `:43,:48-53` does not apply to Redis).
- Fix: cap + expire Redis path keys, or bucket via a bounded hash.

### M4. Email retry loop re-queues with no backoff
- `src/infrastructure/email/emailService.js:145-164` — a failed send is pushed
  straight back onto the in-memory queue (and appended to the spool) and
  retried immediately up to 3 times; during an SMTP outage this spins a hot
  loop per message and duplicates spool rows.
- Fix: exponential backoff (setTimeout/BullMQ delay) before re-queueing.

### M5. Lockout/rate keys trust spoofable `X-Forwarded-For`
- `src/middleware/lockout.middleware.js:18-24` (via `src/utils/networkUtils.js:5-12`)
  takes the first XFF value verbatim — an attacker can rotate the header to
  bypass IP-based lockout entirely. (express-rate-limit uses `req.ip` under
  `trust proxy 1`, which is fine; only the lockout path is vulnerable.)
- Fix: use `req.ip` (or the socket address when behind a trusted proxy).

### M6. Production cookies are `SameSite=None` while CORS allows every origin
- `src/modules/auth/auth.service.js:22` — `COOKIE_SAMESITE || (isProduction ? 'none' : 'lax')`.
  Combined with C2, all state-changing defenses reduce to the Origin header
  check (which H2 widens) plus the CSRF token. Prefer `SameSite=Lax` and rely
  on a proper `__Host-`/`Secure` cookie; keep `None` only if strictly needed,
  and then fix C2 first.

---

## LOW

- L1 `adminIpAllowlist.middleware.js` — no-op passthrough when
  `ALLOWED_ADMIN_IPS` is unset; IPv6 addresses can never be allowed.
- L2 `imageOptimization.js` mounted after `express.static`
  (`app-port5001.js:550`,`:572`) — static serves existing files first, so the
  optimizer is effectively dead for them.
- L3 `src/config/upload.js` (and `app-port5001.js:528`) — MIME-only allowlist
  (no magic-number check) and `video/avi` is allowed; contrast with
  `infrastructure/storage/upload.js` which does signature checks. The
  signature-checked path is what actually persists uploads — keep it that way.
- L4 `app-port5001.js:925-927` — the 60-min subscription-expiry
  `setInterval` is not cleared in `gracefulShutdown` (process exits anyway;
  merely untidy).
- L5 `middleware/public-id-response.middleware.js` — `_id` stripping is
  commented out → internal numeric IDs still exposed in responses.
- L6 `auth.middleware.js:302` (and `websocketManager.js`, `requireImageAuth`
  `:503`) — `jwt.verify` without an explicit `algorithms` allowlist.
- L7 `middleware/validation/inputValidation.js:392-395` — `commonSchemas.userRegistration`
  is defined but unused anywhere; its default `sanitize: true` HTML-entity-encodes
  values including the password — if ever wired into registration, stored
  passwords would be corrupted. Not currently reachable.
- L8 `rateLimiterFactory.js:22` / `app-port5001.js:363` — `DISABLE_RATE_LIMITER`
  and the dev-only `x-load-test` bypass exist; acceptable if NODE_ENV is always
  correct in production (a misconfigured `NODE_ENV` silently disables limits).

---

## VERIFIED OK

- **CSRF** (`csrf.middleware.js`) — production fail-closed (no memory fallback,
  `:103-106`), DB→Redis→(prod reject) storage, 24h expiry, rotation with
  5-min grace persisted across restarts (`:250`), per-session max-100 rotation
  history, authless requests skipped by design (`:328-331`), GET bootstrap sets
  `X-CSRF-Token` (`:300-309`).
- **Helmet/CSP** (`app-port5001.js:216-269`) — production CSP `scriptSrc 'self'`
  only, `frameSrc 'none'`, frameguard deny, HSTS preload, no-sniff; HTTPS
  redirect when `ENFORCE_HTTPS=true`.
- **Auth** (`auth.middleware.js`) — session-id JWT + server-side session check,
  idle (30 min) and absolute (30 days) expiry with fail-open on transient DB
  errors, deactivated-account block, token-type allowlist, password stripped,
  bounded caches, transient DB errors → 503 (no mass logout).
- **SQL injection** — no `eval`/`new Function`/XML parsers in the codebase; all
  interpolated-SQL call sites verified safe: hardcoded tables/columns
  (`admin-recycle-bin.js:15`,`:119`; `session.controller.js:128-142`;
  `study.js:192`; `practice.js` builds placeholders with `!isNaN(Number())`
  gates; `fullTestImporter.js` uses fixed tables/cols; `withTransaction`
  `lockTimeout` has no callers, `postgres-helpers.js:2121`). `qb.js` quotes
  identifiers; `queryBuilder.js` gates keys through `allowedFields`.
- **Migrations** — advisory lock, `schema_migrations` tracking, transactional
  DDL, halt-on-failure (`migrationRunner.js`).
- **Secrets hygiene** — compromised-secret boot guard
  (`app-port5001.js:186-198`); logger redaction list; morgan masks sensitive
  query params (`:396-414`); error responses sanitized in prod
  (`utils/sanitizeError.js`, `shared/utils/sendResponse.js:18-23`).
- **Rate limiting** — general 1000/15min, auth 20/15min, admin 500/15min,
  upload 10/15min, all env-tunable; limiter skips are minimal.
- **Static files** — question/solution images behind `requireImageAuth`
  (`app-port5001.js:541-550,564-570`); avatars/banners public by design;
  storage path sanitization + extension/signature validation.
- **Observability** — `/metrics` requires `METRICS_AUTH_TOKEN` in prod
  (`:658-671`); `/api/health` and `/api/metrics` sanitize infra details in prod.
- **Lifecycle** — graceful shutdown drains queues, closes pools/Redis, stops
  schedulers; `uncaughtException`/`unhandledRejection` → guarded graceful
  shutdown (`:937-978`).
- **Request hardening** — 1MB body limit, 50MB upload limit, 30s server
  timeout (`:875`), strong ETags, request-id charset sanitized
  (`trace.middleware.js`), bounded request-dedup (`requestDedup.js`).
- **Admin audit trail** — `/api/admin` audit middleware with body capture and
  PII-field redaction; GET list endpoints skipped to avoid flood, detail reads
  audited (`admin-routes-index.js:55-62`).
- **User PII** — `shared/utils/user-utils.js:39-94` strips credentials and PII
  from user payloads; sensitive columns excluded from generic selects
  (`postgres-helpers.js:72-80`).

## Top priorities (order)
1. C1 — cache scoping (active data leak).
2. C2 + M6 — CORS policy + cookie SameSite.
3. C3 + H5 — key management and TLS verification.
4. H1 — super_admin lockout.
5. H2 — remove `.vercel.app` wildcard.
