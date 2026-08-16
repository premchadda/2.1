# Trstprep — Agent Operating Rules

Turborepo monorepo: `apps/frontend` (React/Vite), `apps/backend` (Express/Node),
`apps/admin-panel` (React), `packages/*` (shared-config, shared-hooks).
Backend → PostgreSQL (Supabase) + Redis (BullMQ, Socket.IO adapter).

## START HERE — use the knowledge graph, do NOT search from scratch
A knowledge graph of this repo lives in `graphify-out/`. Before exploring the
codebase, consult it first — it is the accumulated map of architecture, secrets,
and cross-cutting connections.

- `graphify-out/GRAPH_REPORT.md` — audit report (god nodes, surprising
  connections, hyperedges, suggested questions).
- `graphify-out/graph.json` — raw graph data (`node_link_graph` format).
- Query it instead of grepping blindly:
  - `/graphify query "<question>"` — broad BFS context
  - `/graphify explain "<node>"` — everything connected to a concept
  - `/graphify path "<A>" "<B>"` — shortest path between two concepts
- After any code change, refresh the graph: `/graphify --update`
  (code-only changes are re-extracted for free; docs need LLM re-extraction).
- Benchmark: the graph answers "how does X work?" in ~16k tokens vs ~1.6M for
  reading the whole 907-file / 1.2M-word corpus (~103x cheaper).

## PRE-FLIGHT AUDIT — verify BEFORE writing code or running migrations
These are real, graph-surfaced landmines. Check them every session:

1. **Active credential / PII leaks in git history**
   (`docs/SECURITY.md`, `AUDIT-REPORT.md`, `COMPREHENSIVE-AUDIT-REPORT.md`)
   - `apps/backend/.env` with Supabase `DATABASE_URL`, `JWT_SECRET` /
     `JWT_REFRESH_SECRET`, Razorpay keys was committed → DB takeover + JWT
     forgery risk. Never log, echo, or commit secrets.
   - 528 `test_attempts` rows + 196 real user IDs (Indian names) were
     committed → DPDP Act 2023 "Notice" obligation.
   - Leaked MiniMax key in `M3 Key.txt`; verify any key you might read is
     rotated, not live.
   - Guard rails: `.gitignore` + pre-commit PII hook + CI `data-guard.yml`
     (fails build on PII keys). After any secret touch, run
     `git filter-repo` scrub + rotation runbook.

2. **Database schema state before ANY migration/DDL**
   (`docs/legacy-migrations/README-schema-fixes.md`, `ARCHITECTURE.md`)
   - `migration_008` standardizes `user_id` UUID→INTEGER, adds
     `test_category_series` junction table, soft-delete pattern, audit trail.
   - Migrations 003–017 reconstructed in `098_reconstructed_baseline.sql`.
   - Migrations 094–101 added (certificates, missing tables, soft-delete
     columns, exam_id type fix, RLS policies, duplicate table reconciliation,
     achievement consolidation).
   - Run `scripts/run-database-audit.js` first; do NOT assume tables/indexes
     exist. Read/write split: write pool = `DATABASE_URL`, read pool =
     `DATABASE_READ_URL` (falls back to primary).

3. **Core abstractions you will likely touch (god nodes)**
   `dbHelpers` (131 edges), `pool`, `protect()` (auth), `admin()`,
   `useAuth()`, `PostgresHelpers`, `apiClient`, `getRedisClient()`.
   Edits ripple across ~70 modules — trace edges in the graph before changing.

4. **Write/guard rails**
   Respect `aiRateLimiter`, publish to `MessageBroker` (Redis Pub/Sub +
   BullMQ), and write `audit_trail` entries. The admin router enforces
   `normalizeFields → restrictAdminOrigin → validateAdminApiKey → protect →
   admin → auditMiddleware` — do not bypass.

## Multi-agent deployment (global rule)
Before fanning out work to multiple agents, follow
`.agents/rules/MULTI_AGENT_DEPLOYMENT_RULE.md` — one orchestrator, exclusive
write territories, pre-flight checks, dispatch protocol, and verify gates.

## AI features (read before touching AI code)
- AI gateway: OpenRouter (multi-provider) via `admin-ai.js` router.
- Semantic search: pgvector (`vector(1536)` + ivfflat cosine indexes).
- "Node Engine" evolves V1 (flat `nodes` table) → V2 (learning graph +
  spaced repetition) → V3 (Socratic AI tutor) → V4 (autonomous education OS).
- Practice Lab (`docs/specifications/PRACTICE_LAB_PRD.md`) and Test Engine feed each other
  via the Practice↔Test bridge; AI extras cached in `practice_ai_cache`.
