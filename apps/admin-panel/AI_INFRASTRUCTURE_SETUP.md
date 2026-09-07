# AI Gateway: Live Status + Onboarding (Admin Panel)

> Last verified: 2026-09-06 against `apps/admin-panel/src` and `apps/backend/src`.
> Companion design doc: `./AI_INTEGRATION_ARCHITECTURE.md`.
> Scope: admin-panel app (`:3002`) calling backend AI routes. Backend owns all
> secrets and env values — this doc names backend-owned env vars only, never values.

## 1. Live endpoint status

Only one AI endpoint is currently wired end-to-end. Everything else is NOT wired.

| Endpoint                            | Status                                      | Evidence (verified 2026-09-06)                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /admin/ai/generate-questions` | **LIVE (wired)** — see caveat below         | Callers: `src/features/admin/assessments-quizzes/PracticeQuestionsManager.jsx:788` (`adminAPI.apiClient.post("/admin/ai/generate-questions", …)`), `src/features/admin/assessments-quizzes/QuizzesManager.jsx:551` (same pattern). Route: `apps/backend/src/api/routes/admin-catalog.js:531`. Request shape: `{ topic, subject, count, difficulty, isPractice }` |
| `POST /admin/ai/suggest-tags`       | **NOT wired** — no caller, no backend route | —                                                                                                                                                                                                                                                                                                                                                                |
| `POST /admin/ai/quality-score`      | **NOT wired** — no caller, no backend route | —                                                                                                                                                                                                                                                                                                                                                                |
| `GET /admin/ai/search`              | **NOT wired** as an admin-AI route          | Related but separate: backend `POST /api/embeddings/search`, `/api/search/questions`, `/api/search/vector` exist as standalone modules; none are called from the admin panel                                                                                                                                                                                     |
| `POST /admin/ai/generate-faq`       | **NOT wired**                               | —                                                                                                                                                                                                                                                                                                                                                                |
| `POST /admin/ai/predict-churn`      | **NOT wired**                               | —                                                                                                                                                                                                                                                                                                                                                                |
| `POST /admin/ai/transcribe-audio`   | **NOT wired**                               | —                                                                                                                                                                                                                                                                                                                                                                |
| `POST /admin/ai/embed`              | **NOT wired** as an admin-AI route          | Embedding lives in the standalone embeddings module (see above)                                                                                                                                                                                                                                                                                                  |

### Caveat on `generate-questions` (read before demoing)

The backend handler (`admin-catalog.js:531-549`) currently returns
**placeholder/stub question content** — it does not call an LLM provider.
So the endpoint is LIVE in the sense of "wired UI → API → response", but
**real LLM-backed generation is unverified/PROPOSAL** until the handler is
confirmed to call the gateway (see `./AI_INTEGRATION_ARCHITECTURE.md`,
gateway-parity section). Do not present stub output as AI output.

### Caller request shapes (verified)

```javascript
// PracticeQuestionsManager.jsx:788-797
await adminAPI.apiClient.post("/admin/ai/generate-questions", {
  topic: aiPromptTopic, // string, required (toast-guarded)
  subject: activeSubjectObj?.label || "General",
  count: 3, // fixed
  difficulty: "medium", // fixed
  isPractice: true,
});

// QuizzesManager.jsx:550-559
await adminAPI.apiClient.post("/admin/ai/generate-questions", {
  topic: aiTopic, // string, required (toast-guarded)
  subject: selectedSubName, // aiSubject || subjects[0]?.label || "General"
  count: clampedAiCount, // UI input clamped to 1–15
  difficulty: aiDifficulty,
  isPractice: true,
});
```

Pattern rule: always call AI routes via `adminAPI.apiClient.post(...)`
(`src/shared/lib/api/adminAPI.js`), never raw `fetch()`.

## 2. Rate limiting — single source of truth (resolved)

There was a past discrepancy between `50` and `10` requests/hour across docs.
Resolved 2026-09-06 in favour of the code:

- **Single source**: `apps/backend/src/middleware/aiRateLimiter.js`
- **Mechanism**: Redis sliding-window counter, per-user, 1-hour buckets; fails
  open (allows request) with a warning log when Redis is unavailable.
- **Limits**: Free users `50`/hour (default for backend-owned `AI_FREE_HOURLY_LIMIT`);
  Pro users `500`/hour (default for `AI_PRO_HOURLY_LIMIT`).
- The `10/hour` figure appeared only in a stale inline doc snippet
  (`checkRateLimit … count < 10`) in a previous version of
  `./AI_INTEGRATION_ARCHITECTURE.md`. That snippet has been removed; it was
  never the backend implementation.

## 3. Backend-owned environment names (names only, no values)

Set these server-side only. Never commit values, never print them in docs or logs.

| Variable                                                                                      | Purpose                | Default observed in code                                                                           |
| --------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `AI_API_KEY` (fallback `OPENROUTER_API_KEY`)                                                  | Gateway credential     | none — must be provided server-side                                                                |
| `AI_BASE_URL`                                                                                 | Gateway base URL       | provider default in `modules/ai/aiClient.js`                                                       |
| `AI_MODEL`                                                                                    | Primary chat model ID  | `gpt-4` (code default — parity **unverified**, confirm with backend before asserting a live model) |
| `AI_PROVIDER`                                                                                 | Provider label         | `openrouter`                                                                                       |
| `AI_MAX_TOKENS`                                                                               | Max tokens per request | `2000`                                                                                             |
| `AI_TEMPERATURE`                                                                              | Sampling temperature   | `0.7`                                                                                              |
| `AI_FALLBACK_BASE_URL` / `AI_FALLBACK_API_KEY` / `AI_FALLBACK_MODEL` / `AI_FALLBACK_PROVIDER` | Fallback provider      | fallback model default `gpt-3.5-turbo` (**unverified**)                                            |
| `AI_FREE_HOURLY_LIMIT` / `AI_PRO_HOURLY_LIMIT`                                                | Rate-limit tuning      | `50` / `500`                                                                                       |

> Gateway parity (exact OpenRouter model IDs in production, which envs are
> actually loaded in deploy, effective limiter values, `ai_api_usage` DDL in the
> live DB) needs backend confirmation — those spots are marked
> PROPOSAL/unverified with dates in `./AI_INTEGRATION_ARCHITECTURE.md`.
> Note: `ai_api_usage` was dropped and recreated across migrations
> (see migrations `019`, `039`, `059`, `060`); migration `060` recreates it with
> `user_id INTEGER REFERENCES users(id)` per the migration_008 INTEGER standard.
> Verify the live DB before relying on it.

## 4. Onboarding (no secrets required on your machine)

1. Confirm the backend route is mounted: `POST /api/admin/ai/generate-questions`
   → handler in `apps/backend/src/api/routes/admin-catalog.js`.
2. Set the backend-owned env vars listed above **in the backend runtime only**.
3. Restart the backend; exercise generation from the admin panel:
   Practice Questions manager → AI generation modal, or Quizzes manager → AI quiz
   generator (count is clamped to 1–15 client-side).
4. Check backend logs for `[AI RateLimiter]` warnings (Redis unavailable =
   degraded/fail-open mode) and confirm responses are no longer stub content
   before treating output as real AI generation.
5. To add a new AI endpoint later: add the backend route, add an `adminAPI`
   wrapper or call `adminAPI.apiClient.post(...)` from the categorised manager
   dir (`assessments-quizzes/`, `study-materials/`, `analytics-insights/`,
   `notifications-comms/`), and update the status table in section 1.

## Appendix A — Costs / models (dated, UNVERIFIED proposal)

> Status: **PROPOSAL / unverified as of 2026-09-06**. Do not budget against
> these numbers — they are carried over from the pre-verification doc and await
> backend confirmation of live model IDs and pricing.

| Feature (proposed)  | Indicative usage        | Old estimate |
| ------------------- | ----------------------- | ------------ |
| Question Generation | 500 requests/month      | $15–25/month |
| Content Tagging     | 2,000 requests/month    | $5–10/month  |
| Semantic Search     | 5,000 searches/month    | $10–20/month |
| Quality Scoring     | 1,000 evaluations/month | $5–10/month  |

Previous doc also claimed ~1,290% ROI on question-creation time saved; that
calculation is likewise unverified and retained here only as a historical note.
Recompute from measured acceptance/edit rates after real LLM generation ships.
