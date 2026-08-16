-- =====================================================
-- Migration 092: Fix audit_logs missing columns
-- Purpose: Migration 019 dropped and recreated audit_logs with a minimal
--          schema, losing columns added by migrations 001/002/024 that the
--          audit middleware (audit.middleware.js → logAuditEvent) requires.
--          All 024's columns are re-added idempotently.
-- Created: 2026-07-16
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- =====================================================

BEGIN;

-- Columns expected by audit.middleware.js → logAuditEvent()
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'success';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_method VARCHAR(10);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_path TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS response_status_code INTEGER;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_name VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

COMMIT;
