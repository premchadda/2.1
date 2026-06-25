# Getting Started

<cite>
**Referenced Files in This Document**
- [Backend package.json](file://Backend/package.json)
- [Backend .env.example](file://Backend/.env.example)
- [Backend src/app.js](file://Backend/src/app.js)
- [Backend src/db/localDB.js](file://Backend/src/db/localDB.js)
- [Backend data/db.json](file://Backend/data/db.json)
- [Backend src/seed/comprehensiveSeed.js](file://Backend/src/seed/comprehensiveSeed.js)
- [Backend src/seed/seedData.js](file://Backend/src/seed/seedData.js)
- [Frontend package.json](file://Frontend/package.json)
- [Frontend vite.config.js](file://Frontend/vite.config.js)
- [Frontend src/main.jsx](file://Frontend/src/main.jsx)
- [Frontend src/App.jsx](file://Frontend/src/App.jsx)
- [Frontend src/services/api.js](file://Frontend/src/services/api.js)
- [Documentation README.md](file://Documentation/README.md)
- [Documentation FINAL_SUMMARY.md](file://Documentation/FINAL_SUMMARY.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Initial Launch](#initial-launch)
7. [Development Workflow](#development-workflow)
8. [Project Structure Navigation](#project-structure-navigation)
9. [Quick Start Examples](#quick-start-examples)
10. [Testing Your Installation](#testing-your-installation)
11. [Troubleshooting](#troubleshooting)
12. [System Requirements Verification](#system-requirements-verification)
13. [Migration to MongoDB](#migration-to-mongodb)
14. [Conclusion](#conclusion)

## Introduction
Trstprep V2 is a full-stack web application designed for SSC and Railway exam preparation. It consists of a React-based frontend and an Express backend with a local JSON database. The application provides features for test series management, user authentication, study materials, and an admin panel for content management.

## Prerequisites
Before installing Trstprep V2, ensure your system meets the following requirements:

### Node.js and Package Managers
- **Node.js 18 or higher** - Required for both frontend and backend development
- **npm** or **yarn** - Package managers for dependency installation

### System Dependencies
- **MongoDB** - Required for production deployment (local or Atlas)
- **Git** - For version control and cloning the repository

### Development Tools
- **Text Editor** - VS Code recommended
- **Browser** - Latest Chrome or Firefox for testing
- **Postman** - Optional, for API testing

**Section sources**
- [Backend package.json](file://Backend/package.json#L28-L30)
- [Documentation README.md](file://Documentation/README.md#L32-L35)

## Installation

### Step 1: Clone and Navigate
```bash
# Navigate to the project root directory
cd trstprep-v2
```

### Step 2: Install Backend Dependencies
```bash
# Change to backend directory
cd Backend

# Install backend dependencies
npm install
```

### Step 3: Install Frontend Dependencies
```bash
# Change to frontend directory
cd ../Frontend

# Install frontend dependencies
npm install
```

### Step 4: Verify Installation
Both installations should complete without errors. You can verify by checking the installed packages in `package.json`.

**Section sources**
- [Backend package.json](file://Backend/package.json#L1-L32)
- [Frontend package.json](file://Frontend/package.json#L1-L35)

## Environment Configuration

### Backend Environment Setup
1. **Copy the example environment file:**
```bash
cp .env.example .env
```

2. **Configure the environment variables in `.env`:**
```env
# Server Configuration
PORT=5001
NODE_ENV=development

# MongoDB Connection (for production)
MONGODB_URI=mongodb://localhost:27017/trstprep

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### Frontend Environment Setup
1. **Configure Vite proxy in `vite.config.js`:**
```javascript
export default {
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
}
```

2. **Set API base URL in frontend:**
```env
VITE_API_URL=http://localhost:5001/api
```

**Section sources**
- [Backend .env.example](file://Backend/.env.example#L1-L17)
- [Backend src/app.js](file://Backend/src/app.js#L24-L32)
- [Frontend vite.config.js](file://Frontend/vite.config.js#L7-L14)

## Database Setup

### Understanding the Database Architecture
Trstprep V2 uses a local JSON database system with 18 collections:

```mermaid
erDiagram
USERS {
string _id PK
string name
string email UK
string password
string role
boolean isProUser
datetime proPassExpiry
datetime createdAt
datetime updatedAt
}
TEST_SERIES {
string _id PK
string slug UK
string title
string category
string subcategory
boolean isPro
number price
number totalTests
number freeTests
number rating
string difficulty
array tags
boolean isActive
datetime createdAt
datetime updatedAt
}
TESTS {
string _id PK
string slug UK
string title
string seriesId FK
string category
string subCategory
string type
boolean isPro
number duration
number totalQuestions
number totalMarks
number passingMarks
string difficulty
array tags
boolean isActive
datetime createdAt
datetime updatedAt
}
QUESTIONS {
string _id PK
string testId FK
string question
array options
number correctAnswer
string explanation
number marks
number negativeMarks
array tags
datetime createdAt
datetime updatedAt
}
USERS ||--o{ ENROLLMENTS : enrolls
TEST_SERIES ||--o{ TESTS : contains
TESTS ||--o{ QUESTIONS : contains
```

**Diagram sources**
- [Backend src/db/localDB.js](file://Backend/src/db/localDB.js#L9-L41)
- [Backend data/db.json](file://Backend/data/db.json#L1-L728)

### Database Initialization Process
The application initializes the database automatically on startup:

```mermaid
flowchart TD
Start([Application Start]) --> InitDB["Initialize Local Database"]
InitDB --> CheckData{"Database Empty?"}
CheckData --> |Yes| SeedDefault["Seed Default Data"]
CheckData --> |No| ConnectSuccess["Connect Successfully"]
SeedDefault --> CreateCollections["Create 18 Collections"]
CreateCollections --> ConnectSuccess
ConnectSuccess --> Ready([Database Ready])
Ready --> End([Application Running])
```

**Diagram sources**
- [Backend src/db/localDB.js](file://Backend/src/db/localDB.js#L45-L70)
- [Backend src/app.js](file://Backend/src/app.js#L68-L78)

### Seeding the Database
The application comes pre-populated with comprehensive test data. The database seeding process includes:

1. **User Accounts** - Admin, Pro User, and Free User
2. **Test Series** - Multiple exam preparation series
3. **Tests** - Various test types and difficulty levels
4. **Study Materials** - Subject-specific learning resources
5. **Exam Categories** - SSC and Railway exam structures

**Section sources**
- [Backend src/db/localDB.js](file://Backend/src/db/localDB.js#L9-L41)
- [Backend data/db.json](file://Backend/data/db.json#L2-L728)
- [Backend src/seed/comprehensiveSeed.js](file://Backend/src/seed/comprehensiveSeed.js#L4-L53)

## Initial Launch

### Starting the Backend Server
```bash
# Navigate to backend directory
cd Backend

# Start development server
npm run dev
```

The backend will start on port 5001 with the following console output:
```
🚀 Server running on http://localhost:5001
📝 API Health: http://localhost:5001/api/health
🗄️  Database: Local JSON (data/db.json)
```

### Starting the Frontend Server
```bash
# Navigate to frontend directory
cd ../Frontend

# Start development server
npm run dev
```

The frontend will start on port 3000:
```
VITE v5.x.x ready in xxx ms

  ➜ Local:   http://localhost:3000/
  ➜ Network: http://[your-network-ip]:3000/
```

### Verifying the Setup
1. **Backend Health Check**: Visit `http://localhost:5001/api/health`
2. **Frontend Access**: Open `http://localhost:3000` in your browser
3. **Admin Panel**: Access `http://localhost:3000/admin` for administrative features

**Section sources**
- [Backend src/app.js](file://Backend/src/app.js#L46-L54)
- [Backend src/app.js](file://Backend/src/app.js#L80-L89)
- [Frontend vite.config.js](file://Frontend/vite.config.js#L7-L8)

## Development Workflow

### Development Server Startup Sequence
```mermaid
sequenceDiagram
participant Dev as Developer
participant FE as Frontend Server
participant BE as Backend Server
participant DB as Local Database
Dev->>BE : npm run dev
BE->>DB : Initialize Database
DB-->>BE : Database Ready
BE->>BE : Start Server on Port 5001
BE-->>Dev : Server Running
Dev->>FE : npm run dev
FE->>FE : Build Application
FE->>BE : Proxy API Requests
FE-->>Dev : Frontend Ready on Port 3000
```

**Diagram sources**
- [Backend package.json](file://Backend/package.json#L7-L10)
- [Frontend package.json](file://Frontend/package.json#L6-L10)
- [Frontend vite.config.js](file://Frontend/vite.config.js#L9-L13)

### Port Configuration
- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:5001`
- **Proxy**: `/api` requests are forwarded to backend

### Hot Reload and Development Features
- **Frontend**: Automatic page reload on code changes
- **Backend**: Nodemon restarts server on file changes
- **API Proxy**: Seamless communication between frontend and backend

**Section sources**
- [Frontend vite.config.js](file://Frontend/vite.config.js#L7-L14)
- [Backend package.json](file://Backend/package.json#L9-L10)

## Project Structure Navigation

### Backend Architecture
```mermaid
graph TD
subgraph "Backend Structure"
A[src/] --> B[db/]
A --> C[middleware/]
A --> D[models/]
A --> E[routes/]
A --> F[seed/]
A --> G[app.js]
B --> H[localDB.js]
C --> I[auth.js]
C --> J[errorHandler.js]
C --> K[upload.js]
E --> L[admin.js]
E --> M[auth.js]
E --> N[series.js]
E --> O[tests.js]
E --> P[study.js]
E --> Q[users.js]
F --> R[comprehensiveSeed.js]
F --> S[seedData.js]
end
```

**Diagram sources**
- [Backend src/app.js](file://Backend/src/app.js#L14-L19)
- [Backend src/db/localDB.js](file://Backend/src/db/localDB.js#L1-L219)

### Frontend Architecture
```mermaid
graph TD
subgraph "Frontend Structure"
A[src/] --> B[components/]
A --> C[context/]
A --> D[pages/]
A --> E[services/]
A --> F[styles/]
A --> G[main.jsx]
A --> H[App.jsx]
B --> I[admin/]
B --> J[auth/]
B --> K[common/]
B --> L[layout/]
B --> M[test/]
D --> N[admin/]
D --> O[ProtectedRoute.jsx]
E --> P[api.js]
E --> Q[dataService.js]
end
```

**Diagram sources**
- [Frontend src/App.jsx](file://Frontend/src/App.jsx#L1-L41)
- [Frontend src/main.jsx](file://Frontend/src/main.jsx#L1-L17)

**Section sources**
- [Documentation README.md](file://Documentation/README.md#L5-L28)

## Quick Start Examples

### Basic Application Access
1. **Open the main application**:
   - URL: `http://localhost:3000`
   - Features: Browse test series, view study materials, access user dashboard

2. **Access the admin panel**:
   - URL: `http://localhost:3000/admin`
   - Features: Manage content, users, media, and system settings

### Demo User Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@trstprep.com |  |
| Pro User | pro@trstprep.com |  |
| Free User | user@example.com |  |

### API Testing Examples
```bash
# Test backend health
curl http://localhost:5001/api/health

# Get all test series
curl http://localhost:5001/api/series

# Login as admin
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trstprep.com","password":"password123"}'
```

**Section sources**
- [Documentation FINAL_SUMMARY.md](file://Documentation/FINAL_SUMMARY.md#L134-L146)
- [Documentation FINAL_SUMMARY.md](file://Documentation/FINAL_SUMMARY.md#L312-L317)

## Testing Your Installation

### Health Check Procedures
1. **Backend Health Check**:
   ```bash
   curl http://localhost:5001/api/health
   ```
   Expected response should indicate the database type and application status.

2. **Frontend Accessibility**:
   - Open `http://localhost:3000` in browser
   - Verify all pages load without errors
   - Check network tab for successful API connections

3. **Database Verification**:
   - Check `Backend/data/db.json` contains seeded data
   - Verify collection counts match expected values

### Functional Testing Checklist
- [ ] Backend server starts on port 5001
- [ ] Frontend server starts on port 3000
- [ ] API proxy configuration works correctly
- [ ] Database initializes successfully
- [ ] Admin credentials work properly
- [ ] All navigation links function correctly

**Section sources**
- [Backend src/app.js](file://Backend/src/app.js#L46-L54)
- [Frontend src/services/api.js](file://Frontend/src/services/api.js#L3-L10)

## Troubleshooting

### Common Installation Issues

#### Port Conflicts
**Problem**: Ports 3000 or 5001 already in use
**Solution**:
```bash
# Change frontend port in vite.config.js
export default {
  server: {
    port: 3001,  // Change to available port
    // ...
  }
}

# Or change backend port in .env
PORT=5001
```

#### Database Connection Errors
**Problem**: Database fails to initialize
**Solution**:
1. Check database file permissions
2. Verify Node.js has write access to `Backend/data/`
3. Restart the backend server

#### CORS Issues
**Problem**: Frontend cannot communicate with backend
**Solution**:
1. Verify `FRONTEND_URL` in backend `.env`
2. Check proxy configuration in `vite.config.js`
3. Ensure both servers are running

#### Environment Variable Issues
**Problem**: Application not using expected configuration
**Solution**:
1. Verify `.env` file exists in backend directory
2. Check variable names match `.env.example`
3. Restart both servers after changes

### Debugging Commands
```bash
# Check if ports are available
netstat -an | grep :3000
netstat -an | grep :5001

# View backend logs
cd Backend
npm run dev

# View frontend logs
cd Frontend
npm run dev
```

**Section sources**
- [Backend .env.example](file://Backend/.env.example#L1-L17)
- [Frontend vite.config.js](file://Frontend/vite.config.js#L7-L14)

## System Requirements Verification

### Node.js Version Check
```bash
# Verify Node.js version
node --version
# Should output 18.x or higher

# Verify npm version
npm --version
```

### Dependency Verification
```bash
# Check backend dependencies
cd Backend
npm list

# Check frontend dependencies
cd ../Frontend
npm list
```

### File Permissions
Ensure the following directories have proper write permissions:
- `Backend/data/` - For database file creation
- `Backend/uploads/` - For file uploads (if enabled)
- `Frontend/dist/` - For build output

**Section sources**
- [Backend package.json](file://Backend/package.json#L28-L30)
- [Frontend package.json](file://Frontend/package.json#L1-L35)

## Migration to MongoDB

### When to Migrate
Consider migrating to MongoDB when:
- You need production-scale database features
- Team collaboration requires shared database access
- Advanced querying capabilities are required
- Scaling to multiple environments becomes necessary

### Migration Steps
1. **Install MongoDB** locally or use MongoDB Atlas
2. **Update environment variables**:
   ```env
   MONGODB_URI=mongodb://localhost:27017/trstprep
   # or for Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trstprep
   ```

3. **Update database connection** in `Backend/src/app.js`:
   ```javascript
   // Replace local database with MongoDB connection
   // See DATABASE.md for detailed implementation
   ```

4. **Run data migration**:
   ```bash
   cd Backend
   npm run seed
   ```

5. **Update frontend API configuration** if needed

### Migration Benefits
- **Production Ready**: Handles concurrent users and scaling
- **Advanced Queries**: Rich query capabilities and indexing
- **Backup Solutions**: Built-in backup and restore features
- **Monitoring**: Comprehensive monitoring and analytics

**Section sources**
- [Documentation FINAL_SUMMARY.md](file://Documentation/FINAL_SUMMARY.md#L284-L294)
- [Backend package.json](file://Backend/package.json#L21-L23)

## Conclusion

Trstprep V2 is now ready for development and testing. You have successfully:

- Installed all prerequisites and dependencies
- Configured environment variables for both frontend and backend
- Set up the local database with comprehensive test data
- Launched both development servers successfully
- Verified the application's core functionality

### Next Steps
1. **Explore the Admin Panel**: `http://localhost:3000/admin`
2. **Test API Endpoints**: Use the provided credentials to experiment
3. **Review Documentation**: Check `Documentation/` folder for detailed guides
4. **Start Development**: Modify the frontend components or backend routes
5. **Plan Migration**: Prepare for MongoDB deployment when ready

### Support Resources
- **Documentation**: Comprehensive guides in the `Documentation/` folder
- **API Reference**: Available endpoints documented in the summary files
- **Community**: GitHub repository for issues and contributions
- **Deployment**: Ready for Vercel or traditional Node.js hosting platforms

The application provides a solid foundation for exam preparation platform development with a focus on test series management, user authentication, and content administration.

*Last Updated: March 10, 2026 | Update date is (20:16)*
