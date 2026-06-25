# Result Analysis & Performance Tracking

<cite>
**Referenced Files in This Document**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx)
- [Analysis.jsx](file://Frontend/src/pages/Analysis.jsx)
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx)
- [tests.js](file://Backend/src/routes/tests.js)
- [Test.js](file://Backend/src/models/Test.js)
- [Question.js](file://Backend/src/models/Question.js)
- [User.js](file://Backend/src/models/User.js)
- [api.js](file://Frontend/src/services/api.js)
- [dataService.js](file://Frontend/src/services/dataService.js)
- [mockData.js](file://Frontend/src/data/mockData.js)
- [localDB.js](file://Backend/src/db/localDB.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains Trstprep V2’s result analysis and performance tracking system. It covers the multi-tab result interface (performance overview, detailed analysis, solution review), subject-wise performance breakdown, difficulty-level analysis, time management metrics, accuracy patterns, comparative performance indicators, automated result calculation, score interpretation, percentile ranking, and personalized recommendations. It also documents the attempted tests history, test completion statistics, improvement tracking over time, weak area identification, frontend visualization components, backend analytics algorithms, and integration points.

## Project Structure
The system spans frontend React pages and backend APIs:
- Frontend pages implement result presentation, analytics dashboards, and attempted tests lists.
- Backend routes calculate scores, manage test attempts, and expose analytics endpoints.
- Models define data schemas for tests, questions, and users.
- Services integrate with backend APIs and manage caching.

```mermaid
graph TB
subgraph "Frontend"
TR["TestResult.jsx"]
AN["Analysis.jsx"]
AT["AttemptedTests.jsx"]
API["api.js"]
DS["dataService.js"]
end
subgraph "Backend"
RT["routes/tests.js"]
TM["models/Test.js"]
QM["models/Question.js"]
UM["models/User.js"]
DB["db/localDB.js"]
end
TR --> API
AN --> API
AT --> API
API --> RT
RT --> TM
RT --> QM
RT --> UM
DS --> API
DS --> DB
```

**Diagram sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L1-L542)
- [Analysis.jsx](file://Frontend/src/pages/Analysis.jsx#L1-L282)
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx#L1-L278)
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [dataService.js](file://Frontend/src/services/dataService.js#L1-L172)
- [tests.js](file://Backend/src/routes/tests.js#L1-L265)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)

**Section sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L1-L542)
- [Analysis.jsx](file://Frontend/src/pages/Analysis.jsx#L1-L282)
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx#L1-L278)
- [tests.js](file://Backend/src/routes/tests.js#L1-L265)

## Core Components
- Multi-tab result page: Presents quick stats, rank/percentile, and three tabs—overview, analysis, and solutions.
- Analytics dashboard: Summarizes performance, subject-wise metrics, and progress.
- Attempted tests list: Tracks history, completion stats, and reattempt actions.
- Backend scoring engine: Computes scores, accuracy, and placeholders for rank.
- Data services: Integrate with backend APIs and cache data for responsiveness.

Key capabilities:
- Automated result calculation: Correct/wrong/unattempted counts, scaled score, accuracy.
- Comparative performance: Rank vs. total participants, percentile computation.
- Personalized recommendations: Weak/strong subjects, targeted study links.
- Historical tracking: Attempted tests list with filtering and sorting.

**Section sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L61-L542)
- [Analysis.jsx](file://Frontend/src/pages/Analysis.jsx#L11-L282)
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx#L10-L278)
- [tests.js](file://Backend/src/routes/tests.js#L168-L231)

## Architecture Overview
The result analysis pipeline connects frontend pages to backend routes and models. Users complete a test, submit answers, receive a result, and then explore performance insights via dedicated pages.

```mermaid
sequenceDiagram
participant U as "User"
participant TR as "TestResult.jsx"
participant API as "api.js"
participant RT as "routes/tests.js"
participant TM as "models/Test.js"
participant QM as "models/Question.js"
U->>TR : Complete test and navigate to result
TR->>API : Fetch result (mock/local)
API->>RT : GET /tests/ : testId/result/ : attemptId
RT->>TM : Load test metadata
RT->>QM : Load questions with answers
RT-->>API : Computed result (score, accuracy, rank)
API-->>TR : Result payload
TR-->>U : Render overview, analysis, solutions
```

**Diagram sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L69-L89)
- [api.js](file://Frontend/src/services/api.js#L63-L71)
- [tests.js](file://Backend/src/routes/tests.js#L233-L262)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)

## Detailed Component Analysis

### Multi-Tab Result Interface
The result page organizes insights across three tabs:
- Overview: Performance summary, accuracy bar, attempt rate, and subject-wise breakdown.
- Analysis: Difficulty-level correctness, time usage metrics, and marked-for-review indicators.
- Solutions: Filterable question cards with expandable explanations and option highlighting.

```mermaid
flowchart TD
Start(["Load TestResult"]) --> CheckStorage["Check localStorage for lastTestResult"]
CheckStorage --> |Found| Parse["Parse stored result"]
CheckStorage --> |Not found| Mock["Generate mock result"]
Parse --> EnsureQ["Ensure questions array exists"]
EnsureQ --> Render["Render header, rank/percentile, tabs"]
Mock --> Render
Render --> TabSelect{"Active tab?"}
TabSelect --> |overview| Overview["Show accuracy bar, attempt rate, subject breakdown"]
TabSelect --> |analysis| Analysis["Show difficulty analysis, time metrics, marked questions"]
TabSelect --> |solutions| Solutions["Filterable question cards with explanations"]
```

**Diagram sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L61-L502)

**Section sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L61-L542)

### Automated Result Calculation and Scoring
Backend computes:
- Counts: correct, wrong, unattempted.
- Score: scaled by marks per question minus negative marking for wrong answers.
- Accuracy: correct divided by correct plus wrong.
- Rank: placeholder returned until leaderboard logic is implemented.

```mermaid
flowchart TD
S(["Submit Answers"]) --> LoadQ["Load test questions"]
LoadQ --> Iterate["Iterate questions and compare selected option"]
Iterate --> Decision{"Selected option?"}
Decision --> |Unattempted| IncUA["Increment unattempted"]
Decision --> |Correct| IncC["Increment correct"]
Decision --> |Incorrect| IncW["Increment wrong"]
IncUA --> Next["Next question"]
IncC --> Next
IncW --> Next
Next --> Done{"All questions processed?"}
Done --> |No| Iterate
Done --> |Yes| CalcScore["Compute score = (correct * marksPerQuestion) - (wrong * negativeMarking)"]
CalcScore --> CalcAcc["Compute accuracy = (correct / (correct+wrong)) * 100"]
CalcAcc --> Return["Return result payload"]
```

**Diagram sources**
- [tests.js](file://Backend/src/routes/tests.js#L168-L231)

**Section sources**
- [tests.js](file://Backend/src/routes/tests.js#L168-L231)

### Performance Metrics and Visualizations
- Score interpretation: Color-coded score based on percentage of maximum possible.
- Accuracy patterns: Color-coded bars and percentages.
- Time management: Total time, average per question, time saved, and time used percentage.
- Comparative indicators: Rank and percentile rendered prominently.

```mermaid
graph LR
A["Score (%)"] --> C["Color thresholds<br/>Green ≥70%, Yellow 50-70%, Red <50%"]
B["Accuracy (%)"] --> D["Bar chart with color coding"]
E["Time metrics"] --> F["Grid: Total, Avg/Q, Time saved, % used"]
G["Rank/Percentile"] --> H["Prominent card with totals"]
```

**Diagram sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L108-L119)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L260-L291)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L345-L368)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L216-L229)

**Section sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L108-L119)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L260-L291)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L345-L368)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L216-L229)

### Subject-Wise and Difficulty-Level Analysis
- Subject-wise breakdown: Aggregates correct answers per section and displays percentages.
- Difficulty analysis: Counts correct answers per difficulty level (Easy, Medium, Hard).

```mermaid
flowchart TD
SB["Subject Breakdown"] --> Init["Initialize breakdown map"]
Init --> LoopQ["Loop questions"]
LoopQ --> Group["Group by section"]
Group --> Update["Update correct/wrong/unattempted"]
Update --> Percent["Compute percent = correct/total * 100"]
Percent --> RenderSB["Render subject bars"]
DA["Difficulty Analysis"] --> InitD["Initialize difficulty map"]
InitD --> LoopD["Loop questions"]
LoopD --> Diff["Group by difficulty"]
Diff --> UpdateD["Update correct counts"]
UpdateD --> RenderDA["Render difficulty cards"]
```

**Diagram sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L121-L150)

**Section sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L121-L150)

### Solution Review and Question Cards
- Filtering: All, correct, wrong, unattempted, and marked.
- Expandable cards: Show question text, options with correct/incorrect highlighting, and explanations.
- Marked questions: Visual indicator and summary list.

```mermaid
sequenceDiagram
participant U as "User"
participant TR as "TestResult.jsx"
U->>TR : Select filter (e.g., Wrong)
TR->>TR : Filter questions
TR-->>U : Render filtered cards
U->>TR : Click card to expand
TR-->>U : Show options and explanation
```

**Diagram sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L152-L164)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L390-L500)

**Section sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L152-L164)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L390-L500)

### Analytics Dashboard
The analytics page presents:
- Quick stats: Tests attempted, average accuracy, rank, percentile.
- Tabs: Overview (answer distribution, recent tests), Subject-wise, Progress (strengths, weaknesses, recommendations).

```mermaid
graph TB
A["Analytics.jsx"] --> B["Quick Stats Grid"]
A --> C["Tabs: Overview | Subjects | Progress"]
C --> D["Overview: Answer distribution, recent tests"]
C --> E["Subjects: Subject-wise accuracy bars"]
C --> F["Progress: Strengths/Weaknesses, Recommendations"]
```

**Diagram sources**
- [Analysis.jsx](file://Frontend/src/pages/Analysis.jsx#L43-L275)

**Section sources**
- [Analysis.jsx](file://Frontend/src/pages/Analysis.jsx#L11-L282)

### Attempted Tests History
The attempted tests page:
- Lists past test attempts with scores, accuracy, rank, and timing.
- Provides search and filter by series.
- Offers actions: view result and reattempt.

```mermaid
flowchart TD
AT["AttemptedTests.jsx"] --> Fetch["Fetch attempted tests"]
Fetch --> Filter["Apply search and series filters"]
Filter --> Render["Render cards with stats and actions"]
Render --> Actions{"User action?"}
Actions --> |View| Result["Navigate to TestResult"]
Actions --> |Reattempt| Retake["Navigate to Test"]
```

**Diagram sources**
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx#L87-L98)
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx#L194-L271)

**Section sources**
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx#L10-L278)

### Backend Models and Data Flow
- Test model defines test metadata, negative marking, and marks.
- Question model stores question text, options, correct answer, section, and difficulty.
- User model tracks enrolled series and attempted tests.

```mermaid
erDiagram
TEST {
ObjectId _id PK
ObjectId seriesId FK
string slug
string title
string category
number questions
number duration
number marks
number negativeMarking
}
QUESTION {
ObjectId _id PK
ObjectId testId FK
number questionNumber
string_en text
string_hi text
array_en options
array_hi options
number correctOption
string section
string difficulty
}
USER {
ObjectId _id PK
string name
string email
boolean hasProPass
date proPassExpiry
map_enrolledSeries enrolledSeries
map_attemptedTests attemptedTests
}
TEST ||--o{ QUESTION : "has"
USER ||--o{ TEST : "enrolled"
```

**Diagram sources**
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)

**Section sources**
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)

### Data Services and API Integration
- Frontend API client centralizes requests and handles auth tokens.
- Data service wraps API calls, caches responses, and exposes helpers for navigation and filtering.
- Mock data supports development and demonstration.

```mermaid
sequenceDiagram
participant P as "React Page"
participant S as "dataService.js"
participant A as "api.js"
participant B as "Backend routes"
P->>S : getAttemptedTests()
S->>A : GET /users/attempts
A->>B : Forward request with Authorization
B-->>A : Return data
A-->>S : Response
S-->>P : Parsed data
```

**Diagram sources**
- [dataService.js](file://Frontend/src/services/dataService.js#L15-L27)
- [api.js](file://Frontend/src/services/api.js#L73-L81)

**Section sources**
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [dataService.js](file://Frontend/src/services/dataService.js#L1-L172)
- [mockData.js](file://Frontend/src/data/mockData.js#L1-L273)

## Dependency Analysis
- Frontend pages depend on services for data fetching and on backend routes for computations.
- Backend routes depend on models for schema enforcement and data retrieval.
- Local database helper provides JSON-backed persistence during development.

```mermaid
graph TB
TR["TestResult.jsx"] --> API["api.js"]
AN["Analysis.jsx"] --> API
AT["AttemptedTests.jsx"] --> API
API --> RT["routes/tests.js"]
RT --> TM["models/Test.js"]
RT --> QM["models/Question.js"]
RT --> UM["models/User.js"]
DS["dataService.js"] --> API
DS --> DB["db/localDB.js"]
```

**Diagram sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L1-L542)
- [Analysis.jsx](file://Frontend/src/pages/Analysis.jsx#L1-L282)
- [AttemptedTests.jsx](file://Frontend/src/pages/AttemptedTests.jsx#L1-L278)
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [dataService.js](file://Frontend/src/services/dataService.js#L1-L172)
- [tests.js](file://Backend/src/routes/tests.js#L1-L265)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)

**Section sources**
- [tests.js](file://Backend/src/routes/tests.js#L1-L265)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)

## Performance Considerations
- Client-side filtering and rendering are optimized with memoization and controlled re-renders.
- Data caching reduces repeated network calls for static content.
- Backend scoring is O(n) over the number of questions.
- Consider pagination for large attempted tests lists and lazy loading for solution expansions.

## Troubleshooting Guide
Common issues and resolutions:
- Missing or invalid auth token: Requests are intercepted and redirect to login.
- Network errors: Logged and surfaced to the console; verify API URL and server availability.
- Result not found: Ensure attemptId and testId are correct and that backend routes are implemented.
- Local storage fallback: Demo results are generated when no stored result exists.

Actions:
- Verify token presence in localStorage.
- Confirm API base URL matches backend deployment.
- Check backend route endpoints and database connectivity.

**Section sources**
- [api.js](file://Frontend/src/services/api.js#L12-L44)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L69-L89)

## Conclusion
Trstprep V2’s result analysis and performance tracking system combines robust frontend visualization with backend scoring and analytics. The multi-tab result interface delivers actionable insights, while the analytics dashboard and attempted tests history support continuous improvement. As implemented, the system computes scores, accuracy, and comparative metrics, with placeholders for rank and leaderboard features. Extending backend routes to persist attempts and compute global rankings will complete the performance tracking pipeline.

*Last Updated: March 10, 2026 | Update date is (20:16)*
