# Node Engine V4–V6 — VISION (not implemented)

> **As-of:** 2026-09-06. **⚠️ VISION DOCUMENT — none of this is code.**
> Shipped reality: Node V1 (`nodes` table, migration `106`), V2 partial
> (`user_node_skill` only, no `ai_meta`). There are NO `ai_tutor_memory`,
> `curriculum_nodes`, `ai_generated_questions`, `exam_simulations`, or
> `world_state` tables in migrations `000`–`135` (verified by grep).
> Moved here from `docs/AI_PROMPTS.md` on 2026-09-06 to stop vision being
> mistaken for shipped behavior. No secrets in this file.

---

## V4 — AI-generated question pipeline (vision)

Autonomous generation of practice questions from curriculum nodes: ingestion →
distractor synthesis → difficulty calibration → human-review queue → publish into
the question bank with `test_questions` junction writes. Requires tables that do
not exist (`ai_generated_questions`, `curriculum_nodes`). Open design questions:
who approves generated items, how difficulty is calibrated against live attempt
data, and how snapshots (`attempt_question_snapshots`) stay immutable once
generated items enter circulation.

## V5 — Exam simulations (vision)

Full exam-day simulation harness: timed environment, proctoring event stream,
adaptive breaks, post-sim debrief with readiness deltas. Requires tables that do
not exist (`exam_simulations`). Depends on waves-19 proctoring pipeline and the
exam-readiness service as scoring inputs.

## V6 — Autonomous education OS / world state (vision)

Persistent learner world-model (`world_state` — does not exist): long-horizon
planning across syllabus, spaced-repetition scheduling, Socratic tutor memory
(`ai_tutor_memory` — does not exist) withforgetting-curve updates. This is the
research horizon, not a roadmap commitment. Any future implementation must pass
through `aiRateLimiter`, `MessageBroker` publication, and `audit_trail` writes
like all other AI features.

---

## Promotion criteria (when a V-item becomes real)

1. Migration lands creating the tables (next available: `136_*`).
2. `docs/AI_PROMPTS.md` §0 truth table flips the row to ✅/🟠 with migration number.
3. Enforcement + tests land alongside (cf. `TestPolicyEngine`, lifecycle tests).
4. `docs/FINAL_SITE_READINESS_REPORT.md` §T removes the corresponding unknown.
