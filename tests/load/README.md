# Load Testing Suite - Trstprep V2.1

> As of 2026-09-06. k6-based suite: 4 runnable scripts (`smoke.js`,
> `auth.js`, `api.js`, `realtime.js`) + shared `k6.config.js`. Run from the
> **repo root** so the `summary-*.json` paths below resolve.

## Prerequisites

1. **Install k6** — Chocolatey (`choco install k6`) / Scoop
   (`scoop install k6`) on Windows, `brew install k6` on macOS, the k6 apt
   repo on Debian/Ubuntu, or `docker pull grafana/k6`.
2. **Backend running.** Local dev listens on `http://localhost:5001`
   (k6 default); override with `TARGET_URL` (below, `BASE_URL` alias kept).

## Test files

| File           | Description                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `smoke.js`     | Pre-check probe: single VU, 1 iteration, thresholds OFF. `GET /api/health` (expects 200/206 + `status: ok/degraded` body) + login **shape** probe (`POST /api/auth/login` accepts any non-5xx; skips cleanly when `TEST_PASSWORD` is unset). Creates no users, runs no stages — run this first. `k6 run tests/load/smoke.js` |
| `auth.js`      | Register / login / refresh. **Ignores `TEST_EMAIL`/`TEST_PASSWORD`** — registers a fresh `loadtest_<timestamp>` user per run |
| `api.js`       | Authenticated API endpoints; needs `TEST_PASSWORD` (+ optional `TEST_EMAIL`) to mint a token. Covers `/api/test-series` (kept), `/api/users/dashboard` (canonical — the singular `/api/user/dashboard` is only an alias probe that also accepts 404) + `/api/leaderboards` (plural — singular is NOT a valid endpoint), `POST /api/tests/:id/start` (start IDs are fetched from `GET /api/tests`, never from the series list — a series id is a different entity) |
| `realtime.js`  | WebSocket flows; **overrides stages** (5 → 20 → 20 → 0 VUs, ~7 min) instead of using `k6.config.js` stages. Mints a token via `k6/http` login against `TARGET_URL` (no `__ENV.HTTP` gate) |
| `k6.config.js` | Shared base URL, stages (10 → 50 → 100 → sustain → 0, ~11 min), thresholds, headers                                          |

`package.json` wires `test:smoke`, `test:auth`, `test:api`, `test:realtime`, `test:all`.

## Running tests

```bash
# From the repo root
k6 run tests/load/smoke.js    # pre-check first (1 VU, 1 iter, no thresholds)
k6 run tests/load/auth.js
k6 run tests/load/api.js
k6 run tests/load/realtime.js

# Single-file loop — sh/bash ONLY (not cmd.exe). Paths are repo-root
# relative: tests/load/ prefix required when running from the repo root.
# (tests/load/package.json `test:all` uses bare `$f.js` because its CWD is
# tests/load/ itself.)
for f in api auth realtime; do k6 run tests/load/$f.js || exit 1; done

# Portable node alternative (win32-safe, same stop-on-first-failure
# semantics as test:all) — from the repo root:
node scripts/k6-run.js
node scripts/k6-run.js --file=smoke
node scripts/k6-run.js --file=api -- --env TARGET_URL=http://localhost:5001

# Against any host (TARGET_URL canonical, BASE_URL alias)
k6 run --env TARGET_URL=http://localhost:5001 tests/load/api.js

# Authenticated suites (api.js / realtime.js)
k6 run --env TEST_EMAIL=user@example.com --env TEST_PASSWORD=secret tests/load/api.js

# Verbose HTTP logging
k6 run --env HTTP_DEBUG=true tests/load/api.js
```

### Docker (volume-mount form — required)

`api.js`/`auth.js`/`realtime.js` import `./k6.config.js`, so piping a file
over **stdin breaks the imports**. Mount the directory instead:

```bash
docker run --rm -v "%CD%/tests/load:/scripts" -w /scripts grafana/k6 run /scripts/api.js
docker run --rm -v "%CD%/tests/load:/scripts" -w /scripts -e BASE_URL=http://host.docker.internal:5001 grafana/k6 run /scripts/api.js
```

## Configuration

| Variable        | Default                 | Description                                                                                                                                               |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TARGET_URL`    | `http://localhost:5001` | Canonical backend base URL override (`BASE_URL` kept as legacy alias)                                                                                     |
| `BASE_URL`      | (falls back to TARGET_URL default) | Legacy alias for the backend base URL                                                                                                          |
| `TEST_EMAIL`    | `admin@trstprep.com`    | Login email for `api.js` / `realtime.js` (**ignored by `auth.js`**, which generates its own user)                                                         |
| `TEST_PASSWORD` | **(none — required)**   | No default. Unset = login fails and authenticated checks fail; `api.js`/`realtime.js` warn `TEST_PASSWORD environment variable is not set for load test.` Use a dedicated load-test account — never a real user password, never production credentials. |
| `HTTP_DEBUG`    | (empty)                 | Set to `true` for verbose HTTP logging                                                                                                                    |

### Thresholds

p95 < 500ms · error rate < 1% · throughput > 50 rps · login success > 99%
(`auth.js` adds register p95 < 800ms) · WebSocket success > 95%, p95 connect
< 2000ms (`realtime.js`).

> Aspirational for local runs, NOT production SLOs: the practice-session and
> bookmark endpoints already show ~5s p50 in production (see REPO_BRAIN
> "Runtime Watchlist"), so these thresholds will fail against prod-like data.
> Tune per environment; never gate a release on uncalibrated numbers.

### Scope & target restriction — LOCAL ONLY

- Point `TARGET_URL` at `http://localhost:5001` (or a disposable dev
  instance) only. **Never run this suite against production**: the register
  flow creates real users and the staged VUs (up to 100 sustained) are a
  self-inflicted DDoS on shared infra.
- There is deliberately **no automatic CI gate** for k6. The `k6-smoke`
  job in `.github/workflows/ci.yml` runs **only** `smoke.js` and only on
  manual `workflow_dispatch` (never on push/PR, never blocking). CI covers
  correctness via jest/vitest + migration runs; k6 stays a manual local
  tool until thresholds are calibrated per environment.
- `auth.js` creates a fresh `loadtest_<timestamp>` user on every run — purge
  them periodically from the target DB (local/dev only):
  `DELETE FROM users WHERE email LIKE 'loadtest_%';` (ops snippet, run
  manually via psql — never against production).

### Token shape (backend contract)

Login/register respond with `{ success, data: { token, ... } }` AND set the
JWT as an httpOnly `token` cookie (`setAuthCookies`). The scripts read
`body.data.token` first (legacy `body.token` fallback), then fall back to
`http.cookieJar()` — a bare `body.token` read silently yields `""` and runs
every "authenticated" scenario unauthenticated, so keep all three in sync if
the auth envelope ever changes.

## Results

Summaries (repo-root relative): `tests/load/summary-smoke.json`,
`tests/load/summary-auth.json`,
`tests/load/summary-api.json`, `tests/load/summary-realtime.json`.

Key metrics: `http_req_duration` (avg/med/p90/p95/p99), `http_req_failed`,
`http_reqs`, `iter_duration`, plus per-suite rates (`login_success_rate`,
`register_success_rate`, `api_success_rate`, `ws_success_rate`).

## Troubleshooting

- **Connection refused** — backend not running, or wrong port (default is
  `:5001`; override with `TARGET_URL`).
- **Auth-suite failures with no `TEST_PASSWORD`** — expected; export it first.
- **High error rates** — check server logs, pool saturation, Redis.
- **Memory pressure** — fewer VUs / shorter stages.

## WebSocket path note: Socket.IO, not `/ws`

The backend realtime layer is **Socket.IO**
(`apps/backend/src/infrastructure/websocket/websocketManager.js` — Redis
adapter, JWT auth, rooms), not a raw WebSocket endpoint. `realtime.js` opens
a raw `k6/ws` handshake against `${BASE}/ws` purely as a connectivity smoke
probe: against the real backend expect non-101 responses and read
`ws_success_rate` accordingly — it does NOT prove Socket.IO works. For true
Socket.IO load, use a socket.io client harness. The base-URL conversion uses
the `URL` constructor (protocol swap `http→ws` / `https→wss`); the old
`.replace("http", "ws")` was fragile (rewrites `http` substrings anywhere in
the URL) and kept only as a non-URL fallback.

## Fixed: `realtime.js` token fetch (was dead code)

`realtime.js` previously gated its login call on `__ENV.HTTP`, which was
never set — `getAuthToken()` always returned `""` and every WebSocket
scenario ran unauthenticated. It now mints a token via `k6/http` POST to
`TARGET_URL/api/auth/login` (same pattern as `api.js`), so realtime results
cover authenticated connections.
