-- =====================================================
-- Migration 026: Schema Gaps — Subtopics, Assets, and Resources
-- Purpose: Add missing tables:
--          1. subtopics (hierarchical division of topics)
--          2. question_assets (scalable asset system for questions)
--          3. topic_resources (material mapping notes/videos/tests to topics/subtopics)
--          + Critical Performance indexes on queries
-- Created: 2026-06-14
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- Depends on: All prior migrations (001–025)
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: SUBTOPICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS subtopics (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique index on slug per topic
CREATE UNIQUE INDEX IF NOT EXISTS idx_subtopics_slug_unique ON subtopics(topic_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON subtopics(topic_id);

-- Link questions directly to a subtopic if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subtopics') THEN
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS subtopic_id INTEGER REFERENCES subtopics(id) ON DELETE SET NULL;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'questions' AND indexname = 'idx_questions_subtopic_id') THEN
      CREATE INDEX IF NOT EXISTS idx_questions_subtopic_id ON questions(subtopic_id) WHERE subtopic_id IS NOT NULL;
    END IF;
  END IF;
END $$;


-- =====================================================
-- PHASE 2: QUESTION ASSETS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS question_assets (
  id BIGSERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL, -- image, audio, video, table, passage, pdf
  asset_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_assets_question_id ON question_assets(question_id);
CREATE INDEX IF NOT EXISTS idx_question_assets_asset_type ON question_assets(asset_type);


-- =====================================================
-- PHASE 3: TOPIC RESOURCES TABLE (Material Mapping)
-- =====================================================

CREATE TABLE IF NOT EXISTS topic_resources (
  id BIGSERIAL PRIMARY KEY,
  topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
  subtopic_id INTEGER REFERENCES subtopics(id) ON DELETE SET NULL,
  resource_type VARCHAR(50) NOT NULL, -- notes, pyqs, videos, tests, practice_sets
  resource_id VARCHAR(255) NOT NULL, -- polymorphic reference to resource ID
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_resources_topic_id ON topic_resources(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_resources_subtopic_id ON topic_resources(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_topic_resources_type_resource ON topic_resources(resource_type, resource_id);


-- =====================================================
-- PHASE 4: PERFORMANCE IMPROVEMENTS & CRITICAL INDEXES
-- =====================================================

-- Ensure index on questions(topic_id)
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id) WHERE topic_id IS NOT NULL;

-- Ensure index on questions(test_id) if test_id exists in questions (for legacy/backwards-compatibility support)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'test_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'questions' AND indexname = 'idx_questions_test') THEN
      CREATE INDEX IF NOT EXISTS idx_questions_test ON questions(test_id) WHERE test_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Ensure index on attempts(user_id)
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);

-- Ensure index on attempts(test_id)
CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id);

-- Ensure index on test_questions(test_id) and test_questions(question_id) for the junction table
CREATE INDEX IF NOT EXISTS idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_question_id ON test_questions(question_id);

-- Ensure compound index on user_topic_performance(user_id, topic_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_topic_perf_user_topic ON user_topic_performance(user_id, topic_id);


-- =====================================================
-- PHASE 5: UPDATED_AT COLUMNS TRIGGERS
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  new_tables TEXT[] := ARRAY['subtopics', 'question_assets', 'topic_resources'];
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
-- PHASE 6: VERIFICATION
-- =====================================================

DO $$
DECLARE
  missing_count INTEGER := 0;
  tbl TEXT;
  expected_tables TEXT[] := ARRAY[
    'subtopics', 'question_assets', 'topic_resources'
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
    RAISE NOTICE 'Migration 026: All 3 new tables created successfully';
  ELSE
    RAISE WARNING 'Migration 026: % tables still missing!', missing_count;
  END IF;

  -- Verify subtopic_id added to questions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'subtopic_id') THEN
    RAISE NOTICE 'questions.subtopic_id exists — correct';
  ELSE
    RAISE WARNING 'questions.subtopic_id missing!';
  END IF;

  RAISE NOTICE 'Migration 026: Verification complete';
END $$;

COMMIT;
