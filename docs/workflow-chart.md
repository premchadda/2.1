# Trstprep Platform — Workflow Chart Map

## 1. System Architecture

```mermaid
flowchart TB
    subgraph Users["👤 Users"]
        V[Visitor / Learner]
        P[Pro / Paid User]
        A[Admin]
    end

    subgraph Frontend["Frontend Layer"]
        FA["apps/frontend (React 18, Vite, port 3000)"]
        AD["apps/admin-panel (React 18, Vite, port 3002)"]
    end

    subgraph Backend["Backend API Layer"]
        EX["Express Server (port 5001)"]
        WS["WebSocket (Socket.IO)"]
        WK["BullMQ Worker"]
    end

    subgraph Data["Data & Infrastructure"]
        PG[("PostgreSQL / Supabase")]
        RD[("Redis — Cache + Queue")]
        FS[("File Storage<br/>Local / S3 / Supabase")]
        EM[("Email — SendGrid / SES / Nodemailer")]
        SMS[("SMS — Twilio")]
        PYM[("Payments — Razorpay")]
    end

    V --> FA
    P --> FA
    A --> AD
    FA --> EX
    AD --> EX
    FA <--> WS
    AD <--> WS
    EX --> PG
    EX --> RD
    EX --> FS
    EX --> EM
    EX --> SMS
    EX --> PYM
    WK --> RD
    WK --> PG
```

---

## 2. Authentication & Session Flow

```mermaid
sequenceDiagram
    actor U as User
    participant F as Frontend
    participant B as Backend API
    participant DB as PostgreSQL
    participant R as Redis

    alt Email / Password
        U->>F: Enter email + password
        F->>B: POST /api/auth/login
        B->>DB: Verify credentials (bcrypt compare)
        alt Valid
            DB-->>B: User record
            B->>B: Generate JWT (access + refresh)
            B->>R: Store refresh token / session
            B-->>F: Set cookie + return tokens
            F-->>U: Redirect to Dashboard
        else Invalid
            B-->>F: 401 Error
            F-->>U: Show error message
        end
    else Google OAuth
        U->>F: Click "Sign in with Google"
        F->>F: Google OAuth popup
        F->>B: POST /api/auth/google (id_token)
        B->>B: Verify Google token
        B->>DB: Find or create user
        B-->>F: JWT tokens set
        F-->>U: Redirect
    else Phone OTP
        U->>F: Enter phone number
        F->>B: POST /api/auth/phone/send-otp
        B->>R: Store OTP (5-min TTL)
        B-->>SMS: Send OTP via Twilio
        U->>F: Enter OTP
        F->>B: POST /api/auth/phone/verify-otp
        B->>R: Verify OTP
        B-->>F: JWT tokens
        F-->>U: Authenticated
    end
```

---

## 3. Learner User Journey

```mermaid
flowchart LR
    %% Top-level flow segments
    A("{/}<br/>Home") --> B("Browse Exams<br/>/exams, /test-series, /study")
    B --> C{"Register / Login?"}
    C -->|No| D["Public Access Only<br/>View content, take<br/>free tests"]
    C -->|Yes| E["Email/Google/Phone<br/>Authentication"]
    E --> F["Learner Dashboard<br/>/dashboard"]

    F --> G{"Choose Activity"}
    G --> H["📝 Test Series<br/>/test-series"]
    G --> I["📚 Study Material<br/>/study"]
    G --> J["🎥 Video Lectures<br/>/videos"]
    G --> K["📰 Current Affairs<br/>/current-affairs"]
    G --> L["📊 Practice / Quizzes<br/>/practice"]
    G --> M["🏆 Leaderboard<br/>/leaderboard"]

    H --> N["Test Details Page<br/>/test-series/:id"]
    N --> O{Is Premium?}
    O -->|Yes| P{Subscribed?}
    O -->|Free| Q["Start Test"]
    P -->|No| R["Subscribe / Purchase"]
    R --> F
    P -->|Yes| Q

    Q --> S["Test Instructions<br/>/test/:id/instructions"]
    S --> T["⚠️ Test Interface<br/>(Fullscreen, Timer,<br/>Section Navigation)"]
    T --> U{"Submit or<br/>Time Up?"}
    U -->|Submit| V["Processing<br/>(Auto-evaluate)"]
    U -->|Pause/Resume| T
    V --> W["📊 Test Results<br/>/test-result/:id"]
    W --> X["🔍 Test Review<br/>/test-review/:id"]
    W --> Y["Analysis Dashboard<br/>/analysis"]
    W --> F
```

---

## 4. Test Attempt Lifecycle (Backend Detail)

```mermaid
stateDiagram-v2
    [*] --> Instructions: User clicks "Start"
    Instructions --> InProgress: User accepts
    InProgress --> Paused: User pauses
    Paused --> InProgress: User resumes
    InProgress --> Submitted: User submits
    InProgress --> TimeUp: Timer expires
    Submitted --> Evaluating: Queue job dispatched
    TimeUp --> Evaluating: Queue job dispatched
    Evaluating --> ResultsComputed: Auto-evaluate answers
    ResultsComputed --> LeaderboardUpdated: Recalculate rankings
    LeaderboardUpdated --> AnalyticsGenerated: Aggregate stats
    AnalyticsGenerated --> NotificationsSent: Push result alert
    NotificationsSent --> [*]

    state InProgress {
        [*] --> Section1
        Section1 --> Section2: Navigate
        Section2 --> SectionN: Navigate
        SectionN --> [*]
    }

    state Evaluating {
        [*] --> ScoreCalculation
        ScoreCalculation --> SectionWiseBreakdown
        SectionWiseBreakdown --> TimeAnalysis
        TimeAnalysis --> [*]
    }
```

---

## 5. Backend Request Processing Pipeline

```mermaid
flowchart LR
    REQ["HTTP Request"] --> H1

    subgraph MW["Middleware Pipeline (in order)"]
        H1["1️⃣ Helmet<br/>(Security Headers)"]
        CORS["2️⃣ CORS<br/>(Origin Allowlist)"]
        RL["3️⃣ Rate Limiter<br/>(3 tiers)"]
        CP["4️⃣ Cookie Parser"]
        MG["5️⃣ Morgan<br/>(Request Logging)"]
        MON["6️⃣ Monitoring<br/>(Timing Metrics)"]
        PID["7️⃣ Public ID<br/>(ID transform)"]
        CC["8️⃣ Cache Control"]
        AUTH["9️⃣ Auth Middleware<br/>(optionalAuth / protect / admin)"]
        CSRF["🔟 CSRF Middleware<br/>(Mutations only)"]
        VAL["1️⃣1️⃣ Validation<br/>(Joi schemas)"]
    end

    subgraph Handler["Route Handler"]
        DIR["Controller Layer"]
        SVC["Service Layer"]
        REPO["dbHelpers / Repository"]
    end

    subgraph Response["Response"]
        RES["JSON Response"]
    end

    REQ --> H1
    H1 --> CORS
    CORS --> RL
    RL --> CP
    CP --> MG
    MG --> MON
    MON --> PID
    PID --> CC
    CC --> AUTH
    AUTH --> CSRF
    CSRF --> VAL
    VAL --> DIR
    DIR --> SVC
    SVC --> REPO
    REPO --> RES
```

---

## 6. Admin Panel Workflow

```mermaid
flowchart TB
    subgraph AdminAuth["Authentication"]
        AL["/admin/login"] --> ADASH
    end

    ADASH["/admin Dashboard"] --> ASEL{"Select Module"}

    ASEL --> ASSESS["📝 Assessments"]
    ASEL --> EXAM["📋 Exams & Categories"]
    ASEL --> STUDY["📚 Study Materials"]
    ASEL --> USERS["👥 Users"]
    ASEL --> ANALYTICS["📊 Analytics"]
    ASEL --> NOTIF["🔔 Notifications"]
    ASEL --> SUB["💳 Subscriptions"]
    ASEL --> SYS["⚙️ System Settings"]

    ASSESS --> QMAN["Manage Questions<br/>CRUD, Bulk Import"]
    ASSESS --> TMAN["Manage Tests<br/>Create, Configure"]
    ASSESS --> SSEC["Manage Sections<br/>Timing, Questions"]
    ASSESS --> SERIES["Test Series Admin"]

    EXAM --> CAT["Exam Categories"]
    EXAM --> INFO["Exam Info / Seasons"]
    EXAM --> STG["Stages"]

    STUDY --> SUBJ["Subjects"]
    STUDY --> TOP["Topics / Chapters"]
    STUDY --> VID["Videos"]
    STUDY --> CA["Current Affairs"]

    USERS --> ULIST["User List"]
    USERS --> ENRL["Enrollments"]
    USERS --> ROLES["Roles & Permissions"]

    ANALYTICS --> DA["Deep Analytics"]
    ANALYTICS --> LB["Leaderboards"]
    ANALYTICS --> AUDIT["Audit Trail"]

    NOTIF --> NMAN["Push Notifications"]
    NOTIF --> BANNER["Banners"]
    NOTIF --> FAQ["FAQs"]

    SUB --> PLANS["Subscription Plans"]
    SUB --> COUPONS["Coupons"]
    SUB --> PROMO["Promotions"]

    SYS --> SETT["Platform Settings"]
    SYS --> BACKUP["Backups"]
    SYS --> SESS["Active Sessions"]
    SYS --> BIN["Recycle Bin"]
```

---

## 7. Real-Time & Background Job Flow

```mermaid
flowchart LR
    subgraph Events["Trigger Events"]
        T1["Test Submitted"]
        T2["Live Test Started"]
        T3["Scheduled Reminder"]
        T4["User Action<br/>(enroll, purchase, etc.)"]
    end

    subgraph Backend["Backend Processing"]
        direction LR
        WS["WebSocket<br/>(Socket.IO)"]
        QM["Queue Manager<br/>(BullMQ)"]
    end

    subgraph Workers["Background Workers"]
        W1["🧪 Test Evaluation<br/>(auto-grade, scores)"]
        W2["📧 Email Sender<br/>(transactional)"]
        W3["🔔 Notifications<br/>(in-app + push)"]
        W4["🏆 Leaderboard<br/>(recalc rankings)"]
        W5["📈 Analytics<br/>(aggregate stats)"]
        W6["⏰ Reminders<br/>(upcoming tests)"]
    end

    subgraph Frontend["Client Updates"]
        F1["Live Leaderboard<br/>Live Test Monitor"]
        F2["Realtime Sync<br/>(cache invalidation)"]
        F3["Toast Notifications"]
    end

    T1 --> QM
    T2 --> WS
    T3 --> QM
    T4 --> WS
    T4 --> QM

    QM --> W1
    QM --> W2
    QM --> W3
    QM --> W4
    QM --> W5
    QM --> W6

    WS --> F1
    WS --> F2
    W3 --> F3
```

---

## 8. Complete Route Map

```mermaid
mindmap
  root(("Trstprep Routes"))
    Auth
      /login
      /signup
      /verify-email
      /forgot-password
      /reset-password
    Public
      /[Home]
      /about
      /contact
      /terms
      /privacy
      /refund
      /faq
      /blog
      /blog/:id
      /search
      /tag/:tag
      /pass
    Exams
      /exams
      /exams/category/:catId
      /exams/category/:catId/exam/:examId
      /exams/category/:catId/exam/:examId/year/:year
      /exam/:examId
      /exam/:examId/updates
      /exam/:examId/year/:year
      /exam/:examId/compare
    Tests
      /test-series
      /test-series/:seriesId
      /test-series/:id/leaderboard
      /test/:seriesId/:testId/instructions
      /test/:seriesId/:testId
      /test-result/:seriesId/:testId
      /test-review/:seriesId/:testId
      /live-tests
      /live-tests/:id
      /live-test-results/:id
      /live-tests/:id/leaderboard
      /live-tests/:id/review
      /previous-year-papers
      /pyp/:pypId/test
      /practice
      /quizzes
      /leaderboard
    Study
      /study
      /study/:subjectId
      /study/:subjectId/:chapterId
      /videos
      /videos/:subjectSlugOrId
      /current-affairs
      /current-affairs/:caId
    Dashboard
      /dashboard
      /profile
      /analysis
      /bookmarks
      /attempted-tests
      /notifications
      /achievements
      /settings
      /refer-and-earn
    Community
      /community
      /community/groups/:id
      /doubts --> community
      /study-groups --> community
    Errors
      /*
      /error-500
    Admin
      /admin/* --> Redirect
```

---

## 9. API Route Map (Backend)

```mermaid
mindmap
  root(("API Endpoints"))
    /api/auth
      POST /login
      POST /signup
      POST /google
      POST /phone/send-otp
      POST /phone/verify-otp
      POST /logout
      POST /refresh
    /api/admin
      [Nested admin CRUD routes]
    /api/users
      GET/PUT /profile
      GET /:id
    /api/tests
      GET / (list)
      GET /:id
      POST /
      PUT /:id
    /api/attempt
      POST /:testId/start
      POST /:id/submit
      GET /:id/result
      GET /:id/review
    /api/questions
      GET / (list, filter)
      POST /
      PUT /:id
      DELETE /:id
    /api/exams
      GET / (categories)
      GET /:id
      GET /:id/seasons
      GET /:id/yearly
    /api/series
      GET / (list)
      GET /:id
    /api/payments
      POST /create-order
      POST /verify
      GET /history
    /api/study
      GET /subjects
      GET /subjects/:id/chapters
      GET /chapters/:id/content
    /api/practice
      GET /questions
      POST /answer
    /api/current-affairs
      GET / (list)
      GET /:id
    /api/community
      GET /groups
      POST /groups
      POST /groups/:id/join
    /api/blog
      GET / (list)
      GET /:id
    /api/search
      GET /?q=:query
    /api/intelligence
      GET /recommendations
      GET /weak-areas
    /api/subscriptions
      GET /plans
      POST /subscribe
    /api/notifications
      GET / (list)
      PUT /:id/read
    /api/bookmarks
      GET / (list)
      POST /
      DELETE /:id
    /api/leaderboard
      GET / (global)
      GET /test/:testId
    /api/health
    /api/metrics
```
