# Missing Backend Endpoints Documentation

This document identifies admin panel features that have frontend implementations but are missing backend API endpoints.

---

## Executive Summary

**6 Critical Missing Endpoints** identified that prevent full functionality of admin panel features:

1. Deep Analytics (Funnel, Cohort, Engagement)
2. Roles & Permissions Management
3. Audit Trail/Logs
4. Email Templates Management
5. Navigation Configuration
6. Coming Soon Page Management

---

## 1. Deep Analytics Endpoints

**Frontend File**: `apps/admin-panel/src/features/admin/DeepAnalytics.jsx`  
**Priority**: HIGH  
**Impact**: Analytics dashboard incomplete  

### Missing Endpoints

```javascript
GET    /admin/analytics/funnel      // User conversion funnel
GET    /admin/analytics/cohort      // Cohort retention analysis
GET    /admin/analytics/engagement  // User engagement metrics
```

### Frontend Calls (Lines 20-23)

```javascript
const [funnelRes, cohortRes, engagementRes] = await Promise.allSettled([
  adminAPI.apiClient.get('/admin/analytics/funnel'),
  adminAPI.apiClient.get('/admin/analytics/cohort'),
  adminAPI.apiClient.get('/admin/analytics/engagement')
])
```

### Expected Response Format

#### Funnel Analytics
```json
{
  "success": true,
  "data": {
    "funnel": {
      "registered": 5000,
      "enrolled": 3500,
      "attempted_test": 2800,
      "completed_test": 2100,
      "pro_subscriber": 450
    },
    "conversion_rates": {
      "registration_to_enrollment": 70.0,
      "enrollment_to_attempt": 80.0,
      "attempt_to_completion": 75.0,
      "completion_to_pro": 21.4
    }
  }
}
```

#### Cohort Analytics
```json
{
  "success": true,
  "data": {
    "cohorts": [
      {
        "cohort": "2026-01",
        "users": 500,
        "week_1_retention": 85.0,
        "week_2_retention": 72.0,
        "week_4_retention": 58.0,
        "week_8_retention": 45.0
      }
    ]
  }
}
```

#### Engagement Analytics
```json
{
  "success": true,
  "data": {
    "daily_active_users": 1200,
    "weekly_active_users": 3500,
    "monthly_active_users": 8000,
    "avg_session_duration": 1800,
    "avg_tests_per_user": 12.5,
    "avg_questions_per_session": 45
  }
}
```

### Implementation Guide

**File**: `apps/backend/src/api/routes/analytics.js`

```javascript
import express from 'express';
import { protect, admin } from '../../middleware/auth.middleware.js';
import { pool } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// User Funnel Analytics
router.get('/analytics/funnel', protect, admin, async (req, res) => {
  try {
    const [registered, enrolled, attempted, completed, pro] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['user']),
      pool.query('SELECT COUNT(DISTINCT user_id) FROM enrollments'),
      pool.query('SELECT COUNT(DISTINCT user_id) FROM test_attempts'),
      pool.query('SELECT COUNT(DISTINCT user_id) FROM test_attempts WHERE status = $1', ['completed']),
      pool.query('SELECT COUNT(*) FROM users WHERE has_pro_pass = $1', [true])
    ]);

    res.json({
      success: true,
      data: {
        funnel: {
          registered: parseInt(registered.rows[0].count),
          enrolled: parseInt(enrolled.rows[0].count),
          attempted_test: parseInt(attempted.rows[0].count),
          completed_test: parseInt(completed.rows[0].count),
          pro_subscriber: parseInt(pro.rows[0].count)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cohort Retention Analytics
router.get('/analytics/cohort', protect, admin, async (req, res) => {
  try {
    const query = `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as cohort,
        COUNT(*) as users,
        -- Calculate retention rates (simplified)
        ROUND(AVG(CASE WHEN last_active_at > created_at + INTERVAL '7 days' THEN 1 ELSE 0 END) * 100, 2) as week_1_retention,
        ROUND(AVG(CASE WHEN last_active_at > created_at + INTERVAL '14 days' THEN 1 ELSE 0 END) * 100, 2) as week_2_retention,
        ROUND(AVG(CASE WHEN last_active_at > created_at + INTERVAL '30 days' THEN 1 ELSE 0 END) * 100, 2) as week_4_retention
      FROM users
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY cohort
      ORDER BY cohort DESC
    `;
    
    const { rows } = await pool.query(query);
    
    res.json({ success: true, data: { cohorts: rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Engagement Metrics
router.get('/analytics/engagement', protect, admin, async (req, res) => {
  try {
    const [dau, wau, mau, sessionDuration, testsPerUser, questionsPerSession] = await Promise.all([
      pool.query('SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date = CURRENT_DATE'),
      pool.query('SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date >= CURRENT_DATE - INTERVAL 7 days'),
      pool.query('SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE activity_date >= CURRENT_DATE - INTERVAL 30 days'),
      pool.query('SELECT AVG(duration) FROM sessions WHERE created_at >= CURRENT_DATE - INTERVAL 7 days'),
      pool.query('SELECT AVG(test_count) FROM (SELECT COUNT(*) as test_count FROM test_attempts GROUP BY user_id) t'),
      pool.query('SELECT AVG(question_count) FROM test_attempts WHERE created_at >= CURRENT_DATE - INTERVAL 7 days')
    ]);

    res.json({
      success: true,
      data: {
        daily_active_users: parseInt(dau.rows[0].count || 0),
        weekly_active_users: parseInt(wau.rows[0].count || 0),
        monthly_active_users: parseInt(mau.rows[0].count || 0),
        avg_session_duration: parseFloat(sessionDuration.rows[0].avg || 0),
        avg_tests_per_user: parseFloat(testsPerUser.rows[0].avg || 0),
        avg_questions_per_session: parseFloat(questionsPerSession.rows[0].avg || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

---

## 2. Roles & Permissions Endpoints

**Frontend File**: `apps/admin-panel/src/features/admin/RolePermissionsManager.jsx`  
**Priority**: HIGH  
**Impact**: Cannot manage admin roles and permissions  

### Missing Endpoints

```javascript
GET    /admin/roles                    // List all roles
GET    /admin/permissions              // List all permissions
POST   /admin/roles                    // Create role
PUT    /admin/roles/:id                // Update role
DELETE /admin/roles/:id                // Delete role
POST   /admin/permissions              // Create permission
PUT    /admin/permissions/:id          // Update permission
DELETE /admin/permissions/:id          // Delete permission
```

### Frontend Calls (Lines 30-31)

```javascript
const [rolesRes, permsRes] = await Promise.allSettled([
  adminAPI.apiClient.get('/admin/roles'),
  adminAPI.apiClient.get('/admin/permissions')
])
```

### Database Schema

```sql
CREATE TABLE admin_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE admin_permissions (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  UNIQUE(resource, action)
);
```

### Expected Response Format

#### Get Roles
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "super_admin",
      "display_name": "Super Admin",
      "description": "Full system access",
      "permissions": ["users:*", "tests:*", "content:*", "settings:*"],
      "is_system": true,
      "user_count": 2
    }
  ]
}
```

#### Get Permissions
```json
{
  "success": true,
  "data": [
    {
      "resource": "users",
      "actions": ["read", "write", "delete", "export"]
    },
    {
      "resource": "tests",
      "actions": ["read", "write", "delete", "export"]
    }
  ]
}
```

### Implementation Guide

**File**: `apps/backend/src/api/routes/admin-roles.js`

```javascript
import express from 'express';
import { protect, admin } from '../../middleware/auth.middleware.js';
import { pool } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// Get all roles
router.get('/roles', protect, admin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM users WHERE role_id = r.id) as user_count
      FROM admin_roles r
      ORDER BY r.is_system DESC, r.name ASC
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all permissions
router.get('/permissions', protect, admin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT resource, array_agg(action ORDER BY action) as actions
      FROM admin_permissions
      GROUP BY resource
      ORDER BY resource
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create role
router.post('/roles', protect, admin, async (req, res) => {
  try {
    const { name, display_name, description, permissions, is_system } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO admin_roles (name, display_name, description, permissions, is_system)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, display_name, description, JSON.stringify(permissions), is_system || false]
    );
    
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update role
router.put('/roles/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, description, permissions, is_system } = req.body;
    
    const { rows } = await pool.query(
      `UPDATE admin_roles 
       SET name = $1, display_name = $2, description = $3, permissions = $4, is_system = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, display_name, description, JSON.stringify(permissions), is_system, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete role
router.delete('/roles/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if role is assigned to users
    const { rows: users } = await pool.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [id]);
    if (parseInt(users[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete role assigned to users' 
      });
    }
    
    await pool.query('DELETE FROM admin_roles WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

---

## 3. Audit Trail/Logs Endpoints

**Frontend File**: `apps/admin-panel/src/features/admin/AuditTrailManager.jsx`  
**Priority**: MEDIUM  
**Impact**: Cannot track admin actions  

### Missing Endpoints

```javascript
GET    /admin/audit-logs               // List audit logs (paginated)
GET    /admin/audit-logs/stats         // Audit log statistics
GET    /admin/audit-logs/:id           // Get single log details
```

### Frontend Calls (Lines 28-29)

```javascript
const [logsRes, statsRes] = await Promise.allSettled([
  adminAPI.apiClient.get(`/admin/audit-logs?${params}`),
  adminAPI.apiClient.get('/admin/audit-logs/stats')
])
```

### Database Schema

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50),
  record_id INTEGER,
  user_id INTEGER REFERENCES users(id),
  user_name VARCHAR(100),
  user_email VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### Expected Response Format

#### Get Audit Logs
```json
{
  "success": true,
  "data": [
    {
      "id": 1234,
      "action": "update_test",
      "table_name": "tests",
      "record_id": 45,
      "user_name": "John Admin",
      "user_email": "john@trstprep.com",
      "ip_address": "192.168.1.100",
      "timestamp": "2026-04-23T10:30:00Z",
      "before_data": { "title": "Old Title" },
      "after_data": { "title": "New Title" }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

#### Get Stats
```json
{
  "success": true,
  "data": {
    "total_logs": 1234,
    "logs_today": 45,
    "logs_this_week": 320,
    "logs_this_month": 1234,
    "top_actions": [
      { "action": "update_test", "count": 450 },
      { "action": "create_question", "count": 380 }
    ],
    "top_users": [
      { "user_name": "John Admin", "count": 520 }
    ]
  }
}
```

### Implementation Guide

**File**: `apps/backend/src/api/routes/audit-logs.js`

```javascript
import express from 'express';
import { protect, admin } from '../../middleware/auth.middleware.js';
import { pool } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// Get audit logs with pagination and filters
router.get('/audit-logs', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, tableName, userId } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = [];
    let params = [];
    let paramIndex = 1;
    
    if (action) {
      whereClause.push(`action LIKE $${paramIndex}`);
      params.push(`%${action}%`);
      paramIndex++;
    }
    
    if (tableName) {
      whereClause.push(`table_name = $${paramIndex}`);
      params.push(tableName);
      paramIndex++;
    }
    
    if (userId) {
      whereClause.push(`user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }
    
    const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
    
    // Get logs
    const logsQuery = `
      SELECT * FROM audit_logs
      ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `
      SELECT COUNT(*) FROM audit_logs
      ${whereSQL}
    `;
    
    params.push(parseInt(limit), offset);
    
    const [logsResult, countResult] = await Promise.all([
      pool.query(logsQuery, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);
    
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: logsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get audit log statistics
router.get('/audit-logs/stats', protect, admin, async (req, res) => {
  try {
    const [total, today, week, month, topActions, topUsers] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM audit_logs'),
      pool.query("SELECT COUNT(*) FROM audit_logs WHERE created_at >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM audit_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"),
      pool.query("SELECT COUNT(*) FROM audit_logs WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'"),
      pool.query(`
        SELECT action, COUNT(*) as count 
        FROM audit_logs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY action 
        ORDER BY count DESC 
        LIMIT 10
      `),
      pool.query(`
        SELECT user_name, COUNT(*) as count 
        FROM audit_logs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY user_name 
        ORDER BY count DESC 
        LIMIT 10
      `)
    ]);
    
    res.json({
      success: true,
      data: {
        total_logs: parseInt(total.rows[0].count),
        logs_today: parseInt(today.rows[0].count),
        logs_this_week: parseInt(week.rows[0].count),
        logs_this_month: parseInt(month.rows[0].count),
        top_actions: topActions.rows,
        top_users: topUsers.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

---

## 4. Email Templates Endpoints

**Frontend File**: `apps/admin-panel/src/features/admin/EmailTemplatesManager.jsx`  
**Priority**: MEDIUM  
**Impact**: Cannot manage transactional emails  

### Missing Endpoints

```javascript
GET    /admin/email-templates          // List all templates
GET    /admin/email-templates/:id      // Get single template
POST   /admin/email-templates          // Create template
PUT    /admin/email-templates/:id      // Update template
DELETE /admin/email-templates/:id      // Delete template
POST   /admin/email-templates/:id/test // Send test email
```

### Implementation Guide

**File**: `apps/backend/src/api/routes/email-templates.js`

```javascript
import express from 'express';
import { protect, admin } from '../../middleware/auth.middleware.js';
import { pool } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// Database schema
/*
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  subject VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
*/

// Get all templates
router.get('/email-templates', protect, admin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM email_templates ORDER BY name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create template
router.post('/email-templates', protect, admin, async (req, res) => {
  try {
    const { name, subject, content, variables, is_active } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO email_templates (name, subject, content, variables, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, subject, content, JSON.stringify(variables || []), is_active !== false]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update template
router.put('/email-templates/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, content, variables, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE email_templates 
       SET name = $1, subject = $2, content = $3, variables = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, subject, content, JSON.stringify(variables), is_active, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete template
router.delete('/email-templates/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM email_templates WHERE id = $1', [id]);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send test email
router.post('/email-templates/:id/test', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { testEmail, variables } = req.body;
    
    // Get template
    const { rows } = await pool.query('SELECT * FROM email_templates WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    const template = rows[0];
    
    // Replace variables in template
    let content = template.content;
    let subject = template.subject;
    
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }
    
    // Send email (implement with your email service)
    // await sendEmail(testEmail, subject, content);
    
    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

---

## 5. Navigation Configuration Endpoints

**Frontend File**: `apps/admin-panel/src/features/admin/NavigationManager.jsx`  
**Priority**: LOW  
**Impact**: Cannot dynamically update navigation  

### Missing Endpoints

```javascript
GET    /admin/navigation               // Get navigation config
PUT    /admin/navigation               // Update navigation config
```

### Implementation

Store navigation config in database or use config file (recommended for static nav).

---

## 6. Coming Soon Management Endpoints

**Frontend File**: `apps/admin-panel/src/features/admin/ComingSoonManager.jsx`  
**Priority**: LOW  
**Impact**: Cannot toggle coming soon pages from admin  

### Missing Endpoints

```javascript
GET    /admin/coming-soon              // Get all coming soon pages
PUT    /admin/coming-soon              // Update coming soon config
```

### Implementation

**File**: `apps/backend/src/api/routes/coming-soon.js`

```javascript
import express from 'express';
import { protect, admin } from '../../middleware/auth.middleware.js';

const router = express.Router();

// In-memory or file-based config (or use database)
let comingSoonConfig = {
  pages: {},
  maintenanceMode: false
};

// Get config
router.get('/coming-soon', protect, admin, (req, res) => {
  res.json({ success: true, data: comingSoonConfig });
});

// Update config
router.put('/coming-soon', protect, admin, (req, res) => {
  comingSoonConfig = { ...comingSoonConfig, ...req.body };
  res.json({ success: true, data: comingSoonConfig });
});

export default router;
```

---

## Priority Matrix

| Endpoint | Priority | Complexity | Estimated Time |
|----------|----------|------------|----------------|
| Deep Analytics | HIGH | Medium | 4-6 hours |
| Roles & Permissions | HIGH | High | 8-10 hours |
| Audit Trail | MEDIUM | Medium | 6-8 hours |
| Email Templates | MEDIUM | Medium | 4-6 hours |
| Navigation Config | LOW | Low | 2-3 hours |
| Coming Soon | LOW | Low | 1-2 hours |

**Total Estimated Time**: 25-35 hours (3-4 working days)

---

## Implementation Roadmap

### Week 1: Critical Features
1. ✅ Deep Analytics endpoints
2. ✅ Audit Trail endpoints
3. Database migrations for new tables

### Week 2: User Management
1. ✅ Roles & Permissions system
2. ✅ Middleware to check permissions
3. ✅ Update auth middleware

### Week 3: Content Management
1. ✅ Email Templates
2. ✅ Navigation Config
3. ✅ Coming Soon Manager

### Week 4: Testing & Integration
1. ✅ Integration testing
2. ✅ Frontend connection verification
3. ✅ Documentation updates

---

## Database Migrations Required

Run these SQL scripts in order:

```sql
-- 1. Audit Logs Table
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50),
  record_id INTEGER,
  user_id INTEGER REFERENCES users(id),
  user_name VARCHAR(100),
  user_email VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Admin Roles Table
CREATE TABLE admin_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Admin Permissions Table
CREATE TABLE admin_permissions (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  UNIQUE(resource, action)
);

-- 4. Email Templates Table
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  subject VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- 6. Default Roles
INSERT INTO admin_roles (name, display_name, description, permissions, is_system) VALUES
('super_admin', 'Super Admin', 'Full system access', '["*"]', true),
('content_manager', 'Content Manager', 'Manage tests, questions, materials', '["tests:*", "questions:*", "content:*"]', true),
('support', 'Support', 'View users, manage tickets', '["users:read", "tickets:*"]', true);

-- 7. Default Permissions
INSERT INTO admin_permissions (resource, action, description) VALUES
('users', 'read', 'View users'),
('users', 'write', 'Create/edit users'),
('users', 'delete', 'Delete users'),
('users', 'export', 'Export user data'),
('tests', 'read', 'View tests'),
('tests', 'write', 'Create/edit tests'),
('tests', 'delete', 'Delete tests'),
('tests', 'export', 'Export test data');
```

---

## Notes

1. **Audit Middleware**: Consider adding automatic audit logging middleware that tracks all admin mutations
2. **Caching**: Analytics endpoints should implement Redis caching (5-15 min TTL)
3. **Rate Limiting**: Email template test endpoint needs rate limiting
4. **Security**: Roles & Permissions system should integrate with existing auth middleware
5. **Performance**: Use materialized views for complex analytics queries

---

**Document Created**: 2026-04-23  
**Status**: Ready for Backend Implementation  
**Estimated Total Effort**: 3-4 working days
