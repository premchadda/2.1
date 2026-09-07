# Load Testing Suite - Trstprep V2.1

> As of 2026-09-06. k6-based suite: 3 runnable scripts (`auth.js`, `api.js`,
> `realtime.js`) + shared `k6.config.js`. Run from the **repo root** so the
> `summary-*.json` paths below resolve.

## Prerequisites

1. **Install k6** — Chocolatey (`choco install k6`) / Scoop
   (`scoop install k6`) on Windows, `brew install k6` on macOS, the k6 apt
   repo on Debian/Ubuntu, or `docker pull grafana/k6`.
2. **Backend running.** Local dev listens on `http://localhost:3000`
   (k6 default); the compose stack exposes the backend on `:5001` — override
   with `BASE_URL` (below).

## Test files

| File           | Description                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `auth.js`      | Register / login / refresh. **Ignores `TEST_EMAIL`/`TEST_PASSWORD`** — registers a fresh `loadtest_<timestamp>` user per run |
| `api.js`       | Authenticated API endpoints; needs `TEST_PASSWORD` (+ optional `TEST_EMAIL`) to mint a token                                 |
| `realtime.js`  | WebSocket flows; **overrides stages** (5 → 20 → 20 → 0 VUs, ~7 min) instead of using `k6.config.js` stages                   |
| `k6.config.js` | Shared base URL, stages (10 → 50 → 100 → sustain → 0, ~11 min), thresholds, headers                                          |

`package.json` wires `test:auth`, `test:api`, `test:realtime`, `test:all`.

## Running tests

```bash
# From the repo root
k6 run tests/load/auth.js
k6 run tests/load/api.js
k6 run tests/load/realtime.js

# Against compose (:5001) or any host
k6 run --env BASE_URL=http://localhost:5001 tests/load/api.js

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
| `BASE_URL`      | `http://localhost:3000` | Backend base URL (`:5001` under compose)                                                                                                                  |
| `TEST_EMAIL`    | `admin@trstprep.com`    | Login email for `api.js` / `realtime.js` (**ignored by `auth.js`**, which generates its own user)                                                         |
| `TEST_PASSWORD` | **(none — required)**   | No default. Unset = login fails and authenticated checks fail; `api.js`/`realtime.js` warn `TEST_PASSWORD environment variable is not set for load test.` |
| `HTTP_DEBUG`    | (empty)                 | Set to `true` for verbose HTTP logging                                                                                                                    |

### Thresholds

p95 < 500ms · error rate < 1% · throughput > 50 rps · login success > 99%
(`auth.js` adds register p95 < 800ms) · WebSocket success > 95%, p95 connect
< 2000ms (`realtime.js`).

## Results

Summaries (repo-root relative): `tests/load/summary-auth.json`,
`tests/load/summary-api.json`, `tests/load/summary-realtime.json`.

Key metrics: `http_req_duration` (avg/med/p90/p95/p99), `http_req_failed`,
`http_reqs`, `iter_duration`, plus per-suite rates (`login_success_rate`,
`register_success_rate`, `api_success_rate`, `ws_success_rate`).

## Troubleshooting

- **Connection refused** — backend not running, or wrong port (`:3000` dev
  vs `:5001` compose).
- **Auth-suite failures with no `TEST_PASSWORD`** — expected; export it first.
- **High error rates** — check server logs, pool saturation, Redis.
- **Memory pressure** — fewer VUs / shorter stages.

## Known bug: `realtime.js` token fetch is dead code

`realtime.js:38` gates the login call on `__ENV.HTTP`, which is never set or
documented — the condition is always falsy, so `getAuthToken()` always
returns `""` and every WebSocket scenario runs **unauthenticated**. Until
fixed, realtime results only cover anonymous connections. (Fix: use the
`k6/http` login from `api.js` instead of the `__ENV.HTTP` branch.)
