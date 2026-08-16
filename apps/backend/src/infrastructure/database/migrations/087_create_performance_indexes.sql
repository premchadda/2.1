-- Migration 087: Create performance indexes for critical query paths
-- Target: users(email) and attempts(user_id)

BEGIN;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);

COMMIT;
