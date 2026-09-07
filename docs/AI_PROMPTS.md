# Trstprep V2.1 — AI Prompts & AI Surface

> **As-of:** 2026-09-06. No secrets in this file.
> This doc = (a) the **shipped** AI surface (small), plus (b) pointers to prompt
> specs. Anything Node V3+ lives in `docs/vision/` and is **VISION, not code**.

---

## 0. ⚠️ SHIPPED vs VISION — read this first

| Generation                                                                                                             | Status 2026-09-06                                     | Evidence                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Node V1 — flat `nodes` table                                                                                           | ✅ IMPLEMENTED                                        | `apps/backend/src/infrastructure/database/migrations/106_node_engine_v2_learning_graph.sql:4` (`CREATE TABLE nodes`) |
| Node V2 — learning graph + spaced repetition                                                                           | 🟠 PARTIAL — `user_node_skill` only, **no `ai_meta`** | Same migration `:23` (`CREATE TABLE user_node_skill`); no `ai_meta` table/column anywhere in migrations              |
| Node V3 — Socratic tutor memory (`ai_tutor_memory`, `curriculum_nodes`)                                                | ❌ NOT IMPLEMENTED                                    | No such tables in any migration `000`–`135`                                                                          |
| Node V4–V6 — generated questions, exam sims, world state (`ai_generated_questions`, `exam_simulations`, `world_state`) | ❌ NOT IMPLEMENTED — vision docs only                 | Moved to `docs/vision/NODE_ENGINE_V4-V6.md`                                                                          |

Do not present V3–V6 as shipped. Do not invent table names beyond the grep above.

---

## 1. Shipped AI endpoints & helpers

| Surface                    | Where                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/ai/mentor`      | `apps/backend/src/app-port5001.js:1015`                                                                                                                                           |
| `POST /api/ai/explanation` | `apps/backend/src/app-port5001.js:1016`                                                                                                                                           |
| `/api/ai/logs`             | AI logs router (usage/audit trail of AI calls)                                                                                                                                    |
| Intelligence router        | `apps/backend/src/api/routes/intelligence.js` → `studyRoadmapService.js`, `socraticHintService.js` (`generateSocraticHint`), `examReadinessService.js` (`calculateExamReadiness`) |
| Gateway                    | OpenRouter multi-provider (OpenAI, Anthropic, Gemini) via `admin-ai.js` router; env names `OPENROUTER_*`                                                                          |
| Guard rails                | `aiRateLimiter` (free ~50/h, pro ~500/h; env names `AI_RATE_LIMIT_*`); `practice_ai_cache` table for cached AI extras                                                             |
| Semantic search            | pgvector `vector(1536)` + ivfflat cosine indexes                                                                                                                                  |

Tests: `src/__tests__/studyRoadmap.test.js`, `socraticHint.test.js`, `examReadiness.test.js`.

---

## 2. Frontend chart/realtime correction (old claims were wrong)

`chart.js` + `recharts` + `socket.io-client` **all exist** in `apps/frontend/package.json`
and are used. Any older note claiming they are missing is superseded as of 2026-09-06.

---

## 3. Admin bulk paths correction

Bulk admin UI lives under **`apps/admin-panel/...`** (e.g.
`apps/admin-panel/src/features/admin/`), NOT under `apps/frontend/src/features/admin/`
(which does not exist). Backend bulk endpoints: `api/routes/admin-bulk-ops.js`
(incl. `POST /tests/bulk-reassign`), `admin-import.js`.

---

## 4. No landing app

There is **no separate landing app**. Public marketing/discovery pages are part of
the frontend SPA (`apps/frontend`, port 3000).

---

## 5. Prompt library index (historical specs — design input, not live behavior)

The legacy prompt dumps that used to bloat this file (admin-panel master spec,
V4–V6 autonomous-OS narratives) have moved:

- Node V4–V6 vision dumps → **`docs/vision/NODE_ENGINE_V4-V6.md`**
- Admin-panel master specification → the living implementation in
  `docs/DEVELOPMENT.md` §5 + `apps/admin-panel/src/features/admin/` (60+ components)
- Practice Lab PRD pointer → `docs/specifications/PRACTICE_LAB_PRD.md`
  (Practice↔Test bridge; AI extras cached in `practice_ai_cache`)

When writing NEW prompts for the shipped surface, constrain the model to:
(1) shipped endpoints only (§1), (2) lifecycle constants
(`src/constants/lifecycle.constants.js`), (3) `TestPolicyEngine` error codes,
(4) `practice_ai_cache` reuse. Forbid inventing V3–V6 tables.

---

## 6. Suggested prompt skeleton (shipped mentor)

```text
You are Trstprep's study mentor. You have: the student's attempt summary
(scores, per-question time, weak areas from examReadinessService) and the
question snapshot (frozen at submit time). You do NOT have live DB access.
Rules: Socratic hints before direct answers; never reveal live-contest
solutions while the contest window is active (RESULT_LOCKED); cite
question IDs, not invented content.
```

---

## 7. Further reading

- `docs/vision/NODE_ENGINE_V4-V6.md` — full V4–V6 vision dumps
- `docs/ARCHITECTURE.md` §8/§10 — waves 17–20, Node status one-liner
- `docs/test-quiz-lifecycle.md` — attempt/test states the AI must respect
