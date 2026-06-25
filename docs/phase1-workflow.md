# Phase 1 Workflow Map

```mermaid
flowchart TB
  subgraph Question_Lifecycle["Question Lifecycle"]
    QC[Create Question] --> QV1[Version 1 Created]
    QE[Edit Question] --> QVN[N+1 Created]
    QV1 --> QV_Set{Current?}
    QVN --> QV_Set
    QV_Set -->|Yes| QV_IsCurrent[is_current=true]
    QV_Set -->|No| QV_Depr[is_current=false]
    QS[Submit for Review] --> QR_Pend[moderation_status=pending_review]
    QR_Pend -->|Approve| QR_App[moderation_status=approved]
    QR_Pend -->|Request Changes| QR_Chg[moderation_status=changes_requested]
    QR_Pend -->|Reject| QR_Rej[moderation_status=rejected]
    QR_Chg -->|Re-submit| QR_Pend
  end

  subgraph Test_State_Machine["Test State Machine"]
    TS_D[draft] -->|Submit for Review| TS_R[review]
    TS_R -->|Send Back| TS_D
    TS_R -->|Schedule| TS_Sch[scheduled]
    TS_R -->|Publish Direct| TS_P[published]
    TS_Sch -->|Scheduled Date Reached| TS_P
    TS_Sch -->|Archive| TS_A[archived]
    TS_P -->|Go Live| TS_L[live]
    TS_P -->|Archive| TS_A
    TS_L -->|End Date| TS_E[expired]
    TS_E -->|Archive| TS_A
    TS_A -->|Restore| TS_D
  end

  subgraph Moderation_Pipeline["Content Moderation Pipeline"]
    MP_Creator[Creator] -->|Submit| MP_PR[pending_review]
    MP_PR -->|Assign| MP_Reviewer[Reviewer]
    MP_Reviewer -->|Approve| MP_App[approved]
    MP_Reviewer -->|Request Changes| MP_Chg[changes_requested]
    MP_Reviewer -->|Reject| MP_Rej[rejected]
    MP_Chg -->|Re-submit| MP_PR
    MP_Rej -->|Re-submit| MP_PR
  end

  subgraph Attempt_Lifecycle["Attempt Lifecycle"]
    AL_Start[POST /:testId/start] -->|Create Attempt| AL_Att[Attempt: in_progress]
    AL_Att -->|Snapshot Questions| AL_Snap[attempt_question_snapshots]
    AL_Snap -->|Record Versions| AL_VMap[question_version_id mapped]
    AL_Att -->|Autosave| AL_Auto[PUT /:testId/autosave]
    AL_Att -->|Submit| AL_Sub[PUT /:testId/submit]
    AL_Sub -->|Per-Question Scoring| AL_Score[Score from snapshots.marks]
    AL_Sub -->|Store Answers| AL_Done[Attempt: completed]
    AL_Done -->|Read Result| AL_Res[GET /:testId/result/:attemptId]
  end

  subgraph Rate_Limiting["Per-Module Rate Limiting"]
    RL_Auth[auth] -->|5/min| RL_Strict[strict]
    RL_Pay[payments/phone] -->|5/min| RL_Strict
    RL_User[users/bookmarks/notifications] -->|30/min| RL_Mod[moderate]
    RL_Doubt[doubts/study-groups] -->|30/min| RL_Mod
    RL_Attempt[attempt/practice] -->|30/min| RL_Mod
    RL_Quest[questions/test-categories] -->|60/min| RL_Rel[relaxed]
    RL_Admin[admin/subscriptions] -->|60/min| RL_Rel
    RL_Gen[tests/exams/study/blogs] -->|1000/15min| RL_GenT[generous]
  end

  subgraph Scheduler["Background Scheduler (60s interval)"]
    SCH_Check[Check scheduled tests] -->|scheduledAt reached| SCH_Live[→ live]
    SCH_Check2[Check live tests] -->|expiredAt reached| SCH_Exp[→ expired]
  end

  Question_Lifecycle -->|Questions Linked To| Test_State_Machine
  Moderation_Pipeline -->|Gate to| Test_State_Machine
  Attempt_Lifecycle -->|Reads Versions| Question_Lifecycle
  Attempt_Lifecycle -->|Reads Snapshots| Question_Lifecycle
  Rate_Limiting -->|Protects Routes| Attempt_Lifecycle
  Rate_Limiting -->|Protects Routes| Test_State_Machine
  Scheduler -->|Auto-Transitions| Test_State_Machine
```

## Data Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Routes
    participant SM as State Machine
    participant M as Moderation
    participant Q as Questions
    participant V as Question Versions
    participant S as Snapshots
    participant DB as Database
    participant SCH as Scheduler

    C->>R: POST /test/:id/start
    R->>Q: Load test questions
    Q->>V: ensureVersion() per question
    V->>DB: question_versions
    R->>S: Insert snapshots per question
    S->>DB: attempt_question_snapshots
    R->>DB: Insert attempt (in_progress)

    C->>R: PUT /test/:id/autosave
    R->>DB: Update attempt.answers

    C->>R: PUT /test/:id/submit
    R->>S: Load snapshots for attempt
    S->>DB: SELECT attempt_question_snapshots
    R->>R: Score using snapshot marks
    R->>DB: Update attempt (completed)

    C->>R: GET /test/:id/result/:attemptId
    R->>S: Load snapshots
    R->>DB: Load attempt
    R->>C: Return result payload

    Note over SCH: Every 60s
    SCH->>DB: Find scheduled tests
    SCH->>DB: Update status → live
    SCH->>DB: Find live tests
    SCH->>DB: Update status → expired

    Note over C,R: Admin flows
    C->>R: POST /question/:id/submit-for-review
    R->>M: moderation_status = pending_review
    C->>R: PUT /question/:id/review
    R->>M: moderation_status = approved/rejected/changes_requested

    C->>R: PUT /test/:id/state
    R->>SM: validateTransition()
    SM->>R: Allowed?
    R->>DB: Update test status
```

## Table Relationships

```mermaid
erDiagram
    questions ||--o{ question_versions : "has versions"
    questions ||--o{ attempt_question_snapshots : "snapshotted by"
    questions ||--o{ question_attempts : "attempted in"
    questions {
        int id PK
        text question_text
        float marks
        float negative_marks
        string moderation_status
    }
    question_versions {
        int id PK
        int question_id FK
        int version_number
        float marks
        float negative_marks
        boolean is_current
        string snapshot_type
    }
    attempts ||--o{ question_attempts : "has"
    attempts ||--o{ attempt_question_snapshots : "snapshotted at"
    attempts {
        int id PK
        int user_id FK
        int test_id FK
        string status
        float score
        jsonb answers
    }
    tests {
        int id PK
        string status
        string moderation_status
        timestamp scheduled_at
        timestamp live_at
        timestamp expired_at
    }
    attempt_question_snapshots {
        int id PK
        int attempt_id FK
        int question_id FK
        int question_version_id FK
        float marks
        float negative_marks
        jsonb options
        int correct_answer
    }
    question_attempts {
        int id PK
        int attempt_id FK
        int question_id FK
        int question_version_id FK
        int selected_option
        boolean is_marked_for_review
    }
```

## Migration Order

```
019 → 020 → 021 → 022 → 023
│      │      │      │      │
│      │      │      │      └─ Content moderation columns
│      │      │      └──────── Test state machine columns + indexes
│      │      └─────────────── Attempt question snapshots table
│      └────────────────────── Question versioning enhancements
└──────────────────────────── Base schema fixes
```
