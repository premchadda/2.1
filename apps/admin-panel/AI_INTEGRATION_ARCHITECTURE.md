# AI Integration Architecture (Admin Panel) — Versioned Design Doc

> Document version: 2.0 (ground-truth rewrite).
> Last verified: 2026-09-06 against `apps/admin-panel/src` and `apps/backend/src`.
> Status legend — every section below carries one banner:
> **LIVE** (wired + verified in code) · **PARTIAL** (pieces exist, not connected) ·
> **PROPOSAL** (design only, needs backend confirmation before asserting).
> Gateway parity items (live OpenRouter model IDs, effective env values, limiter
> values in deploy, `ai_api_usage` DDL in the live DB) are PROPOSAL/unverified
> by policy — see §8.

## 1. Opportunities overview

> **PARTIAL** — only row 1 is wired; the rest are proposals. Last verified 2026-09-06.

| Feature                                   | Priority | Status                         | Notes                                                                                                                                 |
| ----------------------------------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| AI Question Generation                    | P0       | **LIVE (wired, stub backend)** | UI → `POST /admin/ai/generate-questions` → response works; backend handler returns placeholder content, not LLM output (§2.1)         |
| Intelligent Content Tagging               | P1       | **PROPOSAL**                   | No `/admin/ai/suggest-tags` route or caller                                                                                           |
| Semantic Search in admin                  | P1       | **PROPOSAL**                   | AdminLayout search is local nav filtering (§2.3); backend embedding/vector modules exist but are unwired to admin                     |
| Predictive Analytics (churn, forecasting) | P2       | **PROPOSAL**                   | No route or caller                                                                                                                    |
| Content Quality Scoring                   | P2       | **PROPOSAL**                   | No route or caller                                                                                                                    |
| Smart FAQ Generation                      | P2       | **PROPOSAL**                   | No route or caller                                                                                                                    |
| Adaptive Learning Paths                   | P3       | **PROPOSAL**                   | Backend has `modules/ai/` helpers (adaptive-difficulty, ai-mentor, socratic hints) behind `aiRateLimiter`, but no admin-panel surface |
| Voice-to-Question                         | P3       | **PROPOSAL**                   | No route or caller                                                                                                                    |
| Content Moderation                        | P3       | **PROPOSAL**                   | Backend `aiClient.js` has input-moderation checks; no admin surface                                                                   |

## 2. P0–P1 designs

### 2.1 AI Question Generation

> **LIVE (wired) — backend returns stub content.** Last verified 2026-09-06.

**Integration points (corrected to categorised dirs):**

- Callers:
  - `apps/admin-panel/src/features/admin/assessments-quizzes/PracticeQuestionsManager.jsx:788`
  - `apps/admin-panel/src/features/admin/assessments-quizzes/QuizzesManager.jsx:551`
- Backend route: `POST /admin/ai/generate-questions`
  (`apps/backend/src/api/routes/admin-catalog.js:531`, mounted under `/api/admin`).
- Request shape: `{ topic, subject, count, difficulty, isPractice }`.

**Frontend pattern** — always go through `adminAPI.apiClient`, never raw `fetch()`:

```javascript
import { adminAPI } from "../../../shared/lib/api/adminAPI.js";

const res = await adminAPI.apiClient.post("/admin/ai/generate-questions", {
  topic, // string, required
  subject, // e.g. active subject label, fallback "General"
  count, // PracticeQuestionsManager fixes 3; QuizzesManager clamps UI input to 1–15
  difficulty, // e.g. "medium"
  isPractice: true,
});
const questions = res.data?.data ?? [];
```

**Backend reality check:** the current handler builds placeholder question objects
in a loop and returns them — there is no gateway call in that handler. Swapping
in real LLM generation (via `modules/ai/aiClient.js`, with `protect` +
`aiRateLimiter` middleware and usage logging) is a **PROPOSAL**; see §8 for the
unverified gateway items.

**Response contract (observed, stub):** `{ success: true, data: [...], count: n }`.

### 2.2 Intelligent Content Tagging

> **PROPOSAL.** Last verified 2026-09-06 (no route, no caller).

Candidate integration points (categorised dirs — note the old doc's flat
`QuestionsManager.jsx` / `TestsManager.jsx` paths are stale):

- `apps/admin-panel/src/features/admin/assessments-quizzes/` (questions, quizzes)
- `apps/admin-panel/src/features/admin/study-materials/` (materials)

Proposed shape (not implemented — confirm with backend first):

```javascript
const res = await adminAPI.apiClient.post("/admin/ai/suggest-tags", {
  content,
  contentType: "question",
  existingTags: formData.tags,
});
```

### 2.3 Semantic / admin search

> **PARTIAL — admin search is local; vector search is PROPOSAL.** Last verified 2026-09-06.

- **What AdminLayout search actually is:** local navigation filtering over
  `adminNavConfig` items using `filterAndRank` (`src/shared/utils/searchUtils.js`)
  with results surfaced through `CommandPalette`
  (`AdminLayout.jsx:216,235,386`; `src/shared/components/common/CommandPalette.jsx:231`).
  It never touches an embedding service.
- **What exists but is unwired:** backend `POST /api/embeddings/search`,
  `/api/search/questions`, `/api/search/vector` modules. Wiring admin search to
  these is a **PROPOSAL** requiring backend confirmation (index coverage,
  pgvector state in the live DB, latency budget).

## 3. P2 designs (all PROPOSAL, 2026-09-06)

- **Predictive analytics** (`analytics-insights/` managers: DeepAnalytics,
  AdminAnalytics): churn heuristics / forecasting — no endpoint exists.
- **Content quality scoring**: no endpoint exists.
- **Smart FAQ generation** (`notifications-comms/` FaqManager area): no endpoint exists.

When any of these ship, follow the §2.1 pattern (`adminAPI.apiClient.post`,
`protect` + `aiRateLimiter` server-side, usage logging) and promote the banner
to LIVE with a new last-verified date.

## 4. P3 designs (all PROPOSAL, 2026-09-06)

Adaptive learning paths, content moderation, voice-to-question: design-only.
Note the backend already has adjacent building blocks (`modules/ai/aiClient.js`
input moderation, `adaptiveDifficulty.routes.js`, `aiMentor.routes.js`,
`math.routes.js`, all behind `aiRateLimiter`) — an inventory step should precede
any new build to avoid duplication.

## 5. Cost management & rate limiting

> Rate limiter: **LIVE** (code). Cost table: **PROPOSAL/unverified**. Last verified 2026-09-06.

- **Single source of truth:** `apps/backend/src/middleware/aiRateLimiter.js` —
  Redis sliding-window, per-user, 1-hour buckets, fail-open with warning log.
  Free default `50`/hour (`AI_FREE_HOURLY_LIMIT`), Pro default `500`/hour
  (`AI_PRO_HOURLY_LIMIT`). This resolves the old `50` vs `10` conflict: the
  `10/hour` figure existed only in a stale doc snippet, never in the backend.
- **Usage table:** `ai_api_usage` has a turbulent migration history (dropped in
  `019`/`039`/`059`, recreated in `060_create_remaining_missing_tables.sql` with
  `user_id INTEGER REFERENCES users(id)`). **Verify the live DB before relying
  on it** — DDL marked unverified (§8).
- **Model cost table: PROPOSAL.** Previously listed per-1K-token prices for
  several provider model IDs; none are confirmed against the live gateway config,
  so no prices are asserted here. Re-add only after backend confirmation with a
  date.

## 6. Security & privacy (LIVE policy, PROPOSAL specifics)

- **LIVE (code):** backend `aiClient.js` performs input-moderation checks before
  calling the provider; AI routes are expected behind `protect` + `aiRateLimiter`.
- Never send PII to AI APIs; keep credentials server-side only (env names in
  `AI_INFRASTRUCTURE_SETUP.md` §3, never values); log AI calls for audit.
- Validate/sanitise inputs (length caps, prompt-injection patterns) and validate
  AI outputs against a schema before persisting — **PROPOSAL** specifics until a
  live LLM path ships; implement alongside §2.1 backend swap.

## 7. Roadmap

> Last updated 2026-09-06.

**DONE**

- [x] `generate-questions` wired UI → API (PracticeQuestionsManager, QuizzesManager)
- [x] Redis `aiRateLimiter` (Free 50/hr, Pro 500/hr defaults)
- [x] `user_id` INTEGER standard (migration_008 lineage; confirmed in `060` DDL)
- [x] Local admin search (`filterAndRank` + `CommandPalette`)

**DOING**

- [ ] Backend confirmation of gateway parity items (§8)

**TODO**

- [ ] Swap `generate-questions` stub → real LLM call with usage logging
- [ ] `suggest-tags` (P1 proposal)
- [ ] Wire admin search → vector search, or scope it out (P1 proposal)
- [ ] Quality scoring, FAQ generation, churn prediction (P2 proposals)
- [ ] P3 experimental features (proposals)

## 8. Gateway parity — needs backend confirmation (PROPOSAL, 2026-09-06)

Do not assert any of the following until confirmed against deploy + live DB:

1. Exact live OpenRouter model IDs (code defaults `AI_MODEL=gpt-4`, fallback
   `gpt-3.5-turbo` observed in `modules/ai/aiClient.js` — defaults are not proof
   of deploy state).
2. Which `OPENROUTER_*` / `AI_*` envs are actually loaded in each environment.
3. Effective `aiRateLimiter` values in deploy (code defaults 50/500).
4. `ai_api_usage` DDL/row state in the live DB (migration churn noted in §5).
5. pgvector/embedding index state backing any future vector-search wiring.

## 9. `user_id` type note

Per the migration_008 UUID→INTEGER standardisation, `user_id` is documented as
**INTEGER** throughout this doc. Verified 2026-09-06: every `user_id` column in
backend migrations (including `060`'s `ai_api_usage`) is
`INTEGER REFERENCES users(id)`. If live-schema inspection ever proves otherwise
for a specific table, note the exception inline with a date rather than
changing the global rule.

## 10. Testing strategy (PROPOSAL, 2026-09-06)

- Contract-test the stub: `POST /api/admin/ai/generate-questions` returns
  `{ success, data[], count }` for `{ topic, subject, count, difficulty, isPractice }`.
- After the LLM swap: assert schema-validated questions, rate-limit headers
  (`Retry-After` on 429), usage-row writes, and fail-open behaviour with Redis down.
- Keep the QuizzesManager 1–15 clamp covered by a UI test so cost blow-ups stay bounded.
