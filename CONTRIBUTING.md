# Contributing to Trstprep V2.1

Prerequisites: Node.js 22 (`.nvmrc`; `engines: >=20`), `pnpm` 11.25 (`packageManager`
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
  (next is `136_*`); read/write split `DATABASE_URL` / `DATABASE_READ_URL`.
- **AI:** respect `aiRateLimiter`; note admin `generate-questions` is a stub.

## Directory Structure

```text
apps/
  frontend/     # Student-facing React application (:3000)
  backend/      # Node.js/Express API server (:5001, single entry app-port5001.js)
  admin-panel/  # Admin dashboard React application (:3002)
packages/
  shared-config/ # Shared constants, formatters, asset helpers
  shared-hooks/  # Shared React hooks (useAuth, useProPass)
scripts/        # Dev, audit, seeding, taxonomy, load tooling (108 files)
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
