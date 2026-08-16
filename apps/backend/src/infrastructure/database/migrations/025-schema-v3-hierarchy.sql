-- =====================================================
-- Migration 025: Schema V3 — Clean Exam Hierarchy
-- Purpose: Restructure schema into clean hierarchy:
--          Exam → Stage → Subject → Topic
--          Test Series → Test → Section → Question
--          + ClassX import support + AI analytics tables
-- Created: 2026-06-14
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- Depends on: All prior migrations (001–024)
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: CORE HIERARCHY FK COLUMNS
-- Add proper foreign keys to build the tree:
-- Exam → Stage → Subject → Topic
-- =====================================================

-- 1a. exams — ensure all columns from the proposed schema exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exams') THEN
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    ALTER TABLE exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

    -- Create unique index IF NOT EXISTS on slug if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'exams' AND indexname = 'idx_exams_slug_unique') THEN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_slug_unique ON exams(slug) WHERE slug IS NOT NULL;
    END IF;

    RAISE NOTICE 'exams: ensured slug, description, is_active, timestamps exist';
  END IF;
END $$;

-- 1b. stages — add exam_id FK (currently uses exam_ids VARCHAR[] array)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stages')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exams') THEN
    ALTER TABLE stages ADD COLUMN IF NOT EXISTS exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL;
    ALTER TABLE stages ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;
    ALTER TABLE stages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

    RAISE NOTICE 'stages: added exam_id FK, display_order, created_at';
  ELSE
    RAISE WARNING 'stages or exams table missing — skipping';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stages_exam_id ON stages(exam_id);

-- 1c. subjects — add stage_id FK (currently uses stage_ids INTEGER[] array)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subjects')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stages') THEN
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL;
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

    RAISE NOTICE 'subjects: added stage_id FK, slug, created_at';
  ELSE
    RAISE WARNING 'subjects or stages table missing — skipping';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subjects_stage_id ON subjects(stage_id);

-- 1d. topics — add subject_id FK (currently uses chapter_id → subjects)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'topics')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subjects') THEN
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL;
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20);
    ALTER TABLE topics ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

    RAISE NOTICE 'topics: added subject_id FK, slug, difficulty, created_at';
  ELSE
    RAISE WARNING 'topics or subjects table missing — skipping';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);

-- 1e. test_series — add exam_id + stage_id FKs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_series') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exams') THEN
      ALTER TABLE test_series ADD COLUMN IF NOT EXISTS exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stages') THEN
      ALTER TABLE test_series ADD COLUMN IF NOT EXISTS stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL;
    END IF;

    RAISE NOTICE 'test_series: added exam_id + stage_id FKs';
  ELSE
    RAISE WARNING 'test_series table missing — skipping';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_test_series_exam_id ON test_series(exam_id);
CREATE INDEX IF NOT EXISTS idx_test_series_stage_id ON test_series(stage_id);

-- =====================================================
-- PHASE 2: TESTS & SECTIONS ENHANCEMENT
-- Add new columns to tests and test_sections
-- =====================================================

-- 2a. tests — add new columns (all additive, no existing columns removed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tests') THEN
    -- Content fields
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS instructions TEXT;
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS test_type VARCHAR(50);

    -- Scheduling fields
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

    -- Test behavior flags
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE;
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT FALSE;
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS allow_review BOOLEAN DEFAULT TRUE;

    -- Limits & tracking
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 0;
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;

    -- Import provenance
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS imported_from VARCHAR(100);
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS source_test_id VARCHAR(100);

    -- AI features
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS ai_explanation_enabled BOOLEAN DEFAULT TRUE;

    RAISE NOTICE 'tests: added instructions, test_type, scheduling, shuffle, limits, import, AI columns';
  END IF;
END $$;

-- Add timestamp columns to the TIMESTAMP_COLUMNS registry via index
CREATE INDEX IF NOT EXISTS idx_tests_start_time ON tests(start_time) WHERE start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tests_end_time ON tests(end_time) WHERE end_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tests_test_type ON tests(test_type) WHERE test_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tests_imported_from ON tests(imported_from) WHERE imported_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tests_source_test_id ON tests(source_test_id) WHERE source_test_id IS NOT NULL;

-- 2b. test_sections — add negative_marks column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_sections') THEN
    ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS negative_marks NUMERIC;
    ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS total_marks NUMERIC;
    ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS total_questions INTEGER;

    RAISE NOTICE 'test_sections: added negative_marks, total_marks, total_questions';
  END IF;
END $$;

-- =====================================================
-- PHASE 3: QUESTIONS ENHANCEMENT + CLASSX IMPORT SUPPORT
-- Add columns needed for external question bank import
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') THEN
    -- ClassX import fields
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS external_question_id VARCHAR(100);
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en';
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution_image_url TEXT;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS source VARCHAR(255);
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS imported_from VARCHAR(100);

    -- Ensure topic_id FK column exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'topics') THEN
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL;
    END IF;

    -- Ensure section_id FK column exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_sections') THEN
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL;
    END IF;

    RAISE NOTICE 'questions: added external_question_id, language, solution_image_url, source, imported_from, topic_id, section_id';
  END IF;
END $$;

-- Composite unique index for import deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_external_id_source
  ON questions(external_question_id, imported_from)
  WHERE external_question_id IS NOT NULL AND imported_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_imported_from ON questions(imported_from) WHERE imported_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON questions(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_language ON questions(language);

-- =====================================================
-- PHASE 4: ATTEMPTS ENHANCEMENT + ANALYTICS TABLES
-- Add normalized user_answers table and AI analytics
-- =====================================================

-- 4a. attempts — add new columns for richer analytics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attempts') THEN
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS percentile NUMERIC;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS rank INTEGER;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS attempted INTEGER DEFAULT 0;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS incorrect INTEGER DEFAULT 0;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS skipped INTEGER DEFAULT 0;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
    ALTER TABLE attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;

    RAISE NOTICE 'attempts: added percentile, rank, attempted, incorrect, skipped, started_at, submitted_at';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at ON attempts(submitted_at) WHERE submitted_at IS NOT NULL;

-- 4b. user_answers — normalized answers table (parallel to JSONB answers column on attempts)
CREATE TABLE IF NOT EXISTS user_answers (
  id BIGSERIAL PRIMARY KEY,
  attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  selected_option INTEGER,
  is_correct BOOLEAN,
  marks_awarded NUMERIC,
  time_spent INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_answers_attempt_id ON user_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_question_id ON user_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_is_correct ON user_answers(is_correct);

-- 4c. user_topic_performance — AI analytics aggregation table
CREATE TABLE IF NOT EXISTS user_topic_performance (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  total_attempted INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_wrong INTEGER DEFAULT 0,
  accuracy NUMERIC DEFAULT 0,
  average_time NUMERIC DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint: one row per user+topic pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_topic_perf_user_topic
  ON user_topic_performance(user_id, topic_id);

CREATE INDEX IF NOT EXISTS idx_user_topic_perf_user_id ON user_topic_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_perf_topic_id ON user_topic_performance(topic_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_perf_accuracy ON user_topic_performance(accuracy);

-- 4d. import_logs — audit trail for bulk imports
CREATE TABLE IF NOT EXISTS import_logs (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  file_name VARCHAR(255),
  total_records INTEGER DEFAULT 0,
  imported INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  imported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_source ON import_logs(source);
CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON import_logs(created_at);

-- =====================================================
-- UPDATED_AT TRIGGERS FOR NEW TABLES
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  new_tables TEXT[] := ARRAY['user_topic_performance'];
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
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  missing_count INTEGER := 0;
  tbl TEXT;
  expected_tables TEXT[] := ARRAY[
    'user_answers', 'user_topic_performance', 'import_logs'
  ];
BEGIN
  -- Verify new tables exist
  FOREACH tbl IN ARRAY expected_tables
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
      RAISE WARNING 'MISSING TABLE: %', tbl;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;

  IF missing_count = 0 THEN
    RAISE NOTICE 'Migration 025: All 3 new tables created successfully';
  ELSE
    RAISE WARNING 'Migration 025: % tables still missing!', missing_count;
  END IF;

  -- Verify key FK columns on hierarchy tables
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stages' AND column_name = 'exam_id') THEN
    RAISE NOTICE 'stages.exam_id exists — correct';
  ELSE
    RAISE WARNING 'stages.exam_id missing!';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'stage_id') THEN
    RAISE NOTICE 'subjects.stage_id exists — correct';
  ELSE
    RAISE WARNING 'subjects.stage_id missing!';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'subject_id') THEN
    RAISE NOTICE 'topics.subject_id exists — correct';
  ELSE
    RAISE WARNING 'topics.subject_id missing!';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'external_question_id') THEN
    RAISE NOTICE 'questions.external_question_id exists — correct';
  ELSE
    RAISE WARNING 'questions.external_question_id missing!';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'shuffle_questions') THEN
    RAISE NOTICE 'tests.shuffle_questions exists — correct';
  ELSE
    RAISE WARNING 'tests.shuffle_questions missing!';
  END IF;

  RAISE NOTICE 'Migration 025: Verification complete';
END $$;

COMMIT;
