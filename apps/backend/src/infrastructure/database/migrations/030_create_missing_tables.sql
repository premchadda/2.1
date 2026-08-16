-- =====================================================
-- Migration 030: Create Missing Tables & _orphaned Column
-- Purpose: Create the 6 tables referenced by code but
--          never defined in any committed migration,
--          plus add the _orphaned column on tests,
--          questions, and test_series for H1.
--
--          Resolves audit issues:
--            B5  - current_affairs, community_comments,
--                  question_tag_map, attempt_section_scores,
--                  leaderboard_snapshots, email_templates
--            H1  - _orphaned column queried in 15+ places
--
-- Idempotent: CREATE TABLE IF NOT EXISTS for all tables;
--             ADD COLUMN IF NOT EXISTS for _orphaned.
-- Depends on: All prior migrations (001-029) and
--             000_baseline_functions.sql for the standard
--             helper functions referenced in triggers.
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: current_affairs
-- =====================================================

CREATE TABLE IF NOT EXISTS current_affairs (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(500) NOT NULL,
  slug          VARCHAR(500),
  content       TEXT,
  excerpt       TEXT,
  category      VARCHAR(100),
  category_id   INTEGER,
  exam_id       INTEGER,
  image_asset_id INTEGER,
  author_id     INTEGER,
  published_at  TIMESTAMPTZ,
  is_featured   BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  view_count    INTEGER DEFAULT 0,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS slug VARCHAR(500);
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS category_id INTEGER;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS exam_id INTEGER;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS image_asset_id INTEGER;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS author_id INTEGER;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE current_affairs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'current_affairs' AND indexname = 'idx_current_affairs_slug') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_current_affairs_slug
      ON current_affairs(slug) WHERE slug IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_current_affairs_is_active   ON current_affairs(is_active)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_current_affairs_published_at ON current_affairs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_current_affairs_category    ON current_affairs(category)   WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_current_affairs_exam_id     ON current_affairs(exam_id)    WHERE exam_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_current_affairs_author_id   ON current_affairs(author_id)  WHERE author_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_current_affairs_created_at  ON current_affairs(created_at DESC);


-- =====================================================
-- PHASE 2: community_comments
-- =====================================================

CREATE TABLE IF NOT EXISTS community_comments (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER,
  user_id    INTEGER,
  content    TEXT NOT NULL,
  parent_id  INTEGER,
  is_active  BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id    ON community_comments(post_id)   WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_comments_user_id    ON community_comments(user_id)   WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id  ON community_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_comments_is_active  ON community_comments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_community_comments_created_at ON community_comments(created_at DESC);


-- =====================================================
-- PHASE 3: question_tag_map
-- =====================================================

CREATE TABLE IF NOT EXISTS question_tag_map (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL,
  tag_id      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE tablename = 'question_tag_map'
       AND indexname = 'idx_question_tag_map_unique'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_tag_map_unique
      ON question_tag_map(question_id, tag_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_question_tag_map_question_id ON question_tag_map(question_id);
CREATE INDEX IF NOT EXISTS idx_question_tag_map_tag_id      ON question_tag_map(tag_id);


-- =====================================================
-- PHASE 4: attempt_section_scores
-- =====================================================

CREATE TABLE IF NOT EXISTS attempt_section_scores (
  id                  SERIAL PRIMARY KEY,
  attempt_id          INTEGER,
  section_id          INTEGER,
  correct             INTEGER DEFAULT 0,
  incorrect           INTEGER DEFAULT 0,
  wrong               INTEGER DEFAULT 0,
  skipped             INTEGER DEFAULT 0,
  unattempted         INTEGER DEFAULT 0,
  score               NUMERIC(10,2) DEFAULT 0,
  marks               NUMERIC(10,2) DEFAULT 0,
  negative_marks      NUMERIC(10,2) DEFAULT 0,
  total_marks         NUMERIC(10,2) DEFAULT 0,
  time_spent_seconds  INTEGER DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempt_section_scores_attempt_id ON attempt_section_scores(attempt_id) WHERE attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempt_section_scores_section_id ON attempt_section_scores(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempt_section_scores_is_active  ON attempt_section_scores(is_active)  WHERE is_active = true;


-- =====================================================
-- PHASE 5: leaderboard_snapshots
-- =====================================================

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id              SERIAL PRIMARY KEY,
  leaderboard_id  INTEGER,
  test_id         INTEGER,
  user_id         INTEGER,
  rank            INTEGER,
  score           NUMERIC(12,2) DEFAULT 0,
  snapshot_date   DATE,
  rankings        JSONB DEFAULT '[]'::jsonb,
  captured_at     TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leaderboard_snapshots ADD COLUMN IF NOT EXISTS leaderboard_id INTEGER;
ALTER TABLE leaderboard_snapshots ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE leaderboard_snapshots ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE leaderboard_snapshots ADD COLUMN IF NOT EXISTS score NUMERIC(12,2) DEFAULT 0;
ALTER TABLE leaderboard_snapshots ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE leaderboard_snapshots ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE leaderboard_snapshots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_leaderboard_id ON leaderboard_snapshots(leaderboard_id) WHERE leaderboard_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_test_id        ON leaderboard_snapshots(test_id)        WHERE test_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_user_id        ON leaderboard_snapshots(user_id)        WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_captured_at    ON leaderboard_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_is_active      ON leaderboard_snapshots(is_active)      WHERE is_active = true;


-- =====================================================
-- PHASE 6: email_templates
-- Re-create the table that was dropped in 019. Schema
-- matches the route's INSERT (name, type, subject, body,
-- variables, enabled) plus richer columns the rest of
-- the app expects (body_html, body_text).
-- =====================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  type        VARCHAR(50),
  subject     VARCHAR(500) NOT NULL,
  body        TEXT,
  body_html   TEXT,
  body_text   TEXT,
  variables   JSONB DEFAULT '[]'::jsonb,
  enabled     BOOLEAN DEFAULT true,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_email_templates_type      ON email_templates(type)     WHERE type IS NOT NULL;


-- =====================================================
-- PHASE 7: _orphaned COLUMN (H1)
-- Add to tests, questions, test_series plus a few
-- related tables that the audit mentions.
-- =====================================================

DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'tests',
    'questions',
    'test_series',
    'topics',
    'chapters',
    'subtopics',
    'subjects',
    'study_materials',
    'exams'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS _orphaned BOOLEAN DEFAULT false',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (_orphaned) WHERE _orphaned = true',
        'idx_' || t || '_orphaned', t
      );
    END IF;
  END LOOP;
END $$;


-- =====================================================
-- PHASE 8: ENABLE updated_at TRIGGERS for new tables
-- =====================================================

DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'current_affairs', 'community_comments', 'question_tag_map',
    'attempt_section_scores', 'leaderboard_snapshots', 'email_templates'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    FOREACH t IN ARRAY v_tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = t) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
        EXECUTE format(
          'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
          t
        );
      END IF;
    END LOOP;
  ELSE
    RAISE WARNING 'update_updated_at_column() not present; skipping trigger creation';
  END IF;
END $$;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_missing TEXT[] := '{}';
  v_t TEXT;
  v_tables TEXT[] := ARRAY[
    'current_affairs', 'community_comments', 'question_tag_map',
    'attempt_section_scores', 'leaderboard_snapshots', 'email_templates'
  ];
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = v_t) THEN
      v_missing := array_append(v_missing, v_t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE 'Migration 030: all 6 missing tables present';
  ELSE
    RAISE WARNING 'Migration 030: missing tables: %', array_to_string(v_missing, ', ');
  END IF;

  -- _orphaned column on tests / questions / test_series
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests'       AND column_name = '_orphaned') THEN
    RAISE WARNING 'tests._orphaned missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions'   AND column_name = '_orphaned') THEN
    RAISE WARNING 'questions._orphaned missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = '_orphaned') THEN
    RAISE WARNING 'test_series._orphaned missing';
  END IF;
END $$;

COMMIT;
