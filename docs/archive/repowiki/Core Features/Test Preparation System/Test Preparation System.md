# Test Preparation System

<cite>
**Referenced Files in This Document**
- [TestSeries.js](file://Backend/src/models/TestSeries.js)
- [Test.js](file://Backend/src/models/Test.js)
- [Question.js](file://Backend/src/models/Question.js)
- [User.js](file://Backend/src/models/User.js)
- [db.json](file://Backend/data/db.json)
- [TestInterface.jsx](file://Frontend/src/pages/TestInterface.jsx)
- [TestSeries.jsx](file://Frontend/src/pages/TestSeries.jsx)
- [TestDetails.jsx](file://Frontend/src/pages/TestDetails.jsx)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx)
- [tests.js](file://Backend/src/routes/tests.js)
- [series.js](file://Backend/src/routes/series.js)
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx)
- [api.js](file://Frontend/src/services/api.js)
- [localDB.js](file://Backend/src/db/localDB.js)
- [auth.js](file://Backend/src/middleware/auth.js)
- [AuthContext.jsx](file://Frontend/src/context/AuthContext.jsx)
- [app.js](file://Backend/src/app.js)
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
This document provides comprehensive documentation for Trstprep V2's test preparation system. It covers the entire test workflow from browsing test series and enrollment to test completion and result analysis. The system organizes test series by categories (SSC, Railway, Banking, Defence, State), supports enrollment, test scheduling, and progress tracking. The interactive test interface offers a full-screen experience, multi-language support (English/Hindi), integrated timer, question navigation, marking system, and auto-save functionality. Administrators can manage test series, create and edit questions, classify difficulty, and configure test durations. The frontend components integrate with backend APIs, while the backend uses a local JSON database with MongoDB-like models.

## Project Structure
The project follows a clear separation of concerns:
- Backend: Express.js server with local JSON database, models, routes, middleware, and authentication
- Frontend: React application with pages for test series, test interface, results, and admin management
- Shared: API service layer and authentication context

```mermaid
graph TB
subgraph "Frontend"
FE_TestSeries[TestSeries.jsx]
FE_TestDetails[TestDetails.jsx]
FE_TestInterface[TestInterface.jsx]
FE_TestResult[TestResult.jsx]
FE_Admin[TestSeriesManager.jsx]
FE_API[api.js]
FE_Auth[AuthContext.jsx]
end
subgraph "Backend"
BE_App[app.js]
BE_Routes_Series[series.js]
BE_Routes_Tests[tests.js]
BE_MW_Auth[auth.js]
BE_DB[localDB.js]
BE_Models_TestSeries[TestSeries.js]
BE_Models_Test[Test.js]
BE_Models_Question[Question.js]
BE_Models_User[User.js]
end
FE_TestSeries --> FE_API
FE_TestDetails --> FE_API
FE_TestInterface --> FE_API
FE_TestResult --> FE_API
FE_Admin --> FE_API
FE_Auth --> BE_App
FE_API --> BE_App
BE_App --> BE_Routes_Series
BE_App --> BE_Routes_Tests
BE_App --> BE_MW_Auth
BE_App --> BE_DB
BE_DB --> BE_Models_TestSeries
BE_DB --> BE_Models_Test
BE_DB --> BE_Models_Question
BE_DB --> BE_Models_User
```

**Diagram sources**
- [app.js](file://Backend/src/app.js#L1-L94)
- [series.js](file://Backend/src/routes/series.js#L1-L162)
- [tests.js](file://Backend/src/routes/tests.js#L1-L265)
- [auth.js](file://Backend/src/middleware/auth.js#L1-L92)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L1-L71)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)
- [TestSeries.jsx](file://Frontend/src/pages/TestSeries.jsx#L1-L427)
- [TestDetails.jsx](file://Frontend/src/pages/TestDetails.jsx#L1-L330)
- [TestInterface.jsx](file://Frontend/src/pages/TestInterface.jsx#L1-L677)
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L1-L542)
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx#L1-L424)
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [AuthContext.jsx](file://Frontend/src/context/AuthContext.jsx#L1-L203)

**Section sources**
- [app.js](file://Backend/src/app.js#L1-L94)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)

## Core Components
This section outlines the primary components and their responsibilities:

- Test Series Model: Defines test series structure, categories, ratings, and metadata
- Test Model: Represents individual tests with types, durations, marks, and scheduling
- Question Model: Stores questions with multilingual support, options, correct answers, and difficulty
- User Model: Manages user profiles, enrollment, progress tracking, and Pro Pass validation
- Backend Routes: Provide APIs for series discovery, test access, question retrieval, and result submission
- Frontend Pages: Implement user-facing workflows for browsing, enrolling, taking tests, and reviewing results
- Admin Management: Enables administrators to create and manage test series and related content

**Section sources**
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L1-L71)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)
- [series.js](file://Backend/src/routes/series.js#L1-L162)
- [tests.js](file://Backend/src/routes/tests.js#L1-L265)

## Architecture Overview
The system employs a client-server architecture with a local JSON database abstraction layer. Authentication middleware secures protected routes, while the frontend consumes RESTful APIs to deliver an interactive test-taking experience.

```mermaid
sequenceDiagram
participant Client as "Frontend Client"
participant AuthMW as "Auth Middleware"
participant SeriesAPI as "Series Routes"
participant TestsAPI as "Tests Routes"
participant DB as "Local JSON DB"
Client->>SeriesAPI : GET /api/series/ : slug
SeriesAPI->>AuthMW : Verify token (optional)
SeriesAPI->>DB : Find series by slug
DB-->>SeriesAPI : Series data
SeriesAPI-->>Client : Series details
Client->>TestsAPI : GET /api/tests/ : testId/questions
TestsAPI->>AuthMW : Verify token (required)
TestsAPI->>DB : Find test and questions
DB-->>TestsAPI : Test and questions
TestsAPI-->>Client : Questions payload
Client->>TestsAPI : PUT /api/tests/ : testId/submit
TestsAPI->>AuthMW : Verify token (required)
TestsAPI->>DB : Calculate score and store attempt
DB-->>TestsAPI : Result data
TestsAPI-->>Client : Submission result
```

**Diagram sources**
- [series.js](file://Backend/src/routes/series.js#L55-L93)
- [tests.js](file://Backend/src/routes/tests.js#L86-L123)
- [tests.js](file://Backend/src/routes/tests.js#L168-L231)
- [auth.js](file://Backend/src/middleware/auth.js#L4-L66)
- [localDB.js](file://Backend/src/db/localDB.js#L82-L133)

## Detailed Component Analysis

### Test Series Organization and Enrollment
- Categories: SSC, Railway, Banking, Defence, State, Other
- Metadata: Title, description, image/icon, total/free tests, ratings, tags, test types
- Enrollment: Users can enroll in series; progress tracked per series
- Discovery: Filtering by category, sorting by popularity/rating/tests, and search

```mermaid
flowchart TD
Start(["User visits Test Series"]) --> Browse["Browse by category<br/>and filters"]
Browse --> ViewDetails["View series details"]
ViewDetails --> Enroll{"User enrolled?"}
Enroll --> |No| AddSeries["Add to series"]
Enroll --> |Yes| Continue["Continue learning"]
AddSeries --> Dashboard["Dashboard updates progress"]
Continue --> Dashboard
```

**Section sources**
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L16-L20)
- [TestSeries.jsx](file://Frontend/src/pages/TestSeries.jsx#L21-L104)
- [TestDetails.jsx](file://Frontend/src/pages/TestDetails.jsx#L79-L81)

### Interactive Test Interface
- Full-screen experience with responsive design
- Multi-language support: English/Hindi via language toggle
- Timer integration with pause/resume and low-time warnings
- Question navigation: palette, section tabs, previous/next
- Marking system: mark for review, clear response
- Auto-save: answers persisted during test session
- Scoring: +2/-0.5 scoring scheme applied automatically

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "TestInterface.jsx"
participant API as "tests.js"
participant DB as "localDB.js"
User->>UI : Start test
UI->>API : GET /tests/ : testId/questions
API->>DB : Retrieve questions
DB-->>API : Questions
API-->>UI : Questions payload
UI->>UI : Timer countdown
User->>UI : Select answer / mark review
UI->>UI : Persist answers locally
User->>UI : Submit test
UI->>API : PUT /tests/ : testId/submit
API->>DB : Calculate score
DB-->>API : Result
API-->>UI : Result data
UI-->>User : Redirect to TestResult
```

**Diagram sources**
- [TestInterface.jsx](file://Frontend/src/pages/TestInterface.jsx#L11-L72)
- [TestInterface.jsx](file://Frontend/src/pages/TestInterface.jsx#L185-L229)
- [tests.js](file://Backend/src/routes/tests.js#L86-L123)
- [tests.js](file://Backend/src/routes/tests.js#L168-L231)
- [localDB.js](file://Backend/src/db/localDB.js#L82-L133)

**Section sources**
- [TestInterface.jsx](file://Frontend/src/pages/TestInterface.jsx#L1-L677)
- [tests.js](file://Backend/src/routes/tests.js#L86-L123)

### Test Completion and Result Analysis
- Result generation: Score, accuracy, time taken, rank, percentile
- Subject-wise and difficulty-wise breakdown
- Solution review with expandable explanations
- Action buttons: reattempt, share, continue learning

```mermaid
flowchart TD
Submit["Submit Test"] --> Calc["Calculate Score<br/>+2/-0.5 per question"]
Calc --> Store["Store Attempt"]
Store --> Result["Generate Result"]
Result --> Overview["Performance Overview"]
Result --> Analysis["Subject/Difficulty Analysis"]
Result --> Solutions["Question Solutions"]
Overview --> Actions["Reattempt / Share / Continue"]
Analysis --> Actions
Solutions --> Actions
```

**Section sources**
- [TestResult.jsx](file://Frontend/src/pages/TestResult.jsx#L1-L542)
- [tests.js](file://Backend/src/routes/tests.js#L168-L231)

### Admin Test Series Management
- Create/update/delete test series
- Configure categories, difficulty, pricing, tags, and activity status
- Slug generation and validation
- Bulk operations and form validation

```mermaid
classDiagram
class TestSeriesManager {
+useState(series)
+useState(showForm)
+useState(formData)
+fetchSeries()
+handleSubmit()
+handleEdit()
+handleDelete()
+resetForm()
}
class TestSeriesModel {
+string title
+string slug
+string category
+number totalTests
+boolean isPro
+number price
+string[] tags
+boolean isActive
}
TestSeriesManager --> TestSeriesModel : "manages"
```

**Diagram sources**
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx#L1-L424)
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L1-L71)

**Section sources**
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx#L1-L424)
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L1-L71)

### Backend Data Models
The backend defines robust models for test data structures:

```mermaid
erDiagram
TESTSERIES {
string slug PK
string title
string category
string description
string image
string icon
number totalTests
number freeTests
string activeUsers
number rating
string[] tags
string[] testTypes
boolean isActive
}
TEST {
ObjectId _id PK
ObjectId seriesId FK
string slug
string title
string category
string subCategory
string type
number questions
number duration
number marks
number negativeMarking
string[] tags
boolean isLive
date liveSchedule
boolean isActive
}
QUESTION {
ObjectId _id PK
ObjectId testId FK
number questionNumber
json text
json options
number correctOption
string section
string explanation
string difficulty
string image
}
USER {
ObjectId _id PK
string name
string email
string password
string mobile
string avatar
boolean isAdmin
boolean hasProPass
date proPassExpiry
ObjectId[] enrolledSeries
Map attemptedTests
}
TESTSERIES ||--o{ TEST : "contains"
TEST ||--o{ QUESTION : "contains"
USER ||--o{ TESTSERIES : "enrolled"
```

**Diagram sources**
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L1-L71)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)

**Section sources**
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L1-L71)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [User.js](file://Backend/src/models/User.js#L1-L81)

### API Endpoints and Workflows
Key backend endpoints:
- Series: GET `/api/series`, GET `/api/series/:slug`, GET `/api/series/:slug/tests`, GET `/api/series/category/:category`
- Tests: GET `/api/tests/tag/:tag`, GET `/api/tests/:testId`, GET `/api/tests/:testId/questions`, POST `/api/tests/:testId/start`, PUT `/api/tests/:testId/submit`, GET `/api/tests/:testId/result/:attemptId`

```mermaid
sequenceDiagram
participant Client as "Client"
participant Series as "Series Route"
participant Tests as "Tests Route"
participant Auth as "Auth Middleware"
participant DB as "Local DB"
Client->>Series : GET /api/series/ : slug
Series->>Auth : optionalAuth
Series->>DB : Find series
DB-->>Series : Series
Series-->>Client : Series data
Client->>Tests : GET /api/tests/ : testId/questions
Tests->>Auth : protect
Tests->>DB : Find test + questions
DB-->>Tests : Questions
Tests-->>Client : Questions
```

**Diagram sources**
- [series.js](file://Backend/src/routes/series.js#L55-L93)
- [tests.js](file://Backend/src/routes/tests.js#L86-L123)
- [auth.js](file://Backend/src/middleware/auth.js#L46-L66)
- [localDB.js](file://Backend/src/db/localDB.js#L82-L133)

**Section sources**
- [series.js](file://Backend/src/routes/series.js#L1-L162)
- [tests.js](file://Backend/src/routes/tests.js#L1-L265)

## Dependency Analysis
The system exhibits clear separation of concerns with minimal coupling between frontend and backend:

```mermaid
graph LR
FE_API[Frontend API Layer] --> BE_ROUTES[Backend Routes]
BE_ROUTES --> BE_MW[Middleware]
BE_ROUTES --> BE_DB[Local DB]
BE_DB --> BE_MODELS[Models]
FE_AUTH[AuthContext] --> FE_API
FE_PAGES[Pages] --> FE_API
FE_ADMIN[Admin Pages] --> FE_API
```

**Diagram sources**
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [AuthContext.jsx](file://Frontend/src/context/AuthContext.jsx#L1-L203)
- [app.js](file://Backend/src/app.js#L56-L67)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)

**Section sources**
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [AuthContext.jsx](file://Frontend/src/context/AuthContext.jsx#L1-L203)
- [app.js](file://Backend/src/app.js#L1-L94)

## Performance Considerations
- Local JSON database: Suitable for development and small-scale usage; consider migrating to MongoDB for production scalability
- Client-side caching: Local storage used for last test result and session persistence
- API pagination: Not implemented; consider adding pagination for large datasets
- Image/video assets: Not utilized in current models; plan for CDN integration when media is introduced
- Timer accuracy: Frontend timer relies on client clock; consider server-side heartbeat for robustness

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Verify JWT token presence and validity; check middleware error responses
- Access denied for Pro tests: Ensure user has Pro Pass; validate middleware enforcement
- No questions returned: Confirm test exists and questions are populated; check database seeding
- CORS errors: Verify frontend URL matches backend CORS configuration
- Session expiration: Implement automatic token refresh and session renewal

**Section sources**
- [auth.js](file://Backend/src/middleware/auth.js#L4-L66)
- [tests.js](file://Backend/src/routes/tests.js#L100-L106)
- [app.js](file://Backend/src/app.js#L29-L32)
- [AuthContext.jsx](file://Frontend/src/context/AuthContext.jsx#L43-L98)

## Conclusion
Trstprep V2 delivers a comprehensive test preparation ecosystem with organized series, seamless enrollment, robust test-taking interface, and detailed analytics. The modular architecture enables easy administration and future enhancements, including migration to MongoDB and media asset integration. The system provides a solid foundation for scalable exam preparation services across multiple competitive exam categories.

*Last Updated: March 10, 2026 | Update date is (20:16)*
