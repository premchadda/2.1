-- Migration 099: Add Row Level Security policies
-- Phase 7: RLS was enabled on all tables but only 1 policy exists (service role).
-- This migration adds per-user policies for the most sensitive tables.

-- Helper procedure to safely create policy if it does not exist
CREATE OR REPLACE FUNCTION create_policy_if_not_exists(
  p_policy_name text,
  p_table_name text,
  p_cmd text,
  p_using text DEFAULT NULL,
  p_check text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_sql text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table_name AND policyname = p_policy_name
  ) THEN
    v_sql := format('CREATE POLICY %I ON %I FOR %s', p_policy_name, p_table_name, p_cmd);
    IF p_using IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', p_using);
    END IF;
    IF p_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', p_check);
    END IF;
    EXECUTE v_sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Attempts: users can only see their own attempts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attempts') THEN
    EXECUTE 'ALTER TABLE attempts ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('user_attempts_select', 'attempts', 'SELECT', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('user_attempts_insert', 'attempts', 'INSERT', NULL, 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('user_attempts_update', 'attempts', 'UPDATE', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- Bookmarks: users can only see/modify their own bookmarks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookmarks') THEN
    EXECUTE 'ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('user_bookmarks_select', 'bookmarks', 'SELECT', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('user_bookmarks_insert', 'bookmarks', 'INSERT', NULL, 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('user_bookmarks_delete', 'bookmarks', 'DELETE', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- Notifications: users can only see their own notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('user_notifications_select', 'notifications', 'SELECT', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('user_notifications_update', 'notifications', 'UPDATE', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- Subscriptions: users can only see their own subscriptions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    EXECUTE 'ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('user_subscriptions_select', 'subscriptions', 'SELECT', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- Transactions: users can only see their own transactions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
    EXECUTE 'ALTER TABLE transactions ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('user_transactions_select', 'transactions', 'SELECT', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- User sessions: users can only see their own sessions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions') THEN
    EXECUTE 'ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('user_sessions_select', 'user_sessions', 'SELECT', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('user_sessions_delete', 'user_sessions', 'DELETE', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- Doubts: users can see all active doubts but only modify their own
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'doubts') THEN
    EXECUTE 'ALTER TABLE doubts ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('doubts_select', 'doubts', 'SELECT', 'is_active = true OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('doubts_insert', 'doubts', 'INSERT', NULL, 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('doubts_update', 'doubts', 'UPDATE', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- Study streaks: users can only see/modify their own streak
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'study_streaks') THEN
    EXECUTE 'ALTER TABLE study_streaks ENABLE ROW LEVEL SECURITY';
    PERFORM create_policy_if_not_exists('user_streaks_select', 'study_streaks', 'SELECT', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
    PERFORM create_policy_if_not_exists('user_streaks_update', 'study_streaks', 'UPDATE', 'user_id::text = (auth.uid())::text OR current_setting(''role'') = ''service_role''');
  END IF;
END $$;

-- Clean up temporary helper function
DROP FUNCTION IF EXISTS create_policy_if_not_exists(text, text, text, text, text);
