# Trstprep V2.1 — Test & Quiz Lifecycle Specification

This document is the **single source of truth** for all business rules, entitlement contracts, state machines, timing constraints, and access permissions across the frontend and backend.

> **As-of:** 2026-09-06 (ABANDONED added as 10th attempt state; enforcement pointers; changelog).
> Code mirror: `apps/backend/src/constants/lifecycle.constants.js:6-107`.
> Enforcement: `apps/backend/src/services/core/TestPolicyEngine.js`;
> tests: `attemptLifecycle` / `testPolicyEngine` / `mockTestEngineSimulation`.
> Regen check: `grep -n ATTEMPT_STATES apps/backend/src/constants/lifecycle.constants.js`.

---

## 1. The Core Lifecycle Principle

```text
Discovery ➔ Visibility ➔ Access ➔ Eligibility ➔ Start/Resume ➔ In_Progress ➔ Save/Timer ➔ Pre-Submit Review ➔ Submit/Auto-Submit ➔ Result ➔ Post-Submit Review ➔ History ➔ Reattempt
```

> [!IMPORTANT]
> **Separation of 4 Independent Layers**:
>
> 1. **Test Visibility**: Can the user see that this test exists in the catalog/series?
> 2. **Test Details Access**: Can the user read instructions and test syllabus?
> 3. **Attempt Permission**: Can the user start a new attempt or resume an existing one?
> 4. **Result / Review Permission**: Can the user inspect completed scores, explanations, and answer keys?

---

## 2. Canonical Enums

### 2.1 User Plans (`USER_PLANS`)

| Plan          | Definition                                       | Attempt Quota                              |
| :------------ | :----------------------------------------------- | :----------------------------------------- |
| `GUEST`       | Unauthenticated visitor                          | 0                                          |
| `FREE`        | Registered user without active paid subscription | 3 completed attempts per standard test     |
| `TEST_SERIES` | User with active Test Series Pass                | Unlimited attempts on enrolled series      |
| `PRO_MONTHLY` | Active Monthly Pro subscriber                    | Unlimited attempts & reattempts everywhere |
| `PRO_YEARLY`  | Active Yearly Pro subscriber                     | Unlimited attempts & reattempts everywhere |
| `ADMIN`       | Administrator (`role === 'admin'`)               | Unlimited access + preview bypass          |
| `SUSPENDED`   | Restricted/banned account                        | 0 (All actions blocked)                    |

### 2.2 Test States (`TEST_STATES`)

> **Wire format: lowercase values** (`lifecycle.constants.js:16-24`):
> `draft`, `review`, `scheduled`, `published`, `live`, `expired`, `archived`.
> The UPPERCASE keys below are enum keys; always send/compare the lowercase value on the wire.

| State (key → wire)        | Public Visibility        | Startable by User              | Admin Preview |
| :------------------------ | :----------------------- | :----------------------------- | :------------ |
| `DRAFT` → `draft`         | ❌ Hidden                | ❌ No                          | ✅ Yes        |
| `REVIEW` → `review`       | ❌ Hidden                | ❌ No                          | ✅ Yes        |
| `SCHEDULED` → `scheduled` | ✅ Teaser with Countdown | ❌ No (until start time)       | ✅ Yes        |
| `PUBLISHED` → `published` | ✅ Visible               | ✅ Yes (per entitlement)       | ✅ Yes        |
| `LIVE` → `live`           | ✅ Live Contest Badge    | ✅ Yes (during contest window) | ✅ Yes        |
| `EXPIRED` → `expired`     | ✅ Past Test Archive     | ❌ No new attempts             | ✅ Yes        |
| `ARCHIVED` → `archived`   | ❌ Hidden                | ❌ No                          | ✅ Yes        |

### 2.3 Attempt States (`ATTEMPT_STATES`) — 10 states

> `lifecycle.constants.js:26-37`. Wire values are lowercase/`snake_case`.
> **`ABANDONED` (`"abandoned"`, `:36`) is the 10th state**: terminal marker for an
> attempt the user walked away from (client heartbeat lost / explicit abandon),
> distinct from `CANCELLED` (user-initiated cancel) and `EXPIRED` (timer ran out).

```text
CREATED ➔ IN_PROGRESS ⇄ PAUSED ➔ SUBMITTING ➔ COMPLETED
                                              ├── AUTO_SUBMITTED
                                              ├── EXPIRED
                                              ├── REVOKED
                                              ├── CANCELLED
                                              └── ABANDONED
```

Terminal states (no outgoing transitions, `:101-106`):
`COMPLETED`, `AUTO_SUBMITTED`, `EXPIRED`, `REVOKED`, `CANCELLED`, **`ABANDONED`**.

Allowed entries (`ATTEMPT_STATE_TRANSITIONS`, `:73-107`):

- `CREATED → { IN_PROGRESS, CANCELLED }`
- `IN_PROGRESS → { PAUSED, SUBMITTING, COMPLETED, AUTO_SUBMITTED, EXPIRED, REVOKED, ABANDONED }`
- `PAUSED → { IN_PROGRESS, SUBMITTING, COMPLETED, AUTO_SUBMITTED, EXPIRED, REVOKED, ABANDONED }`
- `SUBMITTING → { COMPLETED, AUTO_SUBMITTED, IN_PROGRESS }` (last = submit-retry fallback)
- Validate with `isValidAttemptTransition(from, to)` (`:115-119`).

### 2.4 Reattempt Types (`REATTEMPT_TYPES`)

| Type          | Target Question Selection                                   | Allowed Plans                                           |
| :------------ | :---------------------------------------------------------- | :------------------------------------------------------ |
| `FULL`        | 100% of test questions                                      | `FREE` (if attempts < 3), `TEST_SERIES`, `PRO`, `ADMIN` |
| `WRONG`       | Questions where user answered incorrectly                   | `TEST_SERIES`, `PRO`, `ADMIN`                           |
| `UNATTEMPTED` | Questions skipped without an answer                         | `TEST_SERIES`, `PRO`, `ADMIN`                           |
| `SLOW`        | Questions taking > 1.5x benchmark time                      | `TEST_SERIES`, `PRO`, `ADMIN`                           |
| `SMART`       | AI/weak-area deduplicated mix of wrong + slow + unattempted | `PRO`, `ADMIN`                                          |

---

## 3. Authoritative Decision Matrix

| Operation                                |      Guest      |        Free        | Test Series Pass |  Pro Monthly  |  Pro Yearly   |    Admin     |
| :--------------------------------------- | :-------------: | :----------------: | :--------------: | :-----------: | :-----------: | :----------: |
| **Discover Published Free Test**         |       ✅        |         ✅         |        ✅        |      ✅       |      ✅       |      ✅      |
| **Discover Published Pro Test**          | Metadata / Lock |     Lock Badge     |  Series Policy   |      ✅       |      ✅       |      ✅      |
| **Discover Scheduled Test**              |    Countdown    |     Countdown      |    Countdown     |   Countdown   |   Countdown   |      ✅      |
| **Start Draft / Review**                 |       ❌        |         ❌         |        ❌        |      ❌       |      ❌       | Preview Mode |
| **Start Scheduled (Before Start)**       |       ❌        |         ❌         |        ❌        |      ❌       |      ❌       | Preview Mode |
| **Start Published Free**                 |  ❌ (Auth Req)  | ✅ (Quota $\le 3$) |   ✅ Unlimited   | ✅ Unlimited  | ✅ Unlimited  |      ✅      |
| **Start Pro Test**                       |  ❌ (Auth Req)  |    ❌ (Pro Req)    |  Series Policy   |      ✅       |      ✅       |      ✅      |
| **Resume Active In-Progress Attempt**    |       ❌        |   ✅ Own Active    |  ✅ Own Active   | ✅ Own Active | ✅ Own Active |      ✅      |
| **Pre-Submit Question Review**           |       ❌        |   ✅ All 100 Qs    |  ✅ All 100 Qs   | ✅ All 100 Qs | ✅ All 100 Qs |      ✅      |
| **Submit / Auto-Submit**                 |       ❌        |   ✅ Own Active    |  ✅ Own Active   | ✅ Own Active | ✅ Own Active |      ✅      |
| **View Latest Result**                   |       ❌        |       ✅ Own       |      ✅ Own      |    ✅ Own     |    ✅ Own     |   Any User   |
| **View Specific Result (`:attemptId`)**  |       ❌        |       ✅ Own       |      ✅ Own      |    ✅ Own     |    ✅ Own     |   Any User   |
| **Historical Snapshot Review**           |       ❌        |       ✅ Own       |      ✅ Own      |    ✅ Own     |    ✅ Own     |   Any User   |
| **Full Reattempt**                       |       ❌        |   If Quota $< 3$   |        ✅        |      ✅       |      ✅       |      ✅      |
| **Wrong Questions Reattempt**            |       ❌        |    ❌ (Pro Req)    |        ✅        |      ✅       |      ✅       |      ✅      |
| **Unattempted Reattempt**                |       ❌        |    ❌ (Pro Req)    |        ✅        |      ✅       |      ✅       |      ✅      |
| **Slow Questions Reattempt**             |       ❌        |    ❌ (Pro Req)    |        ✅        |      ✅       |      ✅       |      ✅      |
| **Smart Improvement Reattempt**          |       ❌        |    ❌ (Pro Req)    |   ❌ (Pro Req)   |      ✅       |      ✅       |      ✅      |
| **Live Test Solutions (Contest Active)** |    ❌ Locked    |     ❌ Locked      |    ❌ Locked     |   ❌ Locked   |   ❌ Locked   |  ✅ Preview  |
| **Live Test Solutions (Contest Ended)**  |  ❌ (Auth Req)  |   ✅ Own Result    |  ✅ Own Result   | ✅ Own Result | ✅ Own Result |   Any User   |

---

## 4. Key Architectural Guarantees

### 4.1 Single Active Attempt Guarantee (`active_attempt_rule`)

- One user + one test = maximum **1 active attempt** in `in_progress` / `paused` / `submitting` state.
- Triggering `/start` while an active attempt exists must **resume** the attempt and never create a duplicate row.

### 4.2 Immutable Question Snapshots

- Submitting an attempt records a complete snapshot in `attempt_question_snapshots` (question text, options array, correct answer, explanation, positive marks, negative marks, section).
- Historical reviews always query snapshots so future admin question modifications never mutate past attempt scores or solutions.

### 4.3 Idempotent Submission

- Repeated or retried submit requests on completed attempts return HTTP 200 with `{ status: 'already_submitted', attemptId }` without error toasts or duplicate database records.

### 4.4 Live Contest Security

- When a live contest is active (`now < scheduledEnd`), correct answers, explanations, and peer scorecards are strictly redacted from API responses (`code: 'RESULT_LOCKED'`).

### 4.5 Enforcement pointers (code)

- Enums + transitions: `apps/backend/src/constants/lifecycle.constants.js:6-107`
  (`USER_PLANS`, `TEST_STATES`, `ATTEMPT_STATES` incl. `ABANDONED:36`,
  `REATTEMPT_TYPES`, `POLICY_ERROR_CODES`, `ATTEMPT_STATE_TRANSITIONS`,
  `isValidAttemptTransition`).
- Policy engine: `apps/backend/src/services/core/TestPolicyEngine.js`
  (entitlement checks → `POLICY_ERROR_CODES`).
- Tests: `attemptLifecycle`, `testPolicyEngine`, `mockTestEngineSimulation`
  (under `apps/backend/src/__tests__/` — run before changing any rule above).

---

## 5. Standard Error Codes

```text
AUTH_REQUIRED
ACCOUNT_RESTRICTED

TEST_NOT_FOUND
TEST_NOT_AVAILABLE
TEST_NOT_PUBLISHED
TEST_UNAVAILABLE
LIVE_TEST_NOT_STARTED
LIVE_TEST_ENDED
LIVE_TEST_EXPIRED

PRO_REQUIRED
PASS_REQUIRED
ATTEMPT_LIMIT_REACHED

ATTEMPT_NOT_FOUND
ATTEMPT_NOT_OWNED
ATTEMPT_ALREADY_COMPLETED
NO_ACTIVE_ATTEMPT
NO_QUESTIONS_FOR_REATTEMPT

RESULT_LOCKED
REVIEW_LOCKED
```

---

## 6. Changelog

- **2026-09-06:** Added `ABANDONED` as 10th attempt state (terminal; reachable from
  `IN_PROGRESS`/`PAUSED`); documented lowercase `TEST_STATES` wire values; added
  §4.5 enforcement pointers. Code: `lifecycle.constants.js:36,85,94,106`.
- Prior contract (plans, matrix, guarantees §§1–5) unchanged.
