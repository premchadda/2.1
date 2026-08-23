# Changelog

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
