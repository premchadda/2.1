-- Migration 105: Performance indexes for slow admin endpoints and moderation queries

-- 1. Index on doubts table for status, is_active, created_at filtering
CREATE INDEX IF NOT EXISTS idx_doubts_status_active_created 
  ON doubts(status, is_active, created_at DESC NULLS LAST);

-- 2. Index on doubts table for user_id lookup
CREATE INDEX IF NOT EXISTS idx_doubts_user_id 
  ON doubts(user_id);

-- 3. Index on users table for role, is_active, created_at
CREATE INDEX IF NOT EXISTS idx_users_role_created 
  ON users(role, created_at DESC);

-- 4. Index on payments table for status, created_at
CREATE INDEX IF NOT EXISTS idx_payments_status_created 
  ON payments(status, created_at DESC);

-- 5. Index on audit_logs table for action filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created 
  ON audit_logs(action, created_at DESC NULLS LAST);

-- 6. Index on attempts table for submitted_at and is_completed
CREATE INDEX IF NOT EXISTS idx_attempts_submitted_completed 
  ON attempts(submitted_at DESC NULLS LAST, is_completed);
