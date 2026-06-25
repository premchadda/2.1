# Trstprep V2.1 — Workflow / Flow Map

Visual map of the main request, data, and decision flows extracted from the audit graph.

---

## 1. Test Attempt Lifecycle (the core user journey)

```mermaid
flowchart TB
    U([User]) --> TI[TestInstructions<br/>system check, agreement]
    TI -->|agree| TS[POST /api/tests/:testId/start]
    TS --> SM[testStateMachine<br/>server-authoritative timer]
    SM --> TIA[TestInterface<br/>questions, palette, timer]
    TIA -->|autosave 5s| AS[PUT /api/tests/:testId/autosave]
    TIA -->|pause| PA[PUT /api/tests/:testId/pause]
    PA -->|resume| AS
    TIA -->|submit| SB[PUT /api/tests/:testId/submit]
    SB --> OOB[transactional outbox<br/>outbox_events]
    OOB --> EVT[eventBus<br/>test:completed]
    EVT --> ANA[analyticsService]
    EVT --> LB[leaderboardService]
    EVT --> NOT[notificationService]
    SB --> TR[GET /api/tests/:testId/result]
    TR --> TRP[TestResult page<br/>score ring, breakdown]
    TRP --> TRV[TestReview page<br/>solutions, practice mode]
    TRV -->|reattempt| TI

    style TS fill:#2c7be5,color:#fff
    style SB fill:#2c7be5,color:#fff
    style TR fill:#2c7be5,color:#fff
    style OOB fill:#ff7f0e,color:#fff
    style EVT fill:#ff7f0e,color:#fff
    style SM fill:#9467bd,color:#fff
```

---

## 2. Pro Pass / Razorpay Purchase

```mermaid
flowchart LR
    U([User]) --> PP[Pass page<br/>fetch plans every 5s]
    PP -->|click Buy| CO[POST /api/payments/create-order]
    CO --> RZP[Load Razorpay SDK]
    RZP --> MODAL[Razorpay Checkout modal]
    MODAL -->|payment success| VR[POST /api/payments/verify]
    VR --> SIG[HMAC signature verify]
    SIG -->|valid| SUB[Update user.proPassExpiry]
    SIG -->|invalid| ERR[Reject + log]
    SUB --> NOT[Send receipt email]
    SUB --> UI[Reload Pass page → Pro status]

    style CO fill:#2c7be5,color:#fff
    style VR fill:#2c7be5,color:#fff
    style SIG fill:#e74c3c,color:#fff
    style SUB fill:#2ca02c,color:#fff
```

---

## 3. Auth & Session Flow

```mermaid
flowchart TB
    LOGIN[POST /api/auth/login] --> CSRF1[CSRF token issued]
    CSRF1 --> COOKIE1[httpOnly cookie set]
    COOKIE1 --> JWT[JWT access token]
    JWT --> STORE[(Frontend dataService<br/>apiClient + axios)]
    STORE -->|every request| MW[auth.middleware verify JWT]
    MW -->|valid| HANDLER[Route handler]
    MW -->|expired| RF[POST /api/auth/refresh]
    RF -->|refresh cookie valid| NEW[New JWT + new cookie]
    RF -->|invalid| LO[Redirect /login]
    MW -->|401| INT[axios 401 interceptor]
    INT --> RF
    HANDLER -->|logout| OUT[POST /api/auth/logout]
    OUT --> COOKIE2[Clear httpOnly cookie]
    OUT --> SESS[SessionCaptureService.recordLogout]

    style CSRF1 fill:#ff7f0e,color:#fff
    style MW fill:#9467bd,color:#fff
    style INT fill:#9467bd,color:#fff
```

---

## 4. Admin Test CRUD pattern (the admin idiom)

```mermaid
flowchart LR
    LIST[AdminTestsManager<br/>table + filters] -->|click row| VIEW[Test detail / edit]
    LIST -->|new| FORM[TestFormModal]
    LIST -->|bulk upload| CSV[BulkUploadModal<br/>CSV/Excel/JSON]
    CSV --> PARSE[mapBulkRowToTestPayload]
    PARSE -->|per row| VAL[testSchema Zod]
    VAL -->|valid| DB[(tests table)]
    VAL -->|invalid| ERR[Row-level error]
    FORM -->|save| VAL
    VAL --> DB
    DB --> SYNC[syncTestStats<br/>total_questions / total_marks]
    SYNC --> EVT[eventBus content:updated]
    EVT --> CACHE[Invalidate TanStack Query]
    DB -->|stream| EXP[CSV export]

    style VAL fill:#e74c3c,color:#fff
    style SYNC fill:#ff7f0e,color:#fff
    style EVT fill:#ff7f0e,color:#fff
```

---

## 5. Community (Study Groups) flow

```mermaid
flowchart TB
    U([User]) --> GL[GET /api/study-groups<br/>list + categories]
    GL -->|click| GD[GroupDetail]
    GD --> T1[ChatTab<br/>socket.io live]
    GD --> T2[DiscussionsTab<br/>posts, likes, comments]
    GD --> T3[MembersTab<br/>role badges]
    T1 -->|send| GM[POST /api/study-groups/:id/messages]
    GM --> EB1[eventBus group:message]
    EB1 -->|broadcast| T1
    T2 -->|post| GP[POST /api/study-groups/:id/posts]
    GP --> EB2[eventBus group:post]
    T2 -->|like| GLK[POST /api/study-groups/posts/:id/like]
    T2 -->|comment| GC[POST /api/study-groups/posts/:id/comments]
    GM --> SOFT[soft delete + cursor pagination]
    GP --> PIN[pin / lock moderation]

    style GM fill:#2c7be5,color:#fff
    style GP fill:#2c7be5,color:#fff
    style EB1 fill:#ff7f0e,color:#fff
    style EB2 fill:#ff7f0e,color:#fff
```

---

## 6. Data Service request path (every frontend call)

```mermaid
flowchart LR
    PAGE[React page] --> HOOK[useQuery / useMutation<br/>TanStack Query]
    HOOK --> DS[dataService.js<br/>testsAPI / authAPI / adminAPI ...]
    DS -->|fetchWithCache| AX[axios apiClient]
    AX -->|inject| XCSRF[X-CSRF-Token header]
    AX -->|attach| HC[httpOnly cookie]
    AX --> NET((HTTPS))
    NET --> BX[Express]
    BX -->|verify JWT| AUTH[auth.middleware]
    AUTH -->|RBAC| ROLE[protect + admin]
    ROLE -->|resolve id| IDX[findEntityByIdentifier<br/>id/_id/slug/public_id]
    IDX --> ROUTE[Route handler]
    ROUTE --> DBH[dbHelpers / postgres-helpers]
    DBH --> PG[(PostgreSQL)]
    ROUTE -->|on error| ERR[DataError hierarchy]
    ERR --> MAP[NetworkError / ValidationError /<br/>AuthenticationError / NotFoundError]
    MAP --> TOAST[react-hot-toast]
    AX -->|401| RETRY[refresh + retry once]
    RETRY -->|still 401| LOGOUT[redirect /login]

    style AX fill:#9467bd,color:#fff
    style AUTH fill:#9467bd,color:#fff
    style IDX fill:#ff7f0e,color:#fff
    style DBH fill:#2c7be5,color:#fff
```

---

## 7. Public routing (slug-first) for study content

```mermaid
flowchart LR
    URL[/exam-info/ssc-cgl-2025/] --> R[GET /api/study/subjects/:slug]
    URL --> R2[GET /api/study/subjects/:slug/chapters]
    URL --> R3[GET /api/study/videos/hierarchical]
    R --> RES[findSubjectBySlugOrId]
    R2 --> RES
    R3 --> LO[loadSubjectMediaBundle]
    RES --> DB[(subjects / study_materials<br/>via slug OR numeric id)]
    LO --> DB
    LO --> RHC[resolveSubjectContent]
    LO --> BHC[buildHierarchyFromUnits]
    LO --> CNT[calculateStudyMaterialCounts]
    RHC --> JOIN[(JOIN subjects + tests + videos + pdfs)]
    BHC --> JOIN
    JOIN --> UI[ExamDetails.jsx<br/>5-tab renderer]

    style RES fill:#ff7f0e,color:#fff
    style LO fill:#ff7f0e,color:#fff
    style BHC fill:#ff7f0e,color:#fff
```

---

## 8. Monorepo deployment topology

```mermaid
flowchart TB
    subgraph MONOREPO[Turborepo monorepo]
        direction TB
        ROOT[trstprep/] --> APPS[apps/]
        ROOT --> PKG[packages/]
        ROOT --> SCR[scripts/]
        APPS --> FE[apps/frontend<br/>React SPA<br/>Vite]
        APPS --> ADM[apps/admin-panel<br/>React SPA<br/>Vite]
        APPS --> BE[apps/backend<br/>Node + Express<br/>Postgres]
        PKG --> SC[packages/shared-config]
        SCR --> SEED[seed scripts]
    end
    BE --> PG[(PostgreSQL)]
    BE --> RAZ[Razorpay API]
    BE --> STR[Stripe API]
    BE --> S3[(S3 / storageProvider<br/>assets + avatars)]
    BE --> MAIL[Email SMTP]
    BE --> WS[Socket.io<br/>real-time]
    FE --> BE
    ADM --> BE
    FE -.view site.-> ADM

    style BE fill:#2c7be5,color:#fff
    style FE fill:#ff7f0e,color:#fff
    style ADM fill:#ff7f0e,color:#fff
    style SC fill:#2ca02c,color:#fff
```

---

## Legend

| Color | Meaning |
|---|---|
| Blue (`#2c7be5`) | Backend HTTP route / API endpoint |
| Orange (`#ff7f0e`) | Cross-cutting concern (event bus, ID resolution, schema sync) |
| Purple (`#9467bd`) | Cross-cutting middleware / interceptor |
| Green (`#2ca02c`) | State / persistence transition |
| Red (`#e74c3c`) | Validation / security gate |
