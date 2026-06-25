# Admin Panel & Content Administration

<cite>
**Referenced Files in This Document**
- [AdminDashboard.jsx](file://Frontend/src/pages/admin/AdminDashboard.jsx)
- [UsersManager.jsx](file://Frontend/src/pages/admin/UsersManager.jsx)
- [QuestionsManager.jsx](file://Frontend/src/pages/admin/QuestionsManager.jsx)
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx)
- [StudyMaterialsManager.jsx](file://Frontend/src/pages/admin/StudyMaterialsManager.jsx)
- [CategoriesManager.jsx](file://Frontend/src/pages/admin/CategoriesManager.jsx)
- [MediaLibrary.jsx](file://Frontend/src/pages/admin/MediaLibrary.jsx)
- [TestsManager.jsx](file://Frontend/src/pages/admin/TestsManager.jsx)
- [AdminSettings.jsx](file://Frontend/src/pages/admin/AdminSettings.jsx)
- [api.js](file://Frontend/src/services/api.js)
- [admin.js](file://Backend/src/routes/admin.js)
- [auth.js](file://Backend/src/middleware/auth.js)
- [localDB.js](file://Backend/src/db/localDB.js)
- [User.js](file://Backend/src/models/User.js)
- [Question.js](file://Backend/src/models/Question.js)
- [Test.js](file://Backend/src/models/Test.js)
- [TestSeries.js](file://Backend/src/models/TestSeries.js)
- [db.json](file://Backend/data/db.json)
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
This document provides comprehensive documentation for Trstprep V2's administrative panel and content management capabilities. It covers the admin dashboard, user management, content administration workflows for questions, test series, study materials, categories, and media library. It also explains user administration features, soft delete mechanisms, bulk operations, and administrative security measures including role-based access control and workflow automation.

## Project Structure
The admin functionality is split between the frontend React application and the backend Express server with a local JSON database. The frontend admin pages communicate with backend routes secured by JWT-based authentication and admin-only authorization middleware.

```mermaid
graph TB
subgraph "Frontend Admin Pages"
AD["AdminDashboard.jsx"]
UM["UsersManager.jsx"]
QM["QuestionsManager.jsx"]
TM["TestSeriesManager.jsx"]
SM["StudyMaterialsManager.jsx"]
CM["CategoriesManager.jsx"]
ML["MediaLibrary.jsx"]
TS["TestsManager.jsx"]
AS["AdminSettings.jsx"]
end
subgraph "Frontend Services"
API["api.js"]
end
subgraph "Backend Routes"
AR["admin.js"]
end
subgraph "Backend Middleware"
AM["auth.js"]
LDB["localDB.js"]
end
subgraph "Backend Models"
U["User.js"]
Q["Question.js"]
T["Test.js"]
TSER["TestSeries.js"]
end
subgraph "Backend Data"
DB["db.json"]
end
AD --> API
UM --> API
QM --> API
TM --> API
SM --> API
CM --> API
ML --> API
TS --> API
AS --> API
API --> AR
AR --> AM
AR --> LDB
LDB --> DB
AM --> U
LDB --> U
LDB --> Q
LDB --> T
LDB --> TSER
```

**Diagram sources**
- [AdminDashboard.jsx](file://Frontend/src/pages/admin/AdminDashboard.jsx#L1-L182)
- [UsersManager.jsx](file://Frontend/src/pages/admin/UsersManager.jsx#L1-L188)
- [QuestionsManager.jsx](file://Frontend/src/pages/admin/QuestionsManager.jsx#L1-L421)
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx#L1-L424)
- [StudyMaterialsManager.jsx](file://Frontend/src/pages/admin/StudyMaterialsManager.jsx#L1-L539)
- [CategoriesManager.jsx](file://Frontend/src/pages/admin/CategoriesManager.jsx#L1-L432)
- [MediaLibrary.jsx](file://Frontend/src/pages/admin/MediaLibrary.jsx#L1-L154)
- [TestsManager.jsx](file://Frontend/src/pages/admin/TestsManager.jsx#L1-L527)
- [AdminSettings.jsx](file://Frontend/src/pages/admin/AdminSettings.jsx#L1-L213)
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [admin.js](file://Backend/src/routes/admin.js#L1-L557)
- [auth.js](file://Backend/src/middleware/auth.js#L1-L92)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)
- [User.js](file://Backend/src/models/User.js#L1-L81)
- [Question.js](file://Backend/src/models/Question.js#L1-L54)
- [Test.js](file://Backend/src/models/Test.js#L1-L77)
- [TestSeries.js](file://Backend/src/models/TestSeries.js#L1-L71)
- [db.json](file://Backend/data/db.json#L1-L728)

**Section sources**
- [AdminDashboard.jsx](file://Frontend/src/pages/admin/AdminDashboard.jsx#L1-L182)
- [admin.js](file://Backend/src/routes/admin.js#L1-L557)
- [auth.js](file://Backend/src/middleware/auth.js#L1-L92)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)

## Core Components
This section outlines the primary admin components and their responsibilities:

- Admin Dashboard: Provides statistics cards, quick actions, and recent activity feed. It fetches aggregated stats from the backend admin stats endpoint.
- Users Management: Lists users, allows toggling Pro Pass status, and supports search by name or email.
- Questions Management: CRUD operations for questions, bulk upload via CSV, and tagging support.
- Test Series Management: Manages test series with categories, pricing, difficulty, and activation status.
- Study Materials Management: Hierarchical subject management with soft delete, enable/disable, reordering, and trash restoration.
- Categories Management: Hierarchical test categories with nested structure support and tree rendering.
- Media Library: File upload interface supporting videos, PDFs, and images with progress indication.
- Tests Management: Individual test creation/editing with series association, category/subcategory mapping, and activation controls.
- Admin Settings: Application-wide settings configuration including contact information and social links.

**Section sources**
- [AdminDashboard.jsx](file://Frontend/src/pages/admin/AdminDashboard.jsx#L1-L182)
- [UsersManager.jsx](file://Frontend/src/pages/admin/UsersManager.jsx#L1-L188)
- [QuestionsManager.jsx](file://Frontend/src/pages/admin/QuestionsManager.jsx#L1-L421)
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx#L1-L424)
- [StudyMaterialsManager.jsx](file://Frontend/src/pages/admin/StudyMaterialsManager.jsx#L1-L539)
- [CategoriesManager.jsx](file://Frontend/src/pages/admin/CategoriesManager.jsx#L1-L432)
- [MediaLibrary.jsx](file://Frontend/src/pages/admin/MediaLibrary.jsx#L1-L154)
- [TestsManager.jsx](file://Frontend/src/pages/admin/TestsManager.jsx#L1-L527)
- [AdminSettings.jsx](file://Frontend/src/pages/admin/AdminSettings.jsx#L1-L213)

## Architecture Overview
The admin architecture follows a client-server pattern with JWT-based authentication and admin-only authorization. All admin routes are protected by middleware that verifies tokens and ensures the requesting user has admin privileges.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "Frontend API Layer"
participant Route as "Backend Admin Routes"
participant Auth as "Auth Middleware"
participant DB as "Local DB"
Admin->>API : Fetch dashboard stats
API->>Route : GET /api/admin/stats
Route->>Auth : protect + admin
Auth-->>Route : verified admin user
Route->>DB : dbHelpers.count()
DB-->>Route : counts
Route-->>API : {success : true, data : stats}
API-->>Admin : Render stats cards
Admin->>API : Toggle Pro Pass
API->>Route : PUT /api/admin/users/ : id/pro-pass
Route->>Auth : protect + admin
Auth-->>Route : verified admin user
Route->>DB : dbHelpers.updateById(users)
DB-->>Route : updated user
Route-->>API : {success : true, data : user}
API-->>Admin : Update UI
```

**Diagram sources**
- [AdminDashboard.jsx](file://Frontend/src/pages/admin/AdminDashboard.jsx#L16-L33)
- [UsersManager.jsx](file://Frontend/src/pages/admin/UsersManager.jsx#L30-L58)
- [admin.js](file://Backend/src/routes/admin.js#L13-L29)
- [auth.js](file://Backend/src/middleware/auth.js#L5-L44)
- [localDB.js](file://Backend/src/db/localDB.js#L170-L185)

**Section sources**
- [admin.js](file://Backend/src/routes/admin.js#L8-L10)
- [auth.js](file://Backend/src/middleware/auth.js#L68-L78)
- [localDB.js](file://Backend/src/db/localDB.js#L82-L219)

## Detailed Component Analysis

### Admin Dashboard
The dashboard aggregates key metrics and provides quick access to common admin tasks. It fetches stats from the backend `/api/admin/stats` endpoint and displays them in interactive cards. Quick actions offer shortcuts to frequently used admin pages.

```mermaid
flowchart TD
Start(["Load Dashboard"]) --> FetchStats["Fetch Stats from /api/admin/stats"]
FetchStats --> RenderStats["Render Stat Cards"]
RenderStats --> QuickActions["Render Quick Actions"]
QuickActions --> RecentActivity["Render Recent Activity"]
RecentActivity --> End(["Dashboard Ready"])
```

**Diagram sources**
- [AdminDashboard.jsx](file://Frontend/src/pages/admin/AdminDashboard.jsx#L16-L33)
- [admin.js](file://Backend/src/routes/admin.js#L13-L29)

**Section sources**
- [AdminDashboard.jsx](file://Frontend/src/pages/admin/AdminDashboard.jsx#L35-L87)
- [admin.js](file://Backend/src/routes/admin.js#L13-L29)

### Users Management
The users manager lists all registered users, supports searching by name or email, and allows toggling Pro Pass status. The Pro Pass toggle updates user records with expiration dates and reflects status changes in the UI.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant UI as "UsersManager.jsx"
participant API as "api.js"
participant Route as "admin.js"
participant DB as "localDB.js"
Admin->>UI : Click "Grant Pro" or "Revoke Pro"
UI->>API : PUT /api/admin/users/ : id/pro-pass
API->>Route : PUT /api/admin/users/ : id/pro-pass
Route->>DB : updateById(users)
DB-->>Route : updated user
Route-->>API : {success : true, data : user}
API-->>UI : Update UI with new status
```

**Diagram sources**
- [UsersManager.jsx](file://Frontend/src/pages/admin/UsersManager.jsx#L30-L58)
- [admin.js](file://Backend/src/routes/admin.js#L225-L240)
- [localDB.js](file://Backend/src/db/localDB.js#L170-L185)

**Section sources**
- [UsersManager.jsx](file://Frontend/src/pages/admin/UsersManager.jsx#L30-L58)
- [admin.js](file://Backend/src/routes/admin.js#L213-L240)

### Questions Management
The questions manager supports creating, editing, deleting, and bulk uploading questions. It validates form data, handles CSV uploads, and maintains relationships with test series.

```mermaid
flowchart TD
Start(["Open Questions Manager"]) --> LoadTests["Load Tests List"]
LoadTests --> LoadQuestions["Load Questions List"]
LoadQuestions --> CreateEdit{"Create/Edit?"}
CreateEdit --> |Create| ShowForm["Show Question Form"]
CreateEdit --> |Edit| ShowForm
ShowForm --> Submit["Submit Form"]
Submit --> Save["POST/PUT to /api/admin/questions"]
Save --> Refresh["Refresh Questions List"]
Refresh --> BulkUpload{"Bulk Upload?"}
BulkUpload --> |CSV| Upload["Upload CSV to /api/admin/questions/bulk"]
Upload --> Success["Show Success Message"]
Success --> End(["Done"])
```

**Diagram sources**
- [QuestionsManager.jsx](file://Frontend/src/pages/admin/QuestionsManager.jsx#L27-L57)
- [QuestionsManager.jsx](file://Frontend/src/pages/admin/QuestionsManager.jsx#L59-L95)
- [QuestionsManager.jsx](file://Frontend/src/pages/admin/QuestionsManager.jsx#L127-L159)
- [admin.js](file://Backend/src/routes/admin.js#L118-L168)

**Section sources**
- [QuestionsManager.jsx](file://Frontend/src/pages/admin/QuestionsManager.jsx#L1-L421)
- [admin.js](file://Backend/src/routes/admin.js#L118-L168)

### Test Series Management
The test series manager handles creation, editing, and deletion of test series. It manages categories, pricing, difficulty, and activation status, and auto-generates slugs from titles.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant UI as "TestSeriesManager.jsx"
participant API as "api.js"
participant Route as "admin.js"
participant DB as "localDB.js"
Admin->>UI : Open "Add New Series"
UI->>API : POST /api/admin/test-series
API->>Route : POST /api/admin/test-series
Route->>DB : insertOne(testSeries)
DB-->>Route : new series
Route-->>API : {success : true, data : series}
API-->>UI : Update table
```

**Diagram sources**
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx#L44-L79)
- [admin.js](file://Backend/src/routes/admin.js#L41-L48)
- [localDB.js](file://Backend/src/db/localDB.js#L119-L133)

**Section sources**
- [TestSeriesManager.jsx](file://Frontend/src/pages/admin/TestSeriesManager.jsx#L1-L424)
- [admin.js](file://Backend/src/routes/admin.js#L31-L72)

### Study Materials Management
The study materials manager supports CRUD operations with soft delete, enable/disable toggles, reordering, and trash restoration. It maintains display order and resource counts.

```mermaid
flowchart TD
Start(["Open Study Materials"]) --> ViewMode{"View Mode"}
ViewMode --> |Active| ShowActive["Show Active Materials"]
ViewMode --> |Trash| ShowTrash["Show Deleted Materials"]
ShowActive --> Actions["Edit | Disable | Move to Trash | Reorder"]
ShowTrash --> Restore["Restore | Permanent Delete"]
Actions --> SoftDelete["Soft Delete (move to trash)"]
SoftDelete --> UIUpdate["Optimistically update UI"]
UIUpdate --> Backend["Call DELETE /api/admin/study-materials/:id"]
Backend --> Success["Success"]
Success --> Refresh["Refresh list"]
Restore --> BackendRestore["Call PUT /api/admin/study-materials/:id/restore"]
BackendRestore --> Refresh
```

**Diagram sources**
- [StudyMaterialsManager.jsx](file://Frontend/src/pages/admin/StudyMaterialsManager.jsx#L111-L147)
- [StudyMaterialsManager.jsx](file://Frontend/src/pages/admin/StudyMaterialsManager.jsx#L149-L172)
- [StudyMaterialsManager.jsx](file://Frontend/src/pages/admin/StudyMaterialsManager.jsx#L174-L205)
- [admin.js](file://Backend/src/routes/admin.js#L201-L211)

**Section sources**
- [StudyMaterialsManager.jsx](file://Frontend/src/pages/admin/StudyMaterialsManager.jsx#L1-L539)
- [admin.js](file://Backend/src/routes/admin.js#L170-L211)

### Categories Management
The categories manager implements a hierarchical category system with nested tree rendering. It supports adding root categories and child categories, expanding/collapsing nodes, and managing category metadata.

```mermaid
flowchart TD
Start(["Open Categories"]) --> Load["Load Categories from /api/admin/test-categories"]
Load --> BuildTree["Build Tree Structure"]
BuildTree --> RenderTree["Render Category Tree"]
RenderTree --> Actions["Add Child | Edit | Delete"]
Actions --> RecursiveDelete["Recursive Delete (children + parent)"]
RecursiveDelete --> Success["Category and children deleted"]
```

**Diagram sources**
- [CategoriesManager.jsx](file://Frontend/src/pages/admin/CategoriesManager.jsx#L24-L39)
- [CategoriesManager.jsx](file://Frontend/src/pages/admin/CategoriesManager.jsx#L90-L109)
- [admin.js](file://Backend/src/routes/admin.js#L341-L364)

**Section sources**
- [CategoriesManager.jsx](file://Frontend/src/pages/admin/CategoriesManager.jsx#L1-L432)
- [admin.js](file://Backend/src/routes/admin.js#L301-L364)

### Media Library
The media library provides a drag-and-drop upload interface for videos, PDFs, and images. It tracks upload progress and saves file metadata to the media collection.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant UI as "MediaLibrary.jsx"
participant API as "api.js"
participant Route as "admin.js"
participant DB as "localDB.js"
Admin->>UI : Select File
UI->>API : POST /api/admin/upload
API->>Route : POST /api/admin/upload
Route->>DB : insertOne(media)
DB-->>Route : media record
Route-->>API : {success : true, data : media}
API-->>UI : Show success, reset input
```

**Diagram sources**
- [MediaLibrary.jsx](file://Frontend/src/pages/admin/MediaLibrary.jsx#L9-L49)
- [admin.js](file://Backend/src/routes/admin.js#L243-L272)
- [localDB.js](file://Backend/src/db/localDB.js#L119-L133)

**Section sources**
- [MediaLibrary.jsx](file://Frontend/src/pages/admin/MediaLibrary.jsx#L1-L154)
- [admin.js](file://Backend/src/routes/admin.js#L242-L272)

### Tests Management
The tests manager handles individual test creation and editing, including series association, category/subcategory mapping, and activation controls.

```mermaid
flowchart TD
Start(["Open Tests Manager"]) --> LoadData["Load Series + Categories"]
LoadData --> Form{"Create/Edit?"}
Form --> |Create| ShowForm["Show Test Form"]
Form --> |Edit| ShowForm
ShowForm --> Submit["Submit Form"]
Submit --> Save["POST/PUT to /api/admin/tests"]
Save --> Refresh["Refresh Tests List"]
Refresh --> End(["Done"])
```

**Diagram sources**
- [TestsManager.jsx](file://Frontend/src/pages/admin/TestsManager.jsx#L33-L78)
- [TestsManager.jsx](file://Frontend/src/pages/admin/TestsManager.jsx#L86-L122)
- [admin.js](file://Backend/src/routes/admin.js#L75-L115)

**Section sources**
- [TestsManager.jsx](file://Frontend/src/pages/admin/TestsManager.jsx#L1-L527)
- [admin.js](file://Backend/src/routes/admin.js#L74-L115)

### Admin Settings
The admin settings page allows configuration of site-wide settings including contact information and social media links.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant UI as "AdminSettings.jsx"
participant API as "api.js"
participant Route as "admin.js"
participant DB as "localDB.js"
Admin->>UI : Open Settings
UI->>API : GET /api/admin/settings
API->>Route : GET /api/admin/settings
Route->>DB : find(appSettings)
DB-->>Route : settings
Route-->>API : {success : true, data : settings}
API-->>UI : Render form
Admin->>UI : Modify Settings
UI->>API : PUT /api/admin/settings
API->>Route : PUT /api/admin/settings
Route->>DB : upsert appSettings
DB-->>Route : updated settings
Route-->>API : {success : true, data : settings}
API-->>UI : Show success
```

**Diagram sources**
- [AdminSettings.jsx](file://Frontend/src/pages/admin/AdminSettings.jsx#L24-L66)
- [admin.js](file://Backend/src/routes/admin.js#L275-L299)
- [localDB.js](file://Backend/src/db/localDB.js#L170-L185)

**Section sources**
- [AdminSettings.jsx](file://Frontend/src/pages/admin/AdminSettings.jsx#L1-L213)
- [admin.js](file://Backend/src/routes/admin.js#L274-L299)

## Dependency Analysis
The admin system exhibits clear separation of concerns with strong backend middleware enforcement and frontend service abstraction.

```mermaid
graph TB
subgraph "Frontend Dependencies"
AXIOS["axios"]
REACT["react-router-dom"]
ICONS["lucide-react"]
API["api.js"]
end
subgraph "Backend Dependencies"
EXPRESS["express"]
JWT["jsonwebtoken"]
LOWDB["lowdb"]
FS["fs"]
end
subgraph "Security Layer"
AUTH["auth.js"]
ADMIN_ROUTE["admin.js"]
end
subgraph "Data Layer"
LOCALDB["localDB.js"]
DBJSON["db.json"]
end
API --> ADMIN_ROUTE
ADMIN_ROUTE --> AUTH
AUTH --> JWT
ADMIN_ROUTE --> LOCALDB
LOCALDB --> DBJSON
API --> AXIOS
API --> REACT
API --> ICONS
```

**Diagram sources**
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [admin.js](file://Backend/src/routes/admin.js#L1-L10)
- [auth.js](file://Backend/src/middleware/auth.js#L1-L92)
- [localDB.js](file://Backend/src/db/localDB.js#L1-L222)
- [db.json](file://Backend/data/db.json#L1-L728)

**Section sources**
- [api.js](file://Frontend/src/services/api.js#L1-L92)
- [admin.js](file://Backend/src/routes/admin.js#L1-L10)
- [auth.js](file://Backend/src/middleware/auth.js#L1-L92)

## Performance Considerations
- Database Operations: All admin operations use a single JSON file database with in-memory reads/writes. For production, consider migrating to a proper database to improve performance and concurrency.
- Token Validation: JWT verification occurs on every admin route request. Ensure JWT_SECRET is properly configured and consider implementing token refresh strategies.
- Bulk Operations: Bulk question uploads process arrays of questions. For large datasets, consider pagination or streaming approaches.
- UI Responsiveness: Many components fetch data on mount. Implement loading states and error boundaries for better user experience.
- File Uploads: Media uploads currently use memory-based FormData handling. For large files, implement chunked uploads and progress tracking improvements.

## Troubleshooting Guide
Common issues and resolutions:

- Authentication Failures: Ensure JWT token is present in localStorage and properly formatted. Check backend JWT_SECRET configuration.
- Authorization Errors: Verify user role is 'admin'. Non-admin users will receive 403 Forbidden responses.
- Database Initialization: If database errors occur, ensure db.json exists and has proper structure. The system initializes default collections automatically.
- CORS Issues: Since frontend uses localhost:5001 backend, ensure no CORS conflicts exist in development environment.
- Network Errors: The API layer handles network errors and redirects to login on 401 responses.

**Section sources**
- [auth.js](file://Backend/src/middleware/auth.js#L5-L44)
- [localDB.js](file://Backend/src/db/localDB.js#L48-L73)
- [api.js](file://Frontend/src/services/api.js#L26-L44)

## Conclusion
Trstprep V2's admin panel provides comprehensive content management capabilities with a clean separation between frontend UI components and backend API routes. The system implements robust security through JWT authentication and admin-only authorization, supports essential CRUD operations across all content types, and includes advanced features like soft deletes, bulk operations, and hierarchical categorization. The modular architecture allows for easy extension and maintenance, though migration to a production-grade database would significantly improve scalability and reliability.

*Last Updated: March 10, 2026 | Update date is (20:16)*
