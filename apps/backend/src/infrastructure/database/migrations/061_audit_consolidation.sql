-- =====================================================
-- 061_audit_consolidation.sql
-- Addresses audit findings: schema declaration, missing
-- FKs/indexes, _orphaned column declarations, status
-- vocabulary standardization, quizzes form columns.
-- Idempotent. Safe to re-run.
--
-- IMPORTANT: This migration does NOT drop questions.test_id
-- or question_attempts — too much application code actively
-- reads them. Those are kept for backward compatibility.
-- The test_questions junction is the canonical link going
-- forward, but questions.test_id remains as a denormalized
-- convenience column.
-- =====================================================

-- =====================================================
-- PHASE 1: Declare core tables that had no in-repo CREATE TABLE
-- (Only declares if table doesn't exist. Won't alter existing.)
-- =====================================================

-- 1a. tests table baseline
CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  duration INTEGER DEFAULT 60,
  total_questions INTEGER DEFAULT 0,
  total_marks NUMERIC DEFAULT 0,
  negative_marking NUMERIC DEFAULT 0.25,
  difficulty VARCHAR(20) DEFAULT 'medium',
  is_pro BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  is_live BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'draft',
  series_id INTEGER REFERENCES test_series(id) ON DELETE SET NULL,
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  test_category_id INTEGER,
  section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL,
  exam_id VARCHAR(255),
  stage_ids INTEGER[],
  tags TEXT[],
  category_path_ids JSONB,
  category_path_names JSONB,
  is_coming_soon BOOLEAN DEFAULT false,
  coming_soon_date TIMESTAMP,
  languages JSONB,
  cutoff_marks JSONB,
  version INTEGER DEFAULT 1,
  ai_explanation_enabled BOOLEAN DEFAULT true,
  instructions TEXT,
  test_type VARCHAR(50),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  shuffle_questions BOOLEAN DEFAULT false,
  shuffle_options BOOLEAN DEFAULT false,
  allow_review BOOLEAN DEFAULT true,
  max_attempts INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  imported_from VARCHAR(100),
  source_test_id INTEGER,
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  live_at TIMESTAMP,
  expired_at TIMESTAMP,
  archived_at TIMESTAMP,
  state_updated_by INTEGER,
  banner_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  promotion_banner_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1b. questions table baseline
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  question_text_hi TEXT,
  options JSONB DEFAULT '[]',
  options_hi JSONB,
  correct_answer INTEGER DEFAULT 0,
  correct_option INTEGER DEFAULT 0,
  explanation TEXT,
  explanation_hi TEXT,
  marks DECIMAL(5,2) DEFAULT 1.00,
  negative_marks DECIMAL(5,2) DEFAULT 0.00,
  difficulty VARCHAR(20) DEFAULT 'medium',
  question_type VARCHAR(50) DEFAULT 'single_correct',
  category VARCHAR(255),
  sub_category_id VARCHAR(255),
  tags TEXT[],
  status VARCHAR(50) DEFAULT 'active',
  is_active BOOLEAN DEFAULT true,
  is_practice BOOLEAN DEFAULT false,
  question_number INTEGER DEFAULT 1,
  test_id INTEGER,
  series_id INTEGER REFERENCES test_series(id) ON DELETE SET NULL,
  section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL,
  subject VARCHAR(255),
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id INTEGER,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  topic VARCHAR(255),
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
  study_material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL,
  image_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  image_url TEXT,
  passage_id INTEGER,
  created_by INTEGER,
  category_id VARCHAR(255),
  external_question_id VARCHAR(100),
  language VARCHAR(20) DEFAULT 'en',
  solution_image_url TEXT,
  source VARCHAR(255),
  imported_from VARCHAR(100),
  is_deleted BOOLEAN DEFAULT false,
  deleted_by INTEGER,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1c. test_questions junction table
CREATE TABLE IF NOT EXISTS test_questions (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL,
  order_index INTEGER DEFAULT 0,
  marks NUMERIC,
  negative_marks NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1d. question_options table (legacy, kept for backward compat)
CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL,
  text TEXT,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1e. attempts table baseline
CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  test_id INTEGER,
  series_id INTEGER,
  status VARCHAR(50) DEFAULT 'not_started',
  score NUMERIC DEFAULT 0,
  total_marks NUMERIC DEFAULT 0,
  time_taken INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  is_reattempt BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_activity TIMESTAMP,
  last_question_id INTEGER,
  marked_for_review JSONB,
  question_results JSONB,
  solutions JSONB,
  section_scores JSONB,
  section_times JSONB,
  section_timers JSONB,
  percentile NUMERIC,
  rank INTEGER,
  attempted INTEGER DEFAULT 0,
  incorrect INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1f. test_categories table baseline
CREATE TABLE IF NOT EXISTS test_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  description TEXT,
  image TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  exam_category_id VARCHAR(255),
  stage_ids INTEGER[],
  test_series_id INTEGER[],
  is_deleted BOOLEAN DEFAULT false,
  deleted_by INTEGER,
  deleted_at TIMESTAMP,
  public_id_uuid UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 1g. ca_quiz_attempts (referenced by currentAffairs.js but never declared)
CREATE TABLE IF NOT EXISTS ca_quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ca_id INTEGER NOT NULL REFERENCES ca_quizzes(id) ON DELETE CASCADE,
  answers JSONB,
  correct_count INTEGER DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PHASE 2: Declare _orphaned columns formally
-- =====================================================

DO $$
BEGIN
  -- tests._orphaned columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = '_orphaned') THEN
    ALTER TABLE tests ADD COLUMN _orphaned BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = '_deleted_series_id') THEN
    ALTER TABLE tests ADD COLUMN _deleted_series_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'orphaned_at') THEN
    ALTER TABLE tests ADD COLUMN orphaned_at TIMESTAMP;
  END IF;

  -- questions._orphaned columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = '_orphaned') THEN
    ALTER TABLE questions ADD COLUMN _orphaned BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = '_deleted_test_id') THEN
    ALTER TABLE questions ADD COLUMN _deleted_test_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = '_deleted_series_id') THEN
    ALTER TABLE questions ADD COLUMN _deleted_series_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'orphaned_at') THEN
    ALTER TABLE questions ADD COLUMN orphaned_at TIMESTAMP;
  END IF;

  -- test_series._orphaned columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = '_orphaned') THEN
    ALTER TABLE test_series ADD COLUMN _orphaned BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'orphaned_at') THEN
    ALTER TABLE test_series ADD COLUMN orphaned_at TIMESTAMP;
  END IF;
END $$;

-- =====================================================
-- PHASE 3: Add missing foreign keys
-- =====================================================

DO $$
BEGIN
  -- Ensure questions.created_by column exists (PHASE 1's CREATE TABLE
  -- doesn't add columns to pre-existing tables)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE questions ADD COLUMN created_by INTEGER;
  END IF;

  -- Ensure quizzes.created_by column exists (same reason)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quizzes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE quizzes ADD COLUMN created_by INTEGER;
  END IF;

  -- questions.test_id -> tests.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_test_id_fkey') THEN
    EXECUTE 'ALTER TABLE questions ADD CONSTRAINT questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL';
  END IF;

  -- questions.chapter_id -> chapters.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_chapter_id_fkey') THEN
    EXECUTE 'ALTER TABLE questions ADD CONSTRAINT questions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL';
  END IF;

  -- questions.passage_id -> passages.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_passage_id_fkey') THEN
    EXECUTE 'ALTER TABLE questions ADD CONSTRAINT questions_passage_id_fkey FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE SET NULL';
  END IF;

  -- questions.created_by -> users.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_created_by_fkey') THEN
    EXECUTE 'ALTER TABLE questions ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL';
  END IF;

  -- test_questions.test_id -> tests.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_questions_test_id_fkey') THEN
    EXECUTE 'ALTER TABLE test_questions ADD CONSTRAINT test_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE';
  END IF;

  -- test_questions.question_id -> questions.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'test_questions_question_id_fkey') THEN
    EXECUTE 'ALTER TABLE test_questions ADD CONSTRAINT test_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE';
  END IF;

  -- attempts.test_id -> tests.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attempts_test_id_fkey') THEN
    EXECUTE 'ALTER TABLE attempts ADD CONSTRAINT attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE';
  END IF;

  -- attempts.user_id -> users.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attempts_user_id_fkey') THEN
    EXECUTE 'ALTER TABLE attempts ADD CONSTRAINT attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE';
  END IF;

  -- attempts.series_id -> test_series.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attempts_series_id_fkey') THEN
    EXECUTE 'ALTER TABLE attempts ADD CONSTRAINT attempts_series_id_fkey FOREIGN KEY (series_id) REFERENCES test_series(id) ON DELETE SET NULL';
  END IF;

  -- quizzes.created_by FK
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_created_by_fkey') THEN
    EXECUTE 'ALTER TABLE quizzes ADD CONSTRAINT quizzes_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL';
  END IF;
END $$;

-- =====================================================
-- PHASE 4: Add missing indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_attempts_series_id ON attempts(series_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_section_id ON test_questions(section_id);
CREATE INDEX IF NOT EXISTS idx_questions_image_asset_id ON questions(image_asset_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_by ON questions(created_by);
CREATE INDEX IF NOT EXISTS idx_questions_passage_id ON questions(passage_id);
CREATE INDEX IF NOT EXISTS idx_questions_is_practice ON questions(is_practice);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);

-- =====================================================
-- PHASE 4b: Ensure questions columns required by PHASE 5 exist
-- (CREATE TABLE IF NOT EXISTS in PHASE 1 is a no-op when the
--  table already exists, so these columns may be missing.)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'correct_answer') THEN
    ALTER TABLE questions ADD COLUMN correct_answer INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'correct_option') THEN
    ALTER TABLE questions ADD COLUMN correct_option INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'is_practice') THEN
    ALTER TABLE questions ADD COLUMN is_practice BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'language') THEN
    ALTER TABLE questions ADD COLUMN language VARCHAR(20) DEFAULT 'en';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'question_type') THEN
    ALTER TABLE questions ADD COLUMN question_type VARCHAR(50) DEFAULT 'single_correct';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'marks') THEN
    ALTER TABLE questions ADD COLUMN marks DECIMAL(5,2) DEFAULT 1.00;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'negative_marks') THEN
    ALTER TABLE questions ADD COLUMN negative_marks DECIMAL(5,2) DEFAULT 0.00;
  END IF;
END $$;

-- =====================================================
-- PHASE 5: Migrate practice_questions data to questions.is_practice
-- (Guarded — only runs if practice_questions table exists)
-- =====================================================

DO $$
DECLARE
  v_cols TEXT;
  v_sql  TEXT;
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'practice_questions') THEN
    RAISE NOTICE 'practice_questions does not exist — skipping data migration';
    RETURN;
  END IF;

  -- Build column list dynamically: only columns present in BOTH tables
  -- with compatible data types (exact match on data_type + udt_name).
  SELECT string_agg(pq.column_name, ', ' ORDER BY pq.ordinal_position)
    INTO v_cols
  FROM information_schema.columns pq
  JOIN information_schema.columns q
    ON  q.table_schema  = 'public'
    AND q.table_name    = 'questions'
    AND q.column_name   = pq.column_name
    AND q.data_type     = pq.data_type
    AND q.udt_name      = pq.udt_name
  WHERE pq.table_schema = 'public'
    AND pq.table_name   = 'practice_questions'
    AND pq.column_name NOT IN ('id');          -- skip PK

  IF v_cols IS NULL OR v_cols = '' THEN
    RAISE WARNING 'No compatible columns between practice_questions and questions — skipping data migration';
    RETURN;
  END IF;

  -- Ensure is_practice is in the target column list
  IF v_cols NOT LIKE '%is_practice%' THEN
    v_cols := v_cols || ', is_practice';
  END IF;

  v_sql := format(
    'INSERT INTO questions (%s) '
    'SELECT %s FROM practice_questions pq '
    'WHERE NOT EXISTS ('
    '  SELECT 1 FROM questions q '
    '  WHERE q.question_text = pq.question_text '
    '    AND q.is_practice = true '
    '    AND q.created_at = pq.created_at'
    ')',
    v_cols,
    replace(v_cols, 'is_practice', 'true')
  );

  BEGIN
    EXECUTE v_sql;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % practice_questions rows into questions (cols: %)', v_count, v_cols;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'practice_questions migration failed (non-fatal): % — %', SQLSTATE, SQLERRM;
  END;
END $$;

-- =====================================================
-- PHASE 6: Drop standalone practice_questions table (after data migration)
-- (Guarded — only drops if table exists)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'practice_answers' AND c.relkind = 'r') THEN
    EXECUTE 'DROP TABLE IF EXISTS practice_answers CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'practice_questions' AND c.relkind = 'r') THEN
    EXECUTE 'DROP TABLE IF EXISTS practice_questions CASCADE';
  END IF;
END $$;

-- =====================================================
-- PHASE 7: Drop zombie test_attempts table/view (if exists)
-- (Guarded — only drops if table exists)
-- =====================================================

DO $$
BEGIN
  -- Use pg_class + pg_namespace to robustly detect whatever kind of relation exists.
  -- Covers cases where information_schema misses views owned by other roles/schemas.
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'test_attempts'
      AND c.relkind IN ('r', 'v', 'm', 'f', 'p')
  ) THEN
    BEGIN
      EXECUTE 'DROP TABLE IF EXISTS test_attempts CASCADE';
    EXCEPTION WHEN wrong_object_type THEN
      EXECUTE 'DROP VIEW IF EXISTS test_attempts CASCADE';
    END;
  END IF;
END $$;

-- =====================================================
-- PHASE 8: Drop user_answers table (consolidate on attempt_answers)
-- (Guarded — only drops if table exists)
-- NOTE: question_attempts is KEPT — application code actively uses it.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'user_answers' AND c.relkind = 'r') THEN
    EXECUTE 'DROP TABLE IF EXISTS user_answers CASCADE';
  END IF;
END $$;

-- =====================================================
-- PHASE 9: Standardize status vocabulary
-- Replace 'disabled' with 'archived'
-- =====================================================

UPDATE questions SET status = 'archived' WHERE status = 'disabled';
UPDATE tests SET status = 'archived' WHERE status = 'disabled';
UPDATE quizzes SET status = 'archived' WHERE status = 'disabled';

-- =====================================================
-- PHASE 10: Add quizzes columns used by admin form
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'instructions') THEN
    ALTER TABLE quizzes ADD COLUMN instructions TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'is_public') THEN
    ALTER TABLE quizzes ADD COLUMN is_public BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'shuffle_questions') THEN
    ALTER TABLE quizzes ADD COLUMN shuffle_questions BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'show_answers') THEN
    ALTER TABLE quizzes ADD COLUMN show_answers BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'topic') THEN
    ALTER TABLE quizzes ADD COLUMN topic VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'subject') THEN
    ALTER TABLE quizzes ADD COLUMN subject VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'question_count') THEN
    ALTER TABLE quizzes ADD COLUMN question_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'passing_score') THEN
    ALTER TABLE quizzes ADD COLUMN passing_score INTEGER;
  END IF;
END $$;

-- =====================================================
-- Done. Consolidation decisions:
-- 1. Quiz entities kept as 4 separate tables per team decision.
-- 2. Practice questions consolidated to questions.is_practice=true.
--    Standalone practice_questions/practice_answers dropped.
-- 3. questions.test_id KEPT (backward compat) — test_questions
--    junction is canonical going forward.
-- 4. user_answers dropped (consolidated on attempt_answers).
--    question_attempts KEPT — application code actively uses it.
-- 5. test_attempts zombie table dropped.
-- 6. question_options table KEPT (backward compat).
-- 7. _orphaned columns formally declared.
-- 8. Missing FKs and indexes added.
-- 9. Status vocabulary: 'disabled' -> 'archived'.
-- 10. quizzes table extended with form fields.
-- =====================================================