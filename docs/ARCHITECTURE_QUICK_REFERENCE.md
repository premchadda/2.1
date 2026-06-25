# Trstprep V2.1 — Quick Architecture Reference

## Stack
- **Frontend:** React 18 + Vite + Tailwind + React Query + React Router v6
- **Admin Panel:** React 18 + Vite + Tailwind + React Query (separate app)
- **Backend:** Node.js 20 + Express + PostgreSQL (Supabase) + Redis (BullMQ) + Socket.IO
- **Database:** PostgreSQL via Supabase (RLS enabled)
- **Cache:** Redis (optional, graceful degradation)
- **Queue:** BullMQ (analytics, leaderboard, notifications, recommendations)
- **Storage:** S3 / Supabase Storage / local disk (configurable)
- **Email:** Nodemailer
- **Payments:** Razorpay
- **AI:** OpenRouter multi-provider (OpenAI, Anthropic, Gemini)

## Repo layout
```
apps/
  frontend/          - User-facing SPA (port 3000)
  admin-panel/       - Admin SPA (port 3002)
  backend/           - Express API (port 5001)
packages/
  shared-config/     - Shared constants (admin nav, coming-soon, etc.)
  shared-hooks/      - Shared React hooks
docs/                - Documentation
supabase_data/       - Scraped exam data (PYP, Mock Test)
graphify-out/        - Knowledge graph artifacts (do not deploy)
```

## Backend layers
```
apps/backend/src/
  app-port5001.js          - Single Express entrypoint (1644 lines)
  api/routes/              - 40+ router files (refactor in progress)
  modules/                 - Domain modules (auth, tests, attempts, ...)
    auth/
    tests/
    attempts/
    ...
  infrastructure/
    database/
      postgres-helpers.js  - ~3000 lines dbHelpers façade + initTables()
      migrations/          - 14 .sql files (003-017 missing!)
    cache/
    email/
    events/
    queue/
    storage/
    websocket/
  middleware/              - auth, csrf, error, origin, audit, etc.
  services/                - Business logic (analytics, leaderboard, etc.)
  data/
    models/                - MongoDB-like shims over PostgreSQL
  shared/
    config.js
    validation/
  __tests__/               - Jest tests
```

## Key data flows
- **Authentication:** httpOnly cookies + JWT (HS256) + CSRF tokens (DB-backed)
- **Real-time:** Socket.IO with JWT auth, session eviction
- **Background jobs:** BullMQ workers (testScheduler, outboxPoller, attemptCleaner)
- **File uploads:** Multipart → `/api/admin/assets/upload` → storage provider
- **Payments:** Razorpay order → verify signature → activate subscription

## Database
- ~79 tables in production
- 14 migrations on disk (003-017 are MISSING — must be recovered)
- 5 RPC functions called but NOT in migrations (must be created from `000_baseline_functions.sql`)
- 6 tables referenced but never created (see `030_create_missing_tables.sql`)
- RLS enabled on all tables but only 1 policy exists (service role only)

## Hot paths
- `/api/auth/*` — login, register, OAuth, password reset
- `/api/tests/:id/start|submit|result` — test lifecycle
- `/api/users/profile|enroll|attempts` — user state
- `/api/admin/*` — admin CRUD (CSRF + admin role)
- `/api/practice/*` — practice questions
- `/api/intelligence/*` — leaderboard, streak, top performers

## Common tasks
- **Add a new admin manager:** Create file in `apps/admin-panel/src/features/admin/<category>/`, add to `features/admin/index.js`, add route in `App.jsx`, add nav item in `shared/config/adminNavConfig.js`.
- **Add a new API endpoint:** Create or extend a router file in `apps/backend/src/api/routes/` or `apps/backend/src/modules/`, mount in `app-port5001.js`, add to docs/api/ if exists.
- **Add a new DB table:** Add to a new migration file `030_xxx.sql`, also add to `postgres-helpers.js` `initTables()` if needed.
- **Run a migration:** `node apps/backend/scripts/run-migration.js` (or restart the backend — `migrationRunner.js` runs on boot).

## Open issues (see AUDIT_REPORT.md)
- 5 critical blockers (secrets, missing migrations, missing functions, missing tables, is_active filter)
- 12 high priority
- 29 medium/low

## Deployment
- Frontend: built with Vite, deployed to Vercel/Netlify/Cloudflare Pages
- Admin Panel: same as frontend but on a separate domain
- Backend: Docker container, deployed to Railway/Render/Fly.io
- Database: Supabase managed
- Migrations: applied automatically on backend boot
