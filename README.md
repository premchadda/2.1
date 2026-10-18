# Trstprep

Trstprep is a monorepo for an online exam-preparation platform focused on competitive exams such as SSC and Railway. The repository contains the learner-facing web app, a separate admin panel, a Node.js API, shared workspace packages, and supporting docs/scripts.

> **Refresh — October 2026:** Documentation verified against live codebase. Workspace layout, tech stack, ports, env vars, and test suites verified from `package.json`, `apps/*/package.json`, `apps/backend/src/app-port5001.js`, and `graphify-out/` (9963 nodes, 20859 edges, 608 communities). Verified 126 test suites / 1159 passing unit and integration tests across monorepo packages.

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
|-- docs/               # SYSTEM_ARCHITECTURE.md, SECURITY_AI_REMEDIATION.md, CONTRIBUTING_AND_CHANGELOG.md, REPO_BRAIN.md / .html, AUDIT.md
|-- tools/              # archify, agent-skills
|-- content-pipeline/   # raw exam sources, question books, mockups, processing scratch
|-- graphify-out/       # knowledge graph (do NOT deploy)
|-- turbo.json          # Turborepo ^2.11.9 pipeline
|-- package.json        # pnpm workspaces: apps/*, packages/* (pnpm-workspace.yaml)
`-- .husky/             # pre-commit hooks (PII guard, lint)
```

Historical `dev-tools/` references removed — canonical scripts live in `scripts/`. Standalone tools live in `tools/` and content pipelines live in `content-pipeline/` (both excluded from Docker build context).

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

Current state (verified October 2026):

- **Backend:** Jest (`apps/backend`, `pnpm --filter trstprep-backend test`) — 81 test suites, 727 tests passing.
- **Frontend:** Vitest ^4.1.11 + `@vitest/coverage-v8` (`pnpm --filter trstprep-frontend test`) — 31 test suites, 321 tests passing.
- **Admin panel:** Vitest ^4.1.11 (`pnpm --filter trstprep-admin test`) — 14 test suites, 111 tests passing.
- **Total Test Suite:** 126 test suites, 1159 tests passing across all packages (100% pass rate).
- **Lint:** `pnpm lint` (turbo) — 0 errors across monorepo; 0 warnings in `apps/frontend` and `apps/backend`; `apps/admin-panel` capped with `--max-warnings=125`.

## Useful Scripts

The `scripts/` directory (224 files — see `scripts/README.md` for the inventory) contains audit, seeding, taxonomy, dev, and load tooling. Key scripts:

- `scripts/run-database-audit.js` — schema and index audit (run before any migration)
- `scripts/sync-repo-brain.mjs` — knowledge graph & repo brain metric synchronization
- `scripts/dev-sequential.mjs` — ordered dev start (`pnpm dev`)
- `scripts/reset-admin.js` — admin seeding/reset (`ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- `deploy/logging.md` — logging setup

## Notable Features In This Repo

- Separate learner app (`apps/frontend`) and admin panel (`apps/admin-panel`) — 60 admin manager components across 13 categories (verified `apps/admin-panel/src/features/admin/**/*.jsx`)
- JWT (httpOnly + SameSite=Lax, 30-day absolute / 30-min idle) + CSRF (DB-backed, 5-min cleanup) + fail-closed auth
- 85 backend route files + 33 module routes; 81+ `/api` mounts, 40+ admin routers (`/api/admin/*` with defense-in-depth)
- Exam, test-series (migrations `000`–`153`, 142 .sql files on disk), practice lab, study-material, current-affairs, leaderboard, community, referrals, subscriptions (Razorpay) routes
- WebSocket (Socket.IO) with JWT auth + session eviction; Redis adapter + BullMQ queues (analytics, leaderboard, notifications)
- Shared workspace packages: `shared-config` (constants/formatters/asset helpers) + `shared-hooks` (useAuth, useProPass). Known duplication: `adminNavConfig` is mirrored in both apps alongside the shared package — verify consumers before editing nav.
- AI gateway (OpenRouter via `modules/ai/aiClient.js`), pgvector semantic search, Node Engine V1 (+V2 tables); Practice↔Test bridge (`practice_ai_cache`)
- `PostgresHelpers` god node (283 edges), `DataService` (186), `pool` (143), `dbHelpers` (136), `protect()` (103) — changes ripple across ~70 modules (see `graphify-out/GRAPH_REPORT.md`)

## Documentation

The project documentation has been consolidated into unified, single-source-of-truth master documents:

- **System Architecture & Development:** [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md)  
  Master specification combining system topology, deployment & environment configs, full developer workflow (admin panel components, bulk upload, pnpm/uv), quiz & test lifecycle transition contract, practice lab state engine, live 164-table database schema dictionary, and dedicated dynamic update workspace.
- **Security, AI & Remediation:** [`docs/SECURITY_AI_REMEDIATION.md`](docs/SECURITY_AI_REMEDIATION.md)  
  Comprehensive security posture (CSRF, RLS, rate limiting, admin defense-in-depth, DPDP Act 2023 compliance & data breach runbook), AI gateway & prompt engineering specifications, and unified remediation plan & task tracker.
- **Contributing & Changelog:** [`docs/CONTRIBUTING_AND_CHANGELOG.md`](docs/CONTRIBUTING_AND_CHANGELOG.md)  
  Monorepo development guidelines, branch & PR conventions, multi-agent deployment rules, and complete semantic version changelog.
- **Living Book of the System & Interactive Visualizer:** [`docs/REPO_BRAIN.md`](docs/REPO_BRAIN.md) / [`docs/REPO_BRAIN.html`](docs/REPO_BRAIN.html)  
  Comprehensive system encyclopedia and interactive 3D WebGL architecture visualizer. Documents every page, subpage, layout, button, route, and table, with real-time telemetry and AST metrics auto-synchronized via `.husky/post-commit`.
- **Engineering Audit Log:** [`docs/AUDIT.md`](docs/AUDIT.md)  
  Consolidated engineering audit covering workflow verification, hardcoded data elimination, dead code remediation, and site readiness scorecards.
- **Research Roadmap:** [`docs/vision/NODE_ENGINE_V4-V6.md`](docs/vision/NODE_ENGINE_V4-V6.md)  
  Forward-looking research specifications for Node Engine V3 (Socratic AI Tutor), V4 (Autonomous Education OS), and V5/V6 cognitive graphs.
- **Knowledge Graph:** [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md)  
  Knowledge graph map. Consult before grepping: use `/graphify query "<question>"` or the Graphify MCP tools.

## Notes

- Point-in-time audit findings and verification runs are consolidated in `docs/AUDIT.md`.
- Docker deploy primary: `docker-compose.yml` + `nginx`. Vercel is vestigial.

---

_Last Updated: October 2026 — verified 126 test suites / 1159 passing tests, 142 migrations, 0 lint errors_
