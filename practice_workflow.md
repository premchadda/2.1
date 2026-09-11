# Practice Lab — Full Workflow & Architecture

## Screen State Machine

The entire Practice Lab is a single-page state machine driven by `screen` state in [`PracticeLab.jsx`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/frontend/src/pages/tests/PracticeLab.jsx).

```mermaid
stateDiagram-v2
    [*] --> dashboard

    dashboard --> exam_practice: Click "Exam & Concepts" card
    dashboard --> fundamentals: Click "Fundamentals" card
    dashboard --> setup: Click "Smart Practice" or "Start Concept Practice"
    dashboard --> session: Click "Resume Practice" banner
    dashboard --> session: Click "Re-Practice Mistakes" card
    dashboard --> session: URL ?mode=mistakes deep link

    exam_practice --> dashboard: ← Back to Workspace
    exam_practice --> chapter_detail: Click a chapter card
    exam_practice --> exam_practice: Change exam (modal)

    chapter_detail --> exam_practice: ← Back
    chapter_detail --> session: Click practice set card

    setup --> dashboard: ← Back
    setup --> session: Click "Start Concept Practice"

    fundamentals --> dashboard: ← Back

    session --> dashboard: Exit (or return to origin screen)
    session --> complete: Session finished

    complete --> setup: "Start New Practice"
    complete --> dashboard: "Return to Workspace Hub"
```

---

## 7 Screens at a Glance

| #   | Screen ID        | Component                | Purpose                                                                                                           |
| --- | ---------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1   | `dashboard`      | `PracticeHubDashboard`   | 4-card hub: Fundamentals, Exam Practice, Smart AI, Mistake Notebook + streak + resume banner + recommended topics |
| 2   | `exam_practice`  | `ExamPracticeHub`        | Two-column: subjects sidebar ↔ chapters grid + Upgrade Pass banner (conditional)                                  |
| 3   | `chapter_detail` | `ChapterDetailView`      | Two-column: topics sidebar ↔ practice set cards (Quick/Easy/Medium/Hard/Full)                                     |
| 4   | `setup`          | `PracticeSetupWizard`    | Manual config: Subject → Chapter → Topic → Difficulty → Question count → Start                                    |
| 5   | `fundamentals`   | `FundamentalsGym`        | Calculation drills: Tables, Squares, Cubes, Roots, Fractions, Ratios, Triplets                                    |
| 6   | `session`        | `PracticeWorkspace`      | Active question-by-question practice with answer checking, explanations, AI tutor                                 |
| 7   | `complete`       | `PracticeCompleteScreen` | Summary: Accuracy, Avg Speed, Concept Mastery + "Start New" / "Return"                                            |

---

## Component Tree

```mermaid
graph TD
    PL["PracticeLab (Router)"]
    PL --> PHD["PracticeHubDashboard"]
    PL --> EPH["ExamPracticeHub"]
    PL --> CDV["ChapterDetailView"]
    PL --> PSW["PracticeSetupWizard"]
    PL --> FG["FundamentalsGym"]
    PL --> PW["PracticeWorkspace"]
    PL --> PCS["PracticeCompleteScreen"]
    PL --> CEM["ChooseExamModal"]

    PHD -->|"streak, dashboard, mistakes, tree"| API["practiceAPI"]
    EPH -->|"tree"| API
    CDV -->|"chapterTopics"| API
    PSW -->|"tree"| API
    FG -->|"fundamentals/*"| API
    PW -->|"sessions/*, questions/*, bookmarks, vault, ai"| API

    PW --> KVM["KnowledgeVaultModal"]
    PW --> MR["MathRenderer"]

    API --> AC["apiClient (Axios)"]
    AC -->|"HTTP"| BE["Backend /api/practice/*"]

    style PL fill:#4f46e5,color:#fff
    style API fill:#7c3aed,color:#fff
    style BE fill:#059669,color:#fff
```

---

## API Data Flow (Frontend → Backend)

```mermaid
sequenceDiagram
    participant User
    participant Dashboard as PracticeHubDashboard
    participant ExamHub as ExamPracticeHub
    participant Chapter as ChapterDetailView
    participant Workspace as PracticeWorkspace
    participant API as practiceAPI.js
    participant Backend as Express /api/practice

    Note over Dashboard: Screen: dashboard
    Dashboard->>API: getDashboard()
    API->>Backend: GET /dashboard
    Backend-->>API: streak, activeSession, weakTopics, mistakesCount
    Dashboard->>API: getMistakesCount()
    API->>Backend: GET /mistakes/count
    Dashboard->>API: getTree()
    API->>Backend: GET /tree
    Backend-->>API: subjects → chapters → topics (with question counts)

    Note over ExamHub: Screen: exam_practice
    ExamHub->>API: getTree()
    API->>Backend: GET /tree

    Note over Chapter: Screen: chapter_detail
    Chapter->>API: getChapterTopics(chapterId)
    API->>Backend: GET /chapters/:chapterId/topics
    Backend-->>API: topics[] with practiceSets[], easyCount, mediumCount, hardCount

    Note over User: Clicks a practice set card
    User->>Chapter: handleStartSet(practiceSet)

    Note over Workspace: Screen: session
    Chapter->>API: startSession({mode, topicId, difficulty, count})
    API->>Backend: POST /sessions
    Backend-->>API: {sessionId, questions[], total}

    loop For each question
        Workspace->>API: getQuestion(sessionId, idx)
        API->>Backend: GET /sessions/:id/questions/:idx
        User->>Workspace: Select option
        Workspace->>API: checkAnswer(sessionId, idx, {answer})
        API->>Backend: POST /sessions/:id/questions/:idx/check
        Backend-->>API: {isCorrect, correctAnswer, explanation}
    end

    Workspace->>API: completeSession(sessionId, summary)
    API->>Backend: POST /sessions/:id/complete
```

---

## Full Backend API Surface (38 endpoints)

### Core Navigation

| Method | Endpoint                      | Used By                         |
| ------ | ----------------------------- | ------------------------------- |
| `GET`  | `/tree`                       | Dashboard, ExamHub, SetupWizard |
| `GET`  | `/subjects`                   | SetupWizard                     |
| `GET`  | `/chapters/:chapterId/topics` | ChapterDetailView               |
| `GET`  | `/topics/:topicId/stats`      | (unused in current UI)          |
| `GET`  | `/dashboard`                  | Dashboard                       |

### Sessions

| Method  | Endpoint                 | Used By                               |
| ------- | ------------------------ | ------------------------------------- |
| `POST`  | `/sessions`              | Start any practice (all entry points) |
| `GET`   | `/sessions/active`       | Dashboard resume banner               |
| `GET`   | `/sessions/:id`          | Resume from dashboard                 |
| `PATCH` | `/sessions/:id`          | Update progress                       |
| `POST`  | `/sessions/:id/complete` | End session → complete screen         |

### Questions (during session)

| Method | Endpoint                                | Used By              |
| ------ | --------------------------------------- | -------------------- |
| `GET`  | `/sessions/:id/questions/:idx`          | PracticeWorkspace    |
| `POST` | `/sessions/:id/questions/:idx/check`    | Answer checking      |
| `POST` | `/sessions/:id/questions/:idx/skip`     | Skip question        |
| `GET`  | `/questions/:id/explanations`           | Learning panel       |
| `GET`  | `/questions/:id/approaches`             | Community approaches |
| `POST` | `/questions/:id/approaches`             | Submit approach      |
| `POST` | `/questions/:id/approaches/:aid/upvote` | Upvote               |
| `GET`  | `/questions/:id/similar`                | Similar questions    |

### Bookmarks & Mistakes

| Method   | Endpoint                 | Used By                 |
| -------- | ------------------------ | ----------------------- |
| `GET`    | `/bookmarks`             | Bookmarks page          |
| `GET`    | `/bookmarks/count`       | (future)                |
| `POST`   | `/bookmarks/:questionId` | Bookmark during session |
| `DELETE` | `/bookmarks/:questionId` | Unbookmark              |
| `GET`    | `/mistakes`              | Mistake notebook        |
| `GET`    | `/mistakes/count`        | Dashboard mistake card  |

### Fundamentals Gym

| Method | Endpoint                   | Used By              |
| ------ | -------------------------- | -------------------- |
| `GET`  | `/fundamentals/categories` | FundamentalsGym      |
| `GET`  | `/fundamentals/drill`      | Start drill          |
| `POST` | `/fundamentals/submit`     | Submit drill results |

### AI & Vault

| Method | Endpoint                | Used By                 |
| ------ | ----------------------- | ----------------------- |
| `POST` | `/ai/tutor`             | AI tutor in Workspace   |
| `POST` | `/vault/save`           | Save to knowledge vault |
| `GET`  | `/vault/items`          | View vault              |
| `POST` | `/questions/:id/report` | Report question         |

### Admin

| Method | Endpoint                    |
| ------ | --------------------------- |
| `GET`  | `/reports/my`               |
| `GET`  | `/reports/admin/all`        |
| `PUT`  | `/reports/admin/:id/status` |
| `GET`  | `/bookmarks/admin/all`      |
| `GET`  | `/questions`                |
| `GET`  | `/questions/:id`            |
| `POST` | `/adaptive-diagnostic`      |

---

## Practice Set Generation (The Bottleneck You Asked About)

```mermaid
flowchart LR
    subgraph Backend["Backend: practice.js L662–738"]
        PS["PRACTICE_SETS constant<br/>Quick(10), Easy(15),<br/>Medium(15), Hard(10),<br/>Full(ALL)"]
        MAP["Map each set → topic<br/>count = min(set.count, available)<br/>Full → available"]
        FILTER["Filter: count > 0"]
        PS --> MAP --> FILTER
    end

    subgraph Frontend["Frontend: PracticeLab.jsx L719–744"]
        GAS["getAvailableSets(topic)"]
        STYLES["Apply practiceSetStyles<br/>indigo/emerald/amber/red/purple"]
        CARDS["Render practice set cards"]
        GAS --> STYLES --> CARDS
    end

    subgraph Session["Session Creation"]
        START["handleStartSet(ps)<br/>→ onStartSession(config)"]
        API["POST /api/practice/sessions<br/>count capped at 200"]
        START --> API
    end

    FILTER --> GAS
    CARDS -->|"Click"| START
```

---

## 5 User Entry Points into Practice

```mermaid
flowchart TD
    A["🧮 Fundamentals Card"] -->|"onOpenFundamentals"| F["FundamentalsGym<br/>(self-contained drills)"]
    B["📚 Exam & Concepts Card"] -->|"onOpenExamPractice"| E["ExamPracticeHub<br/>→ ChapterDetailView<br/>→ Practice Sets"]
    C["🎯 Smart Practice Card"] -->|"onLaunchSmart('weak_topic')"| S["Direct session start<br/>mode=learn, count=15"]
    D["📓 Mistake Notebook Card"] -->|"onLaunchSmart('mistakes')"| M["Direct session start<br/>mode=mistakes, count=15"]
    URL["URL: ?mode=mistakes&testId=X"] -->|"useEffect deep link"| DL["Direct session start<br/>mode=mistakes, count=25"]

    E --> SS["Practice Session"]
    S --> SS
    M --> SS
    DL --> SS
    SS --> CS["Complete Screen<br/>Accuracy · Speed · Mastery"]

    style A fill:#4f46e5,color:#fff
    style B fill:#6366f1,color:#fff
    style C fill:#f59e0b,color:#fff
    style D fill:#f97316,color:#fff
    style URL fill:#64748b,color:#fff
```

---

## Database Tables Involved

| Table                            | Purpose                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `questions`                      | Master question bank (filtered by `PRACTICE_Q_WHERE`)                                            |
| `practice_sessions`              | Session state: user_id, mode, difficulty, target_count, questions_json, current_index, is_active |
| `practice_answers`               | Per-question answer records (correct/wrong/skipped)                                              |
| `practice_bookmarks`             | Bookmarked questions                                                                             |
| `practice_ai_cache`              | AI explanation/approach cache                                                                    |
| `question_reports`               | Reported questions                                                                               |
| `practice_fundamentals_results`  | Drill results                                                                                    |
| `knowledge_vault_items`          | Saved concepts                                                                                   |
| `subjects`, `chapters`, `topics` | Curriculum taxonomy tree                                                                         |

---

## Key Files

| Layer          | File                                                                                                                               | Lines | Purpose                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------- |
| **Page**       | [`PracticeLab.jsx`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/frontend/src/pages/tests/PracticeLab.jsx)                        | 1704  | 7-screen state machine, 5 inline components |
| **Component**  | [`PracticeWorkspace.jsx`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/frontend/src/pages/tests/components/PracticeWorkspace.jsx) | 814   | Active session Q&A + learning panel         |
| **Component**  | [`FundamentalsGym.jsx`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/frontend/src/pages/tests/components/FundamentalsGym.jsx)     | 1799  | Calculation drills                          |
| **API Client** | [`practiceAPI.js`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/frontend/src/shared/lib/practiceAPI.js)                           | 159   | 25 API methods                              |
| **Backend**    | [`practice.js`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/backend/src/api/routes/practice.js)                                  | 2584  | 38 endpoints                                |
| **Hook**       | [`useProPass.js`](file:///e:/Tech/Testprep/Trstprep%20V2.1/apps/frontend/src/shared/hooks/useProPass.js)                           | 202   | Pro pass gating                             |

---

## Enhancement Opportunities

> [!TIP]
> These are areas identified from the workflow analysis for potential improvement.

| Area                                    | Current State                                           | Enhancement Idea                                                                             |
| --------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **PracticeLab.jsx is 1704 lines**       | 5 components inline + main router                       | Extract `ExamPracticeHub`, `ChapterDetailView`, `PracticeCompleteScreen` into separate files |
| **Practice sets are static**            | 5 hardcoded sets: Quick/Easy/Medium/Hard/Full           | Dynamic sets based on topic size (e.g. "Marathon 100", "Sprint 5")                           |
| **No pagination for Full Practice**     | Session capped at 200 questions server-side             | Add "Continue" to spawn sequential sessions for large topics                                 |
| **Setup Wizard redundant?**             | Separate screen duplicates ChapterDetailView's function | Merge into ChapterDetailView or remove                                                       |
| **FundamentalsGym is 1799 lines**       | Monolithic component                                    | Extract drill types into sub-components                                                      |
| **No progress persistence mid-session** | `currentIndex` tracked but no periodic sync             | Auto-save progress every N questions                                                         |
| **Weak topic recommendations**          | Only 4 shown on dashboard                               | Expand into a dedicated "AI Study Plan" section                                              |
| **No practice history**                 | No "past sessions" view                                 | Add session history with re-attempt capability                                               |
| **Upgrade banner**                      | Now conditional ✅                                      | Add pricing/plan link + trial CTA                                                            |
| **Deep link only for mistakes**         | `?mode=mistakes&testId=X`                               | Support `?mode=topic&topicId=X` for sharing                                                  |
