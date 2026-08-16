-- 070_missing_indexes_and_constraints.sql
-- Adds missing indexes and constraints identified in audit

-- 1. Add UNIQUE constraint on test_questions to prevent duplicate question assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_questions_test_id_question_id_key'
  ) THEN
    ALTER TABLE test_questions ADD CONSTRAINT test_questions_test_id_question_id_key UNIQUE (test_id, question_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add index on attempts.user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_attempts_user_id_lookup ON attempts(user_id);

-- 3. Add index on login_attempts.email for faster lockout checks
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);

-- 4. Add index on login_attempts.ip_address for faster lockout checks
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);

-- 5. Add updated_at triggers for tables missing them
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
  t text;
  tables_with_updated_at text[] := ARRAY[
    'referrals', 'study_groups', 'app_settings', 'coupons',
    'promotions', 'discussions', 'discussion_replies',
    'navigation_menu', 'study_group_members', 'study_group_messages',
    'content_moderation_queue', 'attempt_answers', 'subscriptions',
    'user_sessions', 'transactions', 'email_templates',
    'notification_preferences', 'practice_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_updated_at LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'updated_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_' || t || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trigger_update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        t, t
      );
    END IF;
  END LOOP;
END $$;
