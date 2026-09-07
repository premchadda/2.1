# Trstprep

Trstprep is a monorepo for an online exam-preparation platform focused on competitive exams such as SSC and Railway. The repository contains the learner-facing web app, a separate admin panel, a Node.js API, shared workspace packages, and supporting docs/scripts.

> **Refresh — September 6, 2026:** Documentation re-verified against live codebase (commit `a3651475`). Workspace layout, tech stack, ports, env vars, and feature lists checked from `package.json`, `apps/*/package.json`, `apps/backend/src/app-port5001.js`, and `graphify-out/` (10862 nodes, 20266 edges, 1744 files). Every doc in this repo was rewritten or re-verified in this pass; counts carry as-of dates — re-run the cited commands before treating them as current.

## Workspace Layout

```text
.
|-- apps/
|   |-- backend/        # Express API + BullMQ worker (port 5001)
|   |-- frontend/       # Learner React 18 + Vite 6.4 (port 3000)
|   `-- admin-panel/    # Admin React 18 + Vite 6.4 (port 3002)
|-- packages/
|   |-- shared-config/  # Constants, formatters, asset helpers (canonical source)
|   `-- shared-hooks/   # useAuth, useProPass, cross-app hooks
|-- scripts/            # dev-sequential, DB audit, maintenance scripts
|-- deploy/             # docker, nginx, logging docs
|-- docs/               # ARCHITECTURE.md, DEVELOPMENT.md, SECURITY_POSTURE.md, audits
|-- graphify-out/       # knowledge graph (do NOT deploy)
|-- archify/            # architecture explorer skill
|-- turbo.json          # Turborepo ^2.10.12 pipeline
|-- package.json        # pnpm workspaces: apps/*, packages/* (pnpm-workspace.yaml)
`-- .husky/             # pre-commit hooks (PII guard, lint)
```

Historical `dev-tools/` references removed — canonical scripts live in `scripts/` and `apps/backend/scripts/`. `graphify-out/` and `archify/` are present at root and excluded from Docker build context.

## Tech Stack

- **Backend:** Node.js 22 (`.nvmrc`; engines `>=20`), Express, PostgreSQL (Supabase, RLS), Redis/BullMQ, Socket.IO, Nodemailer/SendGrid, Razorpay, OpenRouter (multi-provider AI via `modules/ai/aiClient.js`)
- **Frontend / Admin:** React 18, Vite 6.4, Tailwind CSS 3.x, React Router v6, TanStack Query, Axios ^1.20, Lucide Icons, prop-types
- **Monorepo:** pnpm 11.25 workspaces, Turborepo ^2.10.12, Prettier ^3.5, Husky ^9 + lint-staged
- **AI / Search:** pgvector `vector(1536)` + HNSW/ivfflat, Node Engine V1 shipped (`nodes` table) + V2 tables (`user_node_skill`); V3–V6 are vision only (`docs/vision/NODE_ENGINE_V4-V6.md`), Practice↔Test bridge

## Apps And Ports

| App         | Path               | Default Port | Health / Entry                     |
| ----------- | ------------------ | ------------ | ---------------------------------- |
| Backend API | `apps/backend`     | `5001`       | `http://localhost:5001/api/health` |
| Frontend    | `apps/frontend`    | `3000`       | Vite dev server, proxy → backend   |
| Admin panel | `apps/admin-panel` | `3002`       | Vite dev server                    |

Backend is single entry `apps/backend/src/app-port5001.js` (~80 route files, admin chain `normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect → admin → validateCsrfToken → loadAdminPermissions → requireAdminPermission → auditMiddleware`).

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- **Package Manager**: `pnpm` 10+ / 11+ (recommended for workspaces & Turborepo) or `npm` 10.8+
- **Python Tooling**: Python 3.11+ and `uv` (for AI PDF parsing, AST analysis, and document ingestion)
- PostgreSQL (Supabase) + `DATABASE_URL`; optional `DATABASE_READ_URL` (read replica, falls back to primary)
- Redis (Upstash / local) — optional for API dev, required for worker/queues/Socket.IO adapter
- Docker (optional) for `docker-compose.yml` / `deploy/` flows

## Installation

```bash
# Node monorepo (recommended)
pnpm install

# (Optional fallback if using npm)
# npm install

# Python AI environment (instant setup with uv)
uv venv
uv pip install -e .
```

Verify graph after install:

```bash
# if you have graphify CLI
/graphify --update   # code-only changes are free; docs need LLM re-extraction
```

## Environment Setup

Copy the example files before starting the apps:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/admin-panel/.env.example apps/admin-panel/.env
```

### Backend Required Variables

The backend exits on startup if these are missing (`apps/backend/src/shared/config.js` validates at module load):

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
JWT_SECRET=generate-a-strong-secret-at-least-32-characters
JWT_REFRESH_SECRET=different-strong-secret-at-least-32-chars
FRONTEND_URL=http://localhost:3000
ADMIN_PANEL_URL=http://localhost:3002
```

Common additional variables:

```env
PORT=5001
NODE_ENV=development
REDIS_URL=redis://localhost:6379
PGCRYPTO_KEY=32-byte-hex-for-pgcrypto
DB_ENCRYPTION_KEY=app-layer-encryption-key
Razorpay / Email / SMS — see apps/backend/.env.example
ADMIN_API_KEY=strong-random-secret-for-admin-panel
VITE_GOOGLE_CLIENT_ID=...
```

> **Security note (pre-flight audit, Aug 23, 2026):** `apps/backend/.env` was previously committed — rotate `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RAZORPAY_*` before any deploy. CI `data-guard.yml` now fails build on PII keys.

### Frontend And Admin Variables

The browser apps primarily read `VITE_API_URL` for API requests. In local development, the Vite dev servers also support proxying to the backend via `VITE_BACKEND_URL`.

Typical local values:

```env
# apps/frontend/.env
VITE_API_URL=/api
VITE_SOCKET_URL=/
VITE_ADMIN_URL=http://localhost:3002
VITE_BACKEND_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=real-google-client-id
VITE_RAZORPAY_KEY_ID=...

# apps/admin-panel/.env
VITE_API_URL=/api
VITE_MAIN_SITE_URL=http://localhost:3000
VITE_ADMIN_SITE_URL=http://localhost:3002
VITE_BACKEND_URL=http://localhost:5001
VITE_ADMIN_API_KEY=same-as-backend-ADMIN_API_KEY
```

## Running The Monorepo

Start everything through Turborepo:

```bash
pnpm dev              # sequential start (scripts/dev-sequential.mjs)
pnpm run dev:turbo    # turbo dev --ui=stream — all apps in parallel
```

Or run individual apps:

```bash
pnpm run dev:backend  # turbo dev --filter=trstprep-backend
pnpm run dev:frontend # turbo dev --filter=trstprep-frontend
pnpm run dev:admin    # turbo dev --filter=trstprep-admin
```

Backend-only worker process:

```bash
pnpm --filter trstprep-backend run worker:dev
```

Python AI extraction & document tools:

```bash
# Run PDF extraction via uv
uv run python apps/backend/src/modules/ai/extract_pdf.py <path-to-pdf>
```

## Build Commands

```bash
pnpm run build          # production builds
pnpm run build:all      # turbo build -- all apps
pnpm run build:backend  # turbo build --filter=trstprep-backend
pnpm run build:frontend # turbo build --filter=trstprep-frontend
pnpm run build:admin    # turbo build --filter=trstprep-admin
```

## Testing And Linting

Root commands:

```bash
pnpm test       # turbo test
pnpm lint       # turbo lint
pnpm format     # prettier --write "**/*.{js,jsx,ts,tsx,json,md}"
pnpm load-test         # k6 run tests/load/api.js
pnpm load-test:auth    # k6 auth load
pnpm load-test:realtime # k6 realtime
```

Current state (verified Aug 23, 2026; backend suite counts conflict between sources — re-run before quoting):

- Backend: Jest (`apps/backend`, `npm test` / `pnpm --filter trstprep-backend test`) — Aug 23 reports disagree (`128–129` vs `157` passing); treat both as stale, re-run.
- Frontend: Vitest ^4.1.11 + `@vitest/coverage-v8` (`pnpm --filter trstprep-frontend test`).
- Admin panel: React + Vite, lint via `eslint`/`@eslint/js`; no dedicated test script in `package.json`.
- Lint: `pnpm lint` (turbo) — see `docs/REMEDIATION_PLAN.md` for triage status.

## Useful Scripts

The `scripts/` directory (108 files — see `scripts/README.md` for the inventory) contains audit, seeding, taxonomy, dev, and load tooling. Key scripts:

- `scripts/run-database-audit.js` — schema audit (run before any migration)
- `scripts/dev-sequential.mjs` — ordered dev start (`pnpm dev`)
- `scripts/reset-admin.js` — admin seeding/reset (`ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- `deploy/logging.md` — logging setup

## Notable Features In This Repo

- Separate learner app (`apps/frontend`) and admin panel (`apps/admin-panel`) — 60 admin manager components across 13 categories (verified `apps/admin-panel/src/features/admin/**/*.jsx`)
- JWT (httpOnly + SameSite=Lax, 30-day absolute / 30-min idle) + CSRF (DB-backed, 5-min cleanup) + fail-closed auth
- 85 backend route files + 33 module routes; 81+ `/api` mounts, 40+ admin routers (`/api/admin/*` with defense-in-depth)
- Exam, test-series (migrations `000`–`135` on disk), practice lab, study-material, current-affairs, leaderboard, community, referrals, subscriptions (Razorpay) routes
- WebSocket (Socket.IO) with JWT auth + session eviction; Redis adapter + BullMQ queues (analytics, leaderboard, notifications)
- Shared workspace packages: `shared-config` (constants/formatters/asset helpers) + `shared-hooks` (useAuth, useProPass). Known duplication: `adminNavConfig` is mirrored in both apps alongside the shared package — verify consumers before editing nav.
- AI gateway (OpenRouter via `modules/ai/aiClient.js`), pgvector semantic search, Node Engine V1 (+V2 tables); Practice↔Test bridge (`practice_ai_cache`)
- `PostgresHelpers` god node (283 edges), `DataService` (186), `pool` (143), `dbHelpers` (136), `protect()` (103) — changes ripple across ~70 modules (see `graphify-out/GRAPH_REPORT.md`)

## Documentation

- **Main docs:** `docs/ARCHITECTURE.md` (quick ref, deployment, structure, workflows — rewritten Sep 6, 2026)
- **Development:** `docs/DEVELOPMENT.md` (admin panel components, bulk upload, pnpm/uv workflow — rewritten Sep 6, 2026)
- **AI prompts/vision:** `docs/AI_PROMPTS.md` + `docs/vision/NODE_ENGINE_V4-V6.md` (V3–V6 are vision, not shipped)
- **Test lifecycle:** `docs/test-quiz-lifecycle.md` (authoritative state/transition contract)
- **Security:** `docs/SECURITY_POSTURE.md` (CSRF, rate limiting, RLS, admin defense-in-depth — refreshed Sep 6, 2026)
- **Database:** `docs/DATABASE_SCHEMA_AUDIT.md` (migrations `000`–`135`, soft-delete, RLS — refreshed Sep 6, 2026) + `database_schema_dictionary.md` (live-DB snapshot Aug 27, 2026)
- **Remediation:** `docs/REMEDIATION_PLAN.md` (status tokens per phase + Sep 6, 2026 addendum)
- **Site readiness:** `docs/SITE_READINESS_REPORT.md` (frozen Aug 23 first pass) / `docs/FINAL_SITE_READINESS_REPORT.md` (living scorecard)
- **Audits:** `docs/audit/D1_WORKFLOW_VERIFICATION.md`, `D2_HARDCODED_FAKE_DATA.md`, `D3_DEAD_DISCONNECTED.md` (re-verified Sep 6, 2026 — most Aug-23 breaks now fixed)
- **Architecture explorer:** `docs/ARCHITECTURE.html` + `docs/FEATURES.html` (interactive HTML)
- **Knowledge graph:** `graphify-out/GRAPH_REPORT.md` — run `/graphify query "<question>"` before grepping

## Notes

- Point-in-time reports (`docs/SITE_READINESS_REPORT.md`, `docs/UNIFIED_TRSTPREP_AUDIT.md` body, `docs/audit/archive/`) are frozen historical evidence — check their banners before quoting verdicts.
- Docker deploy primary: `docker-compose.yml` + `nginx`. Vercel is vestigial.

---

_Last Updated: September 6, 2026 — content re-verified against commit `a3651475` + live file counts_
