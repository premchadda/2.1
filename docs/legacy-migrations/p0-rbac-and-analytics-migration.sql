-- =====================================================
-- P0 Backend Endpoints Database Migration
-- Deep Analytics & Role-Based Access Control (RBAC)
-- Created: 2026-04-23
-- =====================================================

-- =====================================================
-- 1. ROLE-BASED ACCESS CONTROL (RBAC) TABLES
-- =====================================================

-- Permissions table: Defines all available permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- Roles table: Defines user roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User-Roles junction table: Assigns roles to users
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);


-- Role-Permissions junction table: Assigns permissions to roles
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- =====================================================
-- 2. SEED DEFAULT PERMISSIONS
-- =====================================================

-- Admin Panel Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
-- User Management
('users:view', 'users', 'read', 'View user list and details'),
('users:create', 'users', 'create', 'Create new users'),
('users:edit', 'users', 'update', 'Edit user information'),
('users:delete', 'users', 'delete', 'Delete users'),
('users:export', 'users', 'export', 'Export user data'),

-- Test Series Management
('test_series:view', 'test_series', 'read', 'View test series'),
('test_series:create', 'test_series', 'create', 'Create test series'),
('test_series:edit', 'test_series', 'update', 'Edit test series'),
('test_series:delete', 'test_series', 'delete', 'Delete test series'),

-- Test Management
('tests:view', 'tests', 'read', 'View tests'),
('tests:create', 'tests', 'create', 'Create tests'),
('tests:edit', 'tests', 'update', 'Edit tests'),
('tests:delete', 'tests', 'delete', 'Delete tests'),

-- Question Management
('questions:view', 'questions', 'read', 'View questions'),
('questions:create', 'questions', 'create', 'Create questions'),
('questions:edit', 'questions', 'update', 'Edit questions'),
('questions:delete', 'questions', 'delete', 'Delete questions'),
('questions:bulk_import', 'questions', 'bulk_import', 'Bulk import questions'),

-- Study Materials Management
('study_materials:view', 'study_materials', 'read', 'View study materials'),
('study_materials:create', 'study_materials', 'create', 'Create study materials'),
('study_materials:edit', 'study_materials', 'update', 'Edit study materials'),
('study_materials:delete', 'study_materials', 'delete', 'Delete study materials'),

-- Analytics & Reports
('analytics:view', 'analytics', 'read', 'View analytics and reports'),
('analytics:deep_view', 'analytics', 'deep_read', 'View deep analytics (funnel, cohort, engagement)'),
('analytics:export', 'analytics', 'export', 'Export analytics data'),

-- Subscription Management
('subscriptions:view', 'subscriptions', 'read', 'View subscriptions'),
('subscriptions:create', 'subscriptions', 'create', 'Create subscriptions'),
('subscriptions:edit', 'subscriptions', 'update', 'Edit subscriptions'),
('subscriptions:delete', 'subscriptions', 'delete', 'Delete subscriptions'),

-- Role & Permission Management (Super Admin Only)
('roles:view', 'roles', 'read', 'View roles'),
('roles:create', 'roles', 'create', 'Create roles'),
('roles:edit', 'roles', 'update', 'Edit roles'),
('roles:delete', 'roles', 'delete', 'Delete roles'),
('roles:assign', 'roles', 'assign', 'Assign roles to users'),

-- System Settings
('settings:view', 'settings', 'read', 'View system settings'),
('settings:edit', 'settings', 'update', 'Edit system settings'),
('settings:maintenance', 'settings', 'maintenance', 'Toggle maintenance mode'),

-- Content Management
('content:manage', 'content', 'manage', 'Manage all content'),
('content:moderate', 'content', 'moderate', 'Moderate user-generated content'),

-- Audit & Compliance
('audit_logs:view', 'audit_logs', 'read', 'View audit logs'),
('audit_logs:export', 'audit_logs', 'export', 'Export audit logs')

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 3. SEED DEFAULT ROLES
-- =====================================================

INSERT INTO roles (name, description) VALUES
('super_admin', 'Full access to all features including system settings and role management'),
('admin', 'Full access to content management and user operations'),
('editor', 'Can manage content (tests, questions, materials) but not users or roles'),
('viewer', 'Read-only access to analytics and content'),
('support', 'Can view users and help with support tickets')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 4. ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- Super Admin: All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'super_admin'),
  id
FROM permissions
ON CONFLICT DO NOTHING;

-- Admin: Most permissions except super admin features
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  id
FROM permissions
WHERE name NOT LIKE 'roles:%'
  AND name NOT IN ('settings:maintenance')
ON CONFLICT DO NOTHING;

-- Editor: Content management only
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'editor'),
  id
FROM permissions
WHERE resource IN ('test_series', 'tests', 'questions', 'study_materials', 'content')
ON CONFLICT DO NOTHING;

-- Viewer: Read-only access
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'viewer'),
  id
FROM permissions
WHERE action IN ('read', 'view', 'export')
ON CONFLICT DO NOTHING;

-- Support: User view and analytics
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'support'),
  id
FROM permissions
WHERE resource IN ('users', 'analytics', 'subscriptions')
  AND action IN ('read', 'view')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- Indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Index for permissions lookup
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);

-- Index for roles lookup
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- =====================================================
-- 6. UTILITY FUNCTIONS
-- =====================================================

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION check_user_permission(p_user_id INTEGER, p_permission_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
    AND p.name = p_permission_name
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to get all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id INTEGER)
RETURNS TABLE (
  permission_name VARCHAR,
  resource VARCHAR,
  action VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name, p.resource, p.action
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = p_user_id
  ORDER BY p.resource, p.action;
END;
$$ LANGUAGE plpgsql;

-- Function to get all users with a specific role
CREATE OR REPLACE FUNCTION get_users_by_role(p_role_name VARCHAR)
RETURNS TABLE (
  user_id INTEGER,
  user_name VARCHAR,
  user_email VARCHAR,
  assigned_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.email,
    ur.created_at
  FROM user_roles ur
  JOIN users u ON ur.user_id = u.id
  JOIN roles r ON ur.role_id = r.id
  WHERE r.name = p_role_name
  ORDER BY ur.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. VERIFICATION QUERIES
-- =====================================================

-- Verify tables created
SELECT 
  'permissions' as table_name, 
  COUNT(*) as total_records 
FROM permissions
UNION ALL
SELECT 
  'roles' as table_name, 
  COUNT(*) as total_records 
FROM roles
UNION ALL
SELECT 
  'user_roles' as table_name, 
  COUNT(*) as total_records 
FROM user_roles
UNION ALL
SELECT 
  'role_permissions' as table_name, 
  COUNT(*) as total_records 
FROM role_permissions;

-- Verify permissions by resource
SELECT 
  resource,
  COUNT(*) as permission_count,
  array_agg(name ORDER BY action) as permissions
FROM permissions
GROUP BY resource
ORDER BY resource;

-- Verify role permissions
SELECT 
  r.name as role_name,
  COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.name
ORDER BY r.name;

-- =====================================================
-- 8. AUDIT LOGS TABLE (for AuditTrailManager)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =====================================================
-- 9. EMAIL TEMPLATES TABLE (for EmailTemplatesManager)
-- =====================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);

-- Seed default email templates
INSERT INTO email_templates (name, type, subject, body, variables) VALUES
('welcome_email', 'welcome', 'Welcome to Trstprep!', '<html><body><h1>Welcome {{user_name}}!</h1><p>Thank you for joining Trstprep.</p><a href="{{login_url}}">Get Started</a></body></html>', '["user_name", "login_url"]'),
('password_reset', 'auth', 'Reset Your Password', '<html><body><h1>Password Reset</h1><p>Hi {{user_name}},</p><p>Click below to reset your password:</p><a href="{{reset_url}}">Reset Password</a></body></html>', '["user_name", "reset_url"]'),
('test_notification', 'notification', 'New Test Available', '<html><body><h1>New Test: {{test_name}}</h1><p>Hi {{user_name}},</p><p>A new test is available. <a href="{{test_url}}">Start Now</a></p></body></html>', '["user_name", "test_name", "test_url"]')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 10. NAVIGATION CONFIG TABLE (for NavigationManager)
-- =====================================================

CREATE TABLE IF NOT EXISTS navigation_config (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  route VARCHAR(100),
  "order" INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(50) DEFAULT 'main',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_navigation_config_order ON navigation_config("order");
CREATE INDEX IF NOT EXISTS idx_navigation_config_category ON navigation_config(category);

-- Seed default navigation items
INSERT INTO navigation_config (id, label, icon, route, "order", category, enabled) VALUES
('dashboard', 'Dashboard', 'LayoutDashboard', '/admin/dashboard', 1, 'main', true),
('test_series', 'Test Series', 'Layers', '/admin/test-series', 2, 'main', true),
('tests', 'Tests', 'CheckSquare', '/admin/tests', 3, 'main', true),
('sections', 'Sections', 'Grid', '/admin/sections', 4, 'main', true),
('questions', 'Questions', 'HelpCircle', '/admin/questions', 5, 'main', true),
('categories', 'Categories', 'Tags', '/admin/categories', 6, 'main', true),
('stages', 'Stages', 'GraduationCap', '/admin/stages', 7, 'main', true),
('users', 'Users', 'Users', '/admin/users', 8, 'main', true),
('results', 'Results', 'BarChart', '/admin/results', 9, 'main', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 11. COMING SOON FEATURES TABLE (for ComingSoonManager)
-- =====================================================

CREATE TABLE IF NOT EXISTS coming_soon_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  eta DATE,
  category VARCHAR(50),
  status VARCHAR(20) DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coming_soon_status ON coming_soon_features(status);
CREATE INDEX IF NOT EXISTS idx_coming_soon_category ON coming_soon_features(category);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE permissions IS 'Defines all available permissions in the system';

COMMENT ON TABLE roles IS 'Defines user roles for RBAC';
COMMENT ON TABLE user_roles IS 'Junction table assigning roles to users';
COMMENT ON TABLE role_permissions IS 'Junction table assigning permissions to roles';

-- =====================================================
-- NEXT STEPS
-- =====================================================
-- 1. Run this migration: psql -d your_database -f rbac-migration.sql
-- 2. Verify tables: \dt permissions roles user_roles role_permissions
-- 3. Check permissions: SELECT * FROM permissions ORDER BY resource, action;
-- 4. Check roles: SELECT * FROM roles;
-- 5. Test functions: SELECT check_user_permission('user-uuid', 'users:view');
-- =====================================================
