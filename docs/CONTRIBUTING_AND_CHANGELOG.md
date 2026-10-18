# Trstprep V2.1 — Contribution Standards, Team Workflows & Release Changelog

> **Consolidated Guidelines: Contribution Workflow, Coding Standards & Version Release History.**  
> Consolidated: October 18, 2026.  
> This document unites:
>
> 1. **Contribution Guidelines & Coding Standards** (formerly CONTRIBUTING.md)
> 2. **Release Changelog & Version History** (formerly CHANGELOG.md)
> 3. **Dynamic Release & Contributor Workspace** (Dedicated space for future version bumps and PR notes)

---

## 📌 Master Table of Contents

- [1. Contribution Guidelines & Developer Workflow](#1-contribution-guidelines--developer-workflow)
- [2. Version Changelog & Release History](#2-version-changelog--release-history)
- [3. Dynamic Release & Contributor Workspace](#3-dynamic-release--contributor-workspace)

---

# 1. Contribution Guidelines & Developer Workflow

# Contributing to Trstprep V2.1

Prerequisites: Node.js 22 (`.nvmrc`; `engines: >=20` — a bump to `>=22.0.0`
is orchestrator-only: do not edit root `package.json` from a territory;
propose it to the orchestrator instead), `pnpm` 11.25 (`packageManager`
pin), Python 3.11+ with `uv`, PostgreSQL (Supabase) + Redis, Docker optional.

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Consult the knowledge graph first: `/graphify query "<what you will touch>"`
   (see `AGENTS.md`; never brute-force grep when the graph has the context)
4. Make your changes inside ONE write territory
   (`.agents/rules/MULTI_AGENT_DEPLOYMENT_RULE.md` — `apps/frontend`,
   `apps/backend`, `apps/admin-panel`, `packages/*`, `scripts/`, `docs/`;
   root configs are orchestrator-only)
5. Before any migration/DDL: `node scripts/run-database-audit.js`
6. Run tests: `pnpm test` (turbo; per-app: `pnpm --filter <pkg> test`)
7. Lint: `pnpm lint`. Format: `pnpm format`
8. Commit with semantic messages: `git commit -m "feat: add new feature"`
9. Push and create a Pull Request (CI runs `data-guard.yml` — no secrets/PII)

## Setup

```bash
# Node dependencies (pnpm workspaces — do not use npm install)
pnpm install

# Python AI environment
uv venv .venv && uv pip install -e .   # see pyproject.toml / uv.lock

# Env files (never commit real values)
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/admin-panel/.env.example apps/admin-panel/.env

# Start development servers (sequential) / parallel
pnpm dev
pnpm run dev:turbo

# Build for production
pnpm run build
```

## Guard Rails (non-negotiable)

- **Secrets/PII:** never log, echo, commit, or paste credentials, connection
  strings, or user data. `.env` files are untracked; rotation + history-scrub
  runbook lives in `docs/REMEDIATION_PLAN.md` (Phase 0/2.1).
- **Admin chain:** preserve `normalizeFields → restrictAdminOrigin →
validateAdminApiKey → protect → admin → validateCsrfToken →
loadAdminPermissions → requireAdminPermission → auditMiddleware`.
- **God nodes:** `PostgresHelpers`, `DataService`, `pool`, `dbHelpers`,
  `protect()`, `useAuth()` ripple across ~70 modules — trace graph edges first.
- **Migrations:** append-only `apps/backend/src/infrastructure/database/migrations/`
  (next is `154_*`; latest shipped is `153_test_dedupe_and_category_link_repair`); read/write
  split `DATABASE_URL` / `DATABASE_READ_URL`.
- **AI:** respect `aiRateLimiter`; admin `generate-questions`
  (`admin-catalog.js`) is live (OpenRouter call with validation + insert-only
  results; template fallback only when AI keys are absent).
- **Auth model:** single `admin` role — there is no second admin tier;
  do not introduce one.
- **Route hygiene:** previously dormant module controllers are wired into the
  composition root (`app-port5001.js`) — keep them mounted; run
  `node scripts/validate-routes.js` after touching mounts.

## Directory Structure

```text
apps/
  frontend/     # Student-facing React application (:3000)
  backend/      # Node.js/Express API server (:5001, single entry app-port5001.js)
  admin-panel/  # Admin dashboard React application (:3002)
packages/
  shared-config/ # Shared constants, formatters, asset helpers
  shared-hooks/  # Shared React hooks (useAuth, useProPass)
scripts/        # Dev, audit, seeding, taxonomy, load tooling (112 files)
deploy/         # Docker, nginx, logging
docs/           # Living docs, audits, vision, walkthroughs
graphify-out/   # Knowledge graph (query it; do NOT deploy it)
```

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Maintenance tasks

Example: `feat: add live test leaderboard integration`

## Code Style

- Use 2-space indentation
- Use camelCase for variables and functions
- Use PascalCase for components and classes
- Use kebab-case for file names (components use PascalCase)
- Keep lines under 100 characters

## Pull Request Checklist

- [ ] Tests pass locally (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Changes stay inside one territory; graph consulted for god-node impact
- [ ] No secrets, keys, hostnames, or PII in diff (`git diff --stat` reviewed)
- [ ] Code follows project conventions
- [ ] Documentation updated if needed
- [ ] Changes tested manually
- [ ] No console.log statements left in production code

---

# 2. Version Changelog & Release History

# Changelog

## 2026-09-06 - Full Documentation Rewrite (all 35 repo docs re-verified)

### Toolchain + history since Aug 23

- pnpm 11.25 / uv switch (`cd9d9ebd`), turbo `^2.10.12`, Node 22 (`.nvmrc`, engines `>=20`)
- Waves 17-20: candidate intelligence (`studyRoadmap`/`socraticHint`/`examReadiness`), live proctoring console, ranking service, modular QA audit, system stabilization
- Migrations `102`–`135` on disk (attempt numbering, Node Engine V2 tables, practice redesign, junction ensure, webhook events, RLS waves, lifecycle/shuffle seed, perf backfills); next is `136_*`
- Fixes: avatar uploads 404, `prop-types` Vercel build failure (`a3651475`), results dual-write, coupon alias, live-tests composition, junction sync, admin live-tests router
- Knowledge graph rebuilt: 10862 nodes / 20266 edges / 1744 files (was 16874/22184)

### Docs — every file rewritten or re-verified

- Living docs rewritten: `ARCHITECTURE.md` (~250 lines, pnpm/uv, P0 closure log), `DEVELOPMENT.md` (correct admin paths, shipped-status inversion), `AI_PROMPTS.md` (V1✅/V2 partial/V3–V6 vision quarantine → `docs/vision/NODE_ENGINE_V4-V6.md`), `test-quiz-lifecycle.md` (+ABANDONED state, wire-format note)
- Reports: `SITE_READINESS_REPORT.md` frozen as historical; `FINAL_SITE_READINESS_REPORT.md` promoted to living scorecard (~6/10 rescore)
- Audits re-verified: D1/D2/D3 findings mostly FIXED (results writes, Checkout, live rank/persist, junction sync); `UNIFIED`/`DATABASE_SCHEMA_AUDIT`/`REMEDIATION` (status tokens)/`SECURITY_POSTURE` refreshed; `legacy-migrations` reframed historical
- Backend/deploy docs: `API_ENDPOINTS.md` (phantom contracts removed, 2FA corrected), `DATABASE_REPLICAS.md` (real defaults), `database/README.md`, `scripts/README.md` (108-file inventory), `tests/load/README.md`, `deploy/logging.md` (normative Loki)
- Frontend/admin docs: AI gateway live-status, versioned integration arch, config READMEs, `routingUpdates.md` replaced with live route map
- Root: README/AGENTS refreshed; CONTRIBUTING rewritten (Node 22, territories, DB/secret/graph guards); `walkthrough.md` sanitized → `docs/walkthroughs/`; schema dictionary header (snapshot disclaimer)
- Open items carried forward: test-suite count conflict (128–129 vs 157 — re-run), achievements `results` field-mapping check, `git filter-repo` history scrub, fresh-DB boot proof

## 2026-08-23 - Documentation Content Refresh (real content, not just dates)

### Documentation — content audited against live codebase (`ls`, `package.json`, `app-port5001.js`, `graphify-out`)

#### `README.md` (complete rewrite of core sections)

- Workspace layout: `dev-tools/` → `scripts/` + `deploy/` + `graphify-out/`/`archify/`; added `packages/shared-config` + `shared-hooks` truth, `turbo.json` 2.10.5, `.husky`
- Tech stack: pinned versions — Node 20, Vite 6.4.2, Axios 1.18, Turborepo 2.10.5, Nodemailer 9.x, Tailwind 3.x; added pgvector HNSW, OpenRouter, BullMQ 5.x
- Backend env: documented `JWT_REFRESH_SECRET`, `ADMIN_API_KEY`, `PGCRYPTO_KEY`, `DB_ENCRYPTION_KEY` + secret rotation pre-flight
- Runtime: added `npm run dev:seq`/`dev:ordered`, `load-test:*` (k6), worker `npm run worker:dev`
- Testing: backend Jest 20 suites (157 passing) vs frontend Vitest 4.1 placeholder — verified
- Features: 60 admin components (was 43), 85 route files + 33 module routes (was 40+), 112 migrations, god nodes `dbHelpers`/`protect()`/`useAuth()`

#### `docs/ARCHITECTURE.md` (5 sections rewired)

- **Stack:** Vite 6.4.2, Turborepo 2.10.5, BullMQ, pgvector `vector(1536)` HNSW, per-user AI rate limiter
- **Repo layout:** corrected tree (87 frontend pages, 60 admin components, 112 migrations, scripts canonical)
- **Backend layers:** 1022 route defs, duplicate mount block noted, `migrationRunner.js` advisory lock, `initTables()` legacy duplicate flagged
- **Database:** 80 allowlist → 154 live tables, 101 → 112 migrations (094-112), RLS cosmetic `099` noted, `database-replicas.js` MITM risk
- **Project structure:** `dev-tools/` → `scripts/` + `graphify-out`, `packages/` not empty
- **API routes:** 26 → 85 route files table with admin-* defense chain, shadowed `live-tests-public` vs `liveMock`
- **Database stats:** 78 → ~80/154 split, 112 migrations
- **Admin panel:** 43 → 60 components across 13 categories (full breakdown)
- **Deployment:** Docker Compose + nginx primary (pinned `1.27-alpine`, HEALTHCHECK), Vercel vestigial

#### `docs/DEVELOPMENT.md`

- Admin components 43 → 60 (full 13-category breakdown, `dir /s /b` verified)
- Technology stack: added Vite 6.4.2, `shared-hooks`, `shared-config` single source, Husky
- Status `✅ Implemented` retained, dates `Mar 22` → `Aug 23`

#### `docs/DATABASE_SCHEMA_AUDIT.md`

- Header: 000–093 (94 files) → 000–112 (112 files), ~75-80 → ~80/154 tables
- Migration inventory: added row `102–112 | 11 | Recent fixes`
- Audit date `2026-07-25` → `2026-08-23`

#### `docs/SECURITY_POSTURE.md`

- Header: added verification sources (`app-port5001.js`, `auth.middleware.js`), prior audit `2026-08-23`
- Summary: added defense-in-depth chain + rate limiters + `responseCache` bypass note
- Appendix: titled prior auth/dashboard/exam audit dumps as retained Aug 23 appendix

#### `docs/SITE_READINESS_REPORT.md` / `docs/FINAL_SITE_READINESS_REPORT.md`

- Generated `2026-08-14` → `2026-08-23` + docs-refresh provenance
- Scale: 136→154 tables, 107→112 migrations, 81→85 route files
- Added `Last Updated: 2026-08-23` to FINAL report

#### Other docs

- `docs/legacy-migrations/README.md`, `SCHEMA_DIAGRAM.md`, `QUICKSTART.md`: added `Last Updated: 2026-08-23`
- `apps/backend/src/infrastructure/database/README.md`: `2026-06-15` → `2026-08-23`
- `docs/UNIFIED_TRSTPREP_AUDIT.md` (and root copy): `2026-07-25/26` → `2026-08-23` (verification, backend audit, npm view check, remediation complete)
- `docs/REMEDIATION_PLAN.md`: migration seq 093 → 112, `FINAL STATUS` expanded with docs-refresh provenance
- `docs/ARCHITECTURE.html`, `docs/FEATURES.html`: `Feb 25 / Mar 8 / Mar 10` → `Aug 23, 2026`
- `docs/audit/D1/2/3`: `Aug 14` → `Aug 23`

---

## 2026-03-31 - Repository Audit Fixes

### Critical Fixes

- Fixed adminApi.js localStorage authentication contradiction
- Fixed missing ActivityOrderReport export
- Deleted duplicate insecure AuthContext
- Fixed hardcoded localhost URLs in .env files
- Fixed password hash exposure in UserRepository
- Fixed Vite proxy hardcoded to localhost
- Fixed localStorage usage in AdminLayout logout
- Fixed localStorage fallback in ComingSoonManager

### High Severity Fixes

- Removed mock response fallback in ContentManagement
- Added environment variable validation
- Removed password output from seed files
- Created shared-hooks package
- Removed VITE_ADMIN_API_KEY exposure
- Removed console.log from apiBase.js
- Added WebSocket reconnection backoff
- Deleted seedData.js duplicate

### Medium Severity Fixes

- Created docker-compose.yml
- Created .env.example files
- Removed debug logging from dataService
- Cleaned temp files from dev-tools
- Removed duplicate knip report

---

---

# 3. Dynamic Release & Contributor Workspace

> [!IMPORTANT]
> **DO NOT CREATE NEW DOCUMENTATION FILES FOR INCREMENTAL UPDATES.**  
> All future pull request notes, developer territory rules, or release version logs must be appended directly into this section.

### 3.1 Recent Release Notes (Oct 18, 2026)

- **Monorepo Cleanup & Restructuring**:
  - Reduced root directories from 28 down to 10 standard workspaces.
  - Consolidated offline ingestion pipelines, exam books, and OCR scripts into `content-pipeline/`.
  - Moved standalone developer toolkits into `tools/` (`archify`, `agent-skills`).
  - Merged and structured living documentation in `docs/` with zero dead files.
  - Verified 100% test pass rate across 126 test suites (1,159 passing tests) with 0 lint errors.

### 3.2 Territory & PR Log

_(Record new module ownerships, feature branch releases, or review gates here)_
