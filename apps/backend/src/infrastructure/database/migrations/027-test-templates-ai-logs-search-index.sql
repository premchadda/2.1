-- =====================================================
-- Migration 027: Test Templates, AI Generation Logs, Question Search Index
-- Purpose: Add missing tables:
--          1. test_templates (reusable test blueprints)
--          2. ai_generation_logs (track AI-generated content)
--          3. question_search_index (vector search readiness)
-- Created: 2026-06-14
-- Idempotent: All statements use IF NOT EXISTS / IF EXISTS
-- Depends on: All prior migrations (001–026)
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: TEST TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS test_templates (
  id SERIAL PRIMARY KEY,
  public_id_uuid UUID DEFAULT gen_random_uuid(),
  public_id TEXT GENERATED ALWAYS AS ('tpl_' || public_id_uuid::text) STORED,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  exam_id VARCHAR(255),
  stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  config_json JSONB NOT NULL DEFAULT '{}',
  -- Example config_json:
  -- {
  --   "sections": [
  --     { "name": "Quant", "questions": 25, "marks": 25, "duration": 20 },
  --     { "name": "Reasoning", "questions": 25, "marks": 25, "duration": 20 },
  --     { "name": "English", "questions": 25, "marks": 25, "duration": 20 },
  --     { "name": "GA", "questions": 25, "marks": 25, "duration": 20 }
  --   ],
  --   "totalQuestions": 100,
  --   "totalMarks": 100,
  --   "duration": 80,
  --   "negativeMarking": 0.25,
  --   "difficulty": "Medium",
  --   "shuffleQuestions": true,
  --   "shuffleOptions": true
  -- }
  total_questions INTEGER DEFAULT 0,
  total_marks INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 60,
  difficulty VARCHAR(50) DEFAULT 'Medium',
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- system templates vs user-created
  usage_count INTEGER DEFAULT 0, -- how many tests created from this template
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_templates_exam_id ON test_templates(exam_id) WHERE exam_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_templates_stage_id ON test_templates(stage_id) WHERE stage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_templates_is_active ON test_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_test_templates_is_system ON test_templates(is_system);


-- =====================================================
-- PHASE 2: AI GENERATION LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- question, explanation, quiz, notes, revision, summary, translation
  entity_id INTEGER, -- nullable for bulk operations
  prompt TEXT,
  model VARCHAR(100), -- e.g. 'gpt-4', 'claude-3', 'gemini-pro'
  provider VARCHAR(50), -- e.g. 'openai', 'anthropic', 'google', 'openrouter'
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'success', -- success, failed, pending, rate_limited
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- flexible extra data (model version, temperature, etc.)
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- admin who triggered it
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_entity ON ai_generation_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_model ON ai_generation_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_logs_status ON ai_generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_generation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_by ON ai_generation_logs(created_by) WHERE created_by IS NOT NULL;


-- =====================================================
-- PHASE 3: QUESTION SEARCH INDEX TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS question_search_index (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  search_text TEXT, -- denormalized concatenated text for full-text search
  keywords TEXT[], -- extracted keywords array
  difficulty VARCHAR(20),
  topic_id INTEGER,
  subtopic_id INTEGER,
  subject VARCHAR(255),
  question_type VARCHAR(50),
  language VARCHAR(20) DEFAULT 'en',
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension (1536)
  -- For pgvector: enables cosine similarity search
  -- ALTER EXTENSION IF NOT EXISTS vector; -- pgvector extension required
  is_indexed BOOLEAN DEFAULT false, -- whether embedding has been generated
  last_indexed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_question_id ON question_search_index(question_id);
CREATE INDEX IF NOT EXISTS idx_search_difficulty ON question_search_index(difficulty);
CREATE INDEX IF NOT EXISTS idx_search_topic_id ON question_search_index(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_subtopic_id ON question_search_index(subtopic_id) WHERE subtopic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_subject ON question_search_index(subject) WHERE subject IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_language ON question_search_index(language);
CREATE INDEX IF NOT EXISTS idx_search_is_indexed ON question_search_index(is_indexed);

-- Full-text search index on search_text
CREATE INDEX IF NOT EXISTS idx_search_text_fts ON question_search_index USING GIN(to_tsvector('english', COALESCE(search_text, '')));

-- Vector similarity index (cosine distance) — requires pgvector extension
-- Uncomment after pgvector is installed: CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE INDEX IF NOT EXISTS idx_search_embedding ON question_search_index USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- =====================================================
-- PHASE 4: UPDATED_AT TRIGGERS
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  new_tables TEXT[] := ARRAY['test_templates', 'question_search_index'];
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
-- PHASE 5: ENTITY PREFIX REGISTRATION
-- =====================================================

-- Note: Entity prefixes are registered in postgres-helpers.js ENTITY_PREFIXES
-- New prefixes added by this migration:
--   test_templates: 'tpl_'
--   ai_generation_logs: no public_id needed (internal log)
--   question_search_index: no public_id needed (internal index)


-- =====================================================
-- PHASE 6: VERIFICATION
-- =====================================================

DO $$
DECLARE
  missing_count INTEGER := 0;
  tbl TEXT;
  expected_tables TEXT[] := ARRAY[
    'test_templates', 'ai_generation_logs', 'question_search_index'
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
    RAISE NOTICE 'Migration 027: All 3 new tables created successfully';
  ELSE
    RAISE WARNING 'Migration 027: % tables still missing!', missing_count;
  END IF;

  -- Verify public_id on test_templates
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_templates' AND column_name = 'public_id') THEN
    RAISE NOTICE 'test_templates.public_id exists — correct';
  ELSE
    RAISE WARNING 'test_templates.public_id missing!';
  END IF;

  -- Verify embedding column on question_search_index
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_search_index' AND column_name = 'embedding') THEN
    RAISE NOTICE 'question_search_index.embedding exists — correct';
  ELSE
    RAISE WARNING 'question_search_index.embedding missing!';
  END IF;

  RAISE NOTICE 'Migration 027: Verification complete';
END $$;

COMMIT;
