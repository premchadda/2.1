-- Migration 002: Extend audit_logs table with columns required by audit middleware
-- Date: 2026-04-23
-- Run once in Supabase SQL Editor or via migration runner

-- Add resource column (maps to middleware's 'resource' field)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource VARCHAR(100);

-- Add resource_id column (VARCHAR, replaces any prior INTEGER version)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'resource_id'
  ) THEN
    -- Change type to VARCHAR if it exists as another type
    ALTER TABLE audit_logs ALTER COLUMN resource_id TYPE VARCHAR(255) USING resource_id::VARCHAR(255);
  ELSE
    ALTER TABLE audit_logs ADD COLUMN resource_id VARCHAR(255);
  END IF;
END $$;

-- Add description column (used in full-text search in the route)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;

-- Add status column (success / failure)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'success';

-- Add HTTP request metadata columns
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_method VARCHAR(10);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_path TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS response_status_code INTEGER;

-- Add admin identity columns (mirrors user_id but carries email/name at write-time)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_name VARCHAR(255);

-- Add details JSONB (arbitrary metadata bag)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;

-- Make entity_type nullable so HTTP-level middleware entries don't require it
ALTER TABLE audit_logs ALTER COLUMN entity_type DROP NOT NULL;

-- Add entity_id / old_values / new_values referenced by logAuditEvent() INSERT
-- These are required for diff-aware audit entries (update/delete operations)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id  VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;

-- Add indexes for new searchable columns
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource  ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status    ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
