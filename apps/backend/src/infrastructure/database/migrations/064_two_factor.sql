-- 063_two_factor.sql
-- Two-factor authentication (TOTP) storage for admin users.
CREATE TABLE IF NOT EXISTS two_factor_secrets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_secrets_enabled ON two_factor_secrets(enabled);