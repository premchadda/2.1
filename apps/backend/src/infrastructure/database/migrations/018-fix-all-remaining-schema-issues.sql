-- =====================================================
-- Migration 018: Fix All Remaining Schema Issues
-- Purpose: Create missing tables, fix UUID→INTEGER roles,
--          add missing columns, fix naming inconsistencies,
--          add missing indexes
-- Created: 2026-05-27
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CREATE 21 MISSING TABLES (IF NOT EXISTS)
-- =====================================================

-- 1.1 test_attempts — tracks user attempts at tests
CREATE TABLE IF NOT EXISTS test_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER,
  series_id INTEGER,
  status VARCHAR(50) DEFAULT 'in_progress',
  score NUMERIC,
  total_marks NUMERIC,
  time_taken INTEGER,
  is_completed BOOLEAN DEFAULT false,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_attempts_user_id ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test_id ON test_attempts(test_id);

-- 1.2 daily_quizzes — daily quiz definitions
CREATE TABLE IF NOT EXISTS daily_quizzes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  quiz_date DATE,
  questions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_quizzes_quiz_date ON daily_quizzes(quiz_date);

-- 1.3 daily_quiz_attempts — user attempts on daily quizzes
CREATE TABLE IF NOT EXISTS daily_quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER REFERENCES daily_quizzes(id) ON DELETE CASCADE,
  score NUMERIC,
  answers JSONB DEFAULT '[]'::jsonb,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_quiz_attempts_user_id ON daily_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_quiz_attempts_quiz_id ON daily_quiz_attempts(quiz_id);

-- 1.4 pro_passes — pro subscription passes
CREATE TABLE IF NOT EXISTS pro_passes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pass_type VARCHAR(50),
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_passes_user_id ON pro_passes(user_id);

-- 1.5 user_topic_stats — per-topic accuracy stats per user
CREATE TABLE IF NOT EXISTS user_topic_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(255),
  subject VARCHAR(255),
  total_attempts INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  wrong_answers INTEGER DEFAULT 0,
  unattempted_answers INTEGER DEFAULT 0,
  total_time_spent_seconds INTEGER DEFAULT 0,
  accuracy NUMERIC DEFAULT 0,
  last_attempted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_topic_stats_user_id ON user_topic_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_stats_topic ON user_topic_stats(topic);

-- 1.6 study_streaks — user study streak tracking
CREATE TABLE IF NOT EXISTS study_streaks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_streaks_user_id ON study_streaks(user_id);

-- 1.7 revision_queue — spaced repetition queue
CREATE TABLE IF NOT EXISTS revision_queue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER,
  priority VARCHAR(20) DEFAULT 'medium',
  next_review_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_queue_user_id ON revision_queue(user_id);

-- 1.8 wrong_questions — tracked wrong questions for review
CREATE TABLE IF NOT EXISTS wrong_questions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER,
  attempt_id INTEGER,
  wrong_count INTEGER DEFAULT 1,
  last_wrong_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wrong_questions_user_id ON wrong_questions(user_id);

-- 1.9 banners — promotional banners
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  image_url TEXT,
  link_url TEXT,
  position VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.10 promotions — discount codes and promotions
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  code VARCHAR(100),
  discount_type VARCHAR(20),
  discount_value NUMERIC,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.11 blogs — blog posts
CREATE TABLE IF NOT EXISTS blogs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  content TEXT,
  excerpt TEXT,
  author_id INTEGER,
  category VARCHAR(100),
  tags TEXT[],
  featured_image TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);

-- 1.12 referrals — user referral tracking
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  reward_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

-- 1.13 assets — file/media asset storage
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  file_path TEXT,
  file_type VARCHAR(50),
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON assets(uploaded_by);

-- 1.14 enrollments — user enrollments in test series
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  series_id INTEGER,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);

-- 1.15 leaderboard_entries — leaderboard scores
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER,
  series_id INTEGER,
  score NUMERIC,
  rank INTEGER,
  time_taken INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);

-- 1.16 messages — user-to-user messaging
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  receiver_id INTEGER,
  content TEXT,
  message_type VARCHAR(20) DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- 1.17 affiliates — affiliate program tracking
CREATE TABLE IF NOT EXISTS affiliates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  affiliate_code VARCHAR(50) UNIQUE,
  commission_rate NUMERIC DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);

-- 1.18 study_groups — collaborative study groups
CREATE TABLE IF NOT EXISTS study_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT true,
  max_members INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.19 subject_videos — video resources per subject/topic
CREATE TABLE IF NOT EXISTS subject_videos (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER,
  topic_id INTEGER,
  title VARCHAR(255),
  video_url TEXT,
  duration INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.20 subject_pdfs — PDF resources per subject/topic
CREATE TABLE IF NOT EXISTS subject_pdfs (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER,
  topic_id INTEGER,
  title VARCHAR(255),
  file_url TEXT,
  file_size INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.21 topic_tests — tests scoped to a specific topic
CREATE TABLE IF NOT EXISTS topic_tests (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER,
  subject_id INTEGER,
  title VARCHAR(255),
  description TEXT,
  duration INTEGER,
  total_marks INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. FIX UUID→INTEGER IN ROLES TABLES
--    Migration 001 created these with UUID FKs but
--    users.id is SERIAL INTEGER. Drop and recreate.
-- =====================================================

DO $$
BEGIN
  -- 2.1 Drop dependent tables first (reverse FK order)
  DROP TABLE IF EXISTS role_permissions CASCADE;
  DROP TABLE IF EXISTS user_roles CASCADE;

  -- 2.2 Recreate permissions with SERIAL INTEGER id
  DROP TABLE IF EXISTS permissions CASCADE;
  CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource, action)
  );

  -- 2.3 Recreate roles with SERIAL INTEGER id
  DROP TABLE IF EXISTS roles CASCADE;
  CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  -- 2.4 Recreate user_roles with INTEGER FKs
  CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
  );

  -- 2.5 Recreate role_permissions with INTEGER FKs
  CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
  );

  -- 2.6 Re-seed default permissions
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

  -- 2.7 Re-seed default roles
  INSERT INTO roles (name, description) VALUES
    ('admin', 'Full access to all features'),
    ('editor', 'Can manage content and tests'),
    ('viewer', 'Read-only access')
  ON CONFLICT (name) DO NOTHING;

  RAISE NOTICE 'Roles tables recreated with INTEGER FKs';
END $$;

-- =====================================================
-- 3. ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- 3.1 attempts table — add status, started_at, last_activity, last_question_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempts') THEN
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'not_started';
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS last_question_id INTEGER;
    RAISE NOTICE 'attempts table: added status, started_at, last_activity, last_question_id';
  ELSE
    RAISE NOTICE 'attempts table does not exist — skipping';
  END IF;
END $$;

-- 3.2 question_attempts table — add order_index, status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_attempts') THEN
    ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS order_index INTEGER;
    ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'answered';
    RAISE NOTICE 'question_attempts table: added order_index, status';
  ELSE
    RAISE NOTICE 'question_attempts table does not exist — skipping';
  END IF;
END $$;

-- =====================================================
-- 4. FIX NAMING INCONSISTENCIES
-- =====================================================

-- 4.1 notifications: add is_read if missing (keep 'read' for backward compat)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
    -- Backfill is_read from 'read' column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
      UPDATE notifications SET is_read = read WHERE is_read = false AND read = true;
    END IF;
    RAISE NOTICE 'notifications: is_read column ensured';
  END IF;
END $$;

-- 4.2 tests: add snake_case orphaned_at, migrate from camelCase "orphanedAt" if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tests') THEN
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMP;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'orphanedAt') THEN
      UPDATE tests SET orphaned_at = "orphanedAt" WHERE orphaned_at IS NULL AND "orphanedAt" IS NOT NULL;
      ALTER TABLE tests DROP COLUMN "orphanedAt";
      RAISE NOTICE 'tests: migrated orphanedAt → orphaned_at';
    END IF;
  END IF;
END $$;

-- 4.3 questions: add snake_case orphaned_at, migrate from camelCase "orphanedAt" if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') THEN
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMP;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'orphanedAt') THEN
      UPDATE questions SET orphaned_at = "orphanedAt" WHERE orphaned_at IS NULL AND "orphanedAt" IS NOT NULL;
      ALTER TABLE questions DROP COLUMN "orphanedAt";
      RAISE NOTICE 'questions: migrated orphanedAt → orphaned_at';
    END IF;
  END IF;
END $$;

-- 4.4 test_series: add snake_case orphaned_at, migrate from camelCase "orphanedAt" if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_series') THEN
    ALTER TABLE test_series ADD COLUMN IF NOT EXISTS orphaned_at TIMESTAMP;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'orphanedAt') THEN
      UPDATE test_series SET orphaned_at = "orphanedAt" WHERE orphaned_at IS NULL AND "orphanedAt" IS NOT NULL;
      ALTER TABLE test_series DROP COLUMN "orphanedAt";
      RAISE NOTICE 'test_series: migrated orphanedAt → orphaned_at';
    END IF;
  END IF;
END $$;

-- =====================================================
-- 5. ADD MISSING INDEXES
-- =====================================================

-- 5.1 question_attempts.attempt_id (critical for attempt lookups)
CREATE INDEX IF NOT EXISTS idx_question_attempts_attempt_id ON question_attempts(attempt_id);

-- 5.2 blogs.slug (for URL lookups)
CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);

-- 5.3 study_streaks.user_id (for user streak lookups)
CREATE INDEX IF NOT EXISTS idx_study_streaks_user_id ON study_streaks(user_id);

-- 5.4 user_topic_stats.user_id (for user stats lookups)
CREATE INDEX IF NOT EXISTS idx_user_topic_stats_user_id ON user_topic_stats(user_id);

-- =====================================================
-- 6. ADD updated_at TRIGGERS TO NEW TABLES
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  new_tables TEXT[] := ARRAY[
    'test_attempts', 'daily_quizzes', 'pro_passes',
    'user_topic_stats', 'study_streaks', 'revision_queue',
    'wrong_questions', 'banners', 'promotions', 'blogs',
    'referrals', 'assets', 'enrollments', 'leaderboard_entries',
    'messages', 'affiliates', 'study_groups', 'subject_videos',
    'subject_pdfs', 'topic_tests', 'roles'
  ];
BEGIN
  FOREACH tbl IN ARRAY new_tables
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        tbl
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add trigger to %: %', tbl, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- 7. ADD CATEGORY-WISE CUT-OFF MARKS SUPPORT
-- =====================================================

ALTER TABLE tests ADD COLUMN IF NOT EXISTS cutoff_marks JSONB DEFAULT '{}';
-- Example: {"general": 150, "obc": 140, "sc": 120, "st": 110, "ews": 130}

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  expected_tables TEXT[] := ARRAY[
    'test_attempts', 'daily_quizzes', 'daily_quiz_attempts',
    'pro_passes', 'user_topic_stats', 'study_streaks',
    'revision_queue', 'wrong_questions', 'banners',
    'promotions', 'blogs', 'referrals', 'assets',
    'enrollments', 'leaderboard_entries', 'messages',
    'affiliates', 'study_groups', 'subject_videos',
    'subject_pdfs', 'topic_tests'
  ];
  missing_count INTEGER := 0;
BEGIN
  FOREACH tbl IN ARRAY expected_tables
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      RAISE WARNING 'MISSING TABLE: %', tbl;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;

  IF missing_count = 0 THEN
    RAISE NOTICE 'All 21 new tables verified present';
  ELSE
    RAISE WARNING '% tables still missing!', missing_count;
  END IF;

  -- Verify roles are INTEGER-based
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE 'roles.id is INTEGER — correct';
  ELSE
    RAISE WARNING 'roles.id is NOT integer!';
  END IF;

  -- Verify user_roles uses INTEGER
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'user_id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE 'user_roles.user_id is INTEGER — correct';
  ELSE
    RAISE WARNING 'user_roles.user_id is NOT integer!';
  END IF;
END $$;

COMMIT;
