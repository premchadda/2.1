# Trstprep

Trstprep is a monorepo for an online exam-preparation platform focused on competitive exams such as SSC and Railway. The repository contains the learner-facing web app, a separate admin panel, a Node.js API, shared workspace packages, and supporting docs/scripts.

> **Refresh — August 23, 2026:** Documentation audited against live codebase. Workspace layout, tech stack, ports, env vars, and feature lists verified from `package.json`, `apps/*/package.json`, `apps/backend/src/app-port5001.js`, and `graphify-out/` (16874 nodes, 22184 edges).

## Workspace Layout

```text
.
|-- apps/
|   |-- backend/        # Express API + BullMQ worker (port 5001)
|   |-- frontend/       # Learner React 18 + Vite 6.4 (port 3000)
|   `-- admin-panel/    # Admin React 18 + Vite 6.4 (port 3002)
|-- packages/
|   |-- shared-config/  # Admin nav, coming-soon, constants (single source of truth)
|   `-- shared-hooks/   # useAuth, useProPass, cross-app hooks
|-- scripts/            # dev-sequential, DB audit, maintenance scripts
|-- deploy/             # docker, nginx, logging docs
|-- docs/               # ARCHITECTURE.md, DEVELOPMENT.md, SECURITY_POSTURE.md, audits
|-- graphify-out/       # knowledge graph (do NOT deploy)
|-- archify/            # architecture explorer skill
|-- turbo.json          # Turborepo 2.10.5 pipeline
|-- package.json        # npm workspaces: apps/*, packages/*
`-- .husky/             # pre-commit hooks (PII guard, lint)
```

Historical `dev-tools/` references removed — canonical scripts live in `scripts/` and `apps/backend/scripts/`. `graphify-out/` and `archify/` are present at root and excluded from Docker build context.

## Tech Stack

- **Backend:** Node.js 20 (`.nvmrc`), Express, PostgreSQL (Supabase, RLS), Redis/BullMQ, Socket.IO, Nodemailer/SendGrid, Razorpay, OpenRouter (multi-provider AI)
- **Frontend / Admin:** React 18, Vite 6.4.2, Tailwind CSS 3.x, React Router v6, TanStack Query, Axios 1.18, Lucide Icons
- **Monorepo:** npm 10.8.2 workspaces, Turborepo 2.10.5, Prettier 3.5, Husky 9 + lint-staged 16
- **AI / Search:** pgvector `vector(1536)` + HNSW/ivfflat, Node Engine V1→V4 (Socratic tutor → autonomous OS), Practice↔Test bridge

## Apps And Ports

| App         | Path               | Default Port | Health / Entry |
| ----------- | ------------------ | ------------ | -------------- |
| Backend API | `apps/backend`     | `5001`       | `http://localhost:5001/api/health` |
| Frontend    | `apps/frontend`    | `3000`       | Vite dev server, proxy → backend |
| Admin panel | `apps/admin-panel` | `3002`       | Separate Vercel project |

Backend is single entry `apps/backend/src/app-port5001.js` (1022 route defs, admin chain `restrictAdminOrigin → validateAdminApiKey → protect → admin → auditMiddleware`).

## Prerequisites

- Node.js 20+ (see `.nvmrc`), npm 10.8+
- PostgreSQL (Supabase) + `DATABASE_URL`; optional `DATABASE_READ_URL` (read replica, falls back to primary)
- Redis (Upstash / local) — optional for API dev, required for worker/queues/Socket.IO adapter
- Docker (optional) for `docker-compose.yml` / `deploy/` flows

## Installation

```bash
npm install
# installs all workspaces (apps/*, packages/*)
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
npm run dev              # turbo dev — all apps in parallel
npm run dev:seq           # sequential start (scripts/dev-sequential.mjs)
npm run dev:ordered       # alias of dev:seq
```

Or run individual apps:

```bash
npm run dev:backend  # turbo dev --filter=trstprep-backend
npm run dev:frontend # turbo dev --filter=trstprep-frontend
npm run dev:admin    # turbo dev --filter=trstprep-admin
```

Backend-only worker process:

```bash
cd apps/backend
npm run worker:dev
```

## Build Commands

```bash
npm run build          # echo 'Build completed' (root placeholder)
npm run build:all      # turbo build -- all apps
npm run build:backend  # turbo build --filter=trstprep-backend
npm run build:frontend # turbo build --filter=trstprep-frontend
npm run build:admin    # turbo build --filter=trstprep-admin
```

## Testing And Linting

Root commands:

```bash
npm run test       # turbo test
npm run lint       # turbo lint
npm run format     # prettier --write "**/*.{js,jsx,ts,tsx,json,md}"
npm run load-test         # k6 run tests/load/api.js
npm run load-test:auth    # k6 auth load
npm run load-test:realtime # k6 realtime
```

Current state (verified Aug 23, 2026):

- Backend: Jest, 20 suites — `128–129 passing` in `apps/backend` (run `npm test` in `apps/backend`)
- Frontend: Vitest 4.1.0 (matches Vite 6.4.1) + `@vitest/coverage-v8`; test script present but frontend suite is placeholder in root turbo.
- Admin panel: React + Vite, lint via `eslint@10` / `@eslint/js@10`; no dedicated test script in `package.json`.
- Lint: `npm run lint` — 0 errors, ~500 warnings (triaged in `docs/REMEDIATION_PLAN.md` Phase 10).

## Useful Scripts

```bash
# docs
npm run docs        # if configured in dev-tools/scripts (see scripts/)
npm run watch-docs
```

The `scripts/` directory (and `apps/backend/scripts/`, `apps/backend/src/infrastructure/database/scripts/`) contains one-off audit and repair scripts for data maintenance. Key scripts:
- `scripts/run-database-audit.js` — schema audit (run before any migration)
- `scripts/dev-sequential.mjs` — ordered dev start
- `deploy/logging.md` — logging setup

## Notable Features In This Repo

- Separate learner app (`apps/frontend`) and admin panel (`apps/admin-panel`) — 60 admin manager components across 13 categories (verified `apps/admin-panel/src/features/admin/**/*.jsx`)
- JWT (httpOnly + SameSite=Lax, 30-day absolute / 30-min idle) + CSRF (DB-backed, 5-min cleanup) + fail-closed auth
- 85 backend route files + 33 module routes; 81+ `/api` mounts, 40+ admin routers (`/api/admin/*` with defense-in-depth)
- Exam, test-series (112 migrations), practice lab, study-material, current-affairs, leaderboard, community, referrals, subscriptions (Razorpay) routes
- WebSocket (Socket.IO) with JWT auth + session eviction; Redis adapter + BullMQ queues (analytics, leaderboard, notifications)
- Shared workspace packages: `shared-config` (adminNavConfig single source) + `shared-hooks` (useAuth, useProPass)
- AI gateway (OpenRouter), pgvector semantic search, Node Engine V1→V4; Practice↔Test bridge (`practice_ai_cache`)
- `dbHelpers` god node (131 edges), `protect()`/`admin()` + `useAuth()` — changes ripple across ~70 modules (see `graphify-out/GRAPH_REPORT.md`)

## Documentation

- **Main docs:** `docs/ARCHITECTURE.md` (quick ref, deployment, structure, workflows, hierarchy — refreshed Aug 23, 2026)
- **Development:** `docs/DEVELOPMENT.md` (admin panel 60 components, bulk upload, dev notes, evolve plan)
- **Security:** `docs/SECURITY_POSTURE.md` (CSRF, rate limiting, RLS, admin defense-in-depth — hardened post-audit)
- **Database:** `docs/DATABASE_SCHEMA_AUDIT.md` (112 migrations on disk, ~80 active tables, 154 with legacy, soft-delete, RLS)
- **Remediation:** `docs/REMEDIATION_PLAN.md` (16 critical → 46 high → 73 medium — FINAL STATUS Aug 23, 2026)
- **Site readiness:** `docs/SITE_READINESS_REPORT.md` / `docs/FINAL_SITE_READINESS_REPORT.md` (live-DB verified)
- **Architecture explorer:** `docs/ARCHITECTURE.html` + `docs/FEATURES.html` (interactive HTML, 60+ components, 100+ endpoints)
- **Knowledge graph:** `graphify-out/GRAPH_REPORT.md` — run `/graphify query "<question>"` before grepping

## Notes

- The repo contains historical audits and archive docs; not all documents reflected the latest code state before the Aug 23, 2026 refresh. This README and `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/DATABASE_SCHEMA_AUDIT.md`, `docs/SECURITY_POSTURE.md` have been reconciled with `apps/backend/src/app-port5001.js:1` and live file counts.
- Docker deploy primary: `docker-compose.yml` + `nginx` (`apps/frontend/nginx.conf` mounted as `/etc/nginx/nginx.conf`). Vercel is vestigial per `docs/REMEDIATION_PLAN.md:3`.

---

*Last Updated: August 23, 2026 — content audited against commit `29cc9ed2` + live file counts*
