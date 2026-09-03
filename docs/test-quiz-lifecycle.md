# Trstprep V2.1 — Test & Quiz Lifecycle Specification

This document is the **single source of truth** for all business rules, entitlement contracts, state machines, timing constraints, and access permissions across the frontend and backend.

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

| State       | Public Visibility        | Startable by User              | Admin Preview |
| :---------- | :----------------------- | :----------------------------- | :------------ |
| `DRAFT`     | ❌ Hidden                | ❌ No                          | ✅ Yes        |
| `REVIEW`    | ❌ Hidden                | ❌ No                          | ✅ Yes        |
| `SCHEDULED` | ✅ Teaser with Countdown | ❌ No (until start time)       | ✅ Yes        |
| `PUBLISHED` | ✅ Visible               | ✅ Yes (per entitlement)       | ✅ Yes        |
| `LIVE`      | ✅ Live Contest Badge    | ✅ Yes (during contest window) | ✅ Yes        |
| `EXPIRED`   | ✅ Past Test Archive     | ❌ No new attempts             | ✅ Yes        |
| `ARCHIVED`  | ❌ Hidden                | ❌ No                          | ✅ Yes        |

### 2.3 Attempt States (`ATTEMPT_STATES`)

```text
CREATED ➔ IN_PROGRESS ⇄ PAUSED ➔ SUBMITTING ➔ COMPLETED
                                              ├── AUTO_SUBMITTED
                                              ├── EXPIRED
                                              ├── REVOKED
                                              └── CANCELLED
```

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
