-- Migration: Create tables for admin panel features
-- Date: 2026-04-23

-- 1. ROLES & PERMISSIONS TABLES
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO permissions (name, resource, action, description) VALUES
('users:view', 'users', 'read', 'View users'),
('users:create', 'users', 'create', 'Create users'),
('users:edit', 'users', 'update', 'Edit users'),
('users:delete', 'users', 'delete', 'Delete users'),
('tests:view', 'tests', 'read', 'View tests'),
('tests:create', 'tests', 'create', 'Create tests'),
('tests:edit', 'tests', 'update', 'Edit tests'),
('tests:delete', 'tests', 'delete', 'Delete tests'),
('content:view', 'content', 'read', 'View content'),
('content:create', 'content', 'create', 'Create content'),
('content:edit', 'content', 'update', 'Edit content'),
('content:delete', 'content', 'delete', 'Delete content')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description) VALUES
('admin', 'Full access to all features'),
('editor', 'Can manage content and tests'),
('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- 2. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 3. EMAIL TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. NAVIGATION CONFIG TABLE
CREATE TABLE IF NOT EXISTS navigation_config (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  route VARCHAR(100),
  "order" INTEGER NOT NULL,
  category VARCHAR(50),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. COMING SOON FEATURES TABLE
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

-- 6. AI API USAGE TABLE
CREATE TABLE IF NOT EXISTS ai_api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  endpoint VARCHAR(100) NOT NULL,
  model VARCHAR(50),
  tokens_used INTEGER,
  cost_estimate DECIMAL(10,4),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_api_usage(created_at DESC);


