-- Migration 055: Full test import schema
-- Adds JSONB columns for config blocks missing from the tests, questions,
-- and test_sections tables.  All ALTERs are guarded with
-- column-not-exists checks so re-running is safe.

-- =====================================================================
-- 1. TESTS TABLE — config blocks from the full-test JSON format
-- =====================================================================

ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS short_title VARCHAR(255);

ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS question_language_mode VARCHAR(50) DEFAULT 'bilingual';

ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS is_pyq BOOLEAN DEFAULT false;

ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS pyq_year INTEGER;

-- UI toggle flags (grouped as JSONB to avoid 10+ individual columns)
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS show_config JSONB DEFAULT '{
    "calculator": false,
    "questionPalette": true,
    "sectionPalette": true,
    "timer": true,
    "bookmark": true,
    "reportIssue": true
  }'::jsonb;

-- Timing / navigation config
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS timing_config JSONB DEFAULT '{
    "mode": "overall",
    "navigationMode": "free",
    "autoSubmit": true,
    "sectionTimeShared": false,
    "autoMoveNextSection": false
  }'::jsonb;

-- Optional-section config
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS optional_section_config JSONB DEFAULT '{
    "enabled": false,
    "maxSelectableSections": 0
  }'::jsonb;

-- Attempt rules (extends existing max_attempts)
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS attempt_rules JSONB DEFAULT '{
    "allowReattempt": true,
    "allowResume": true,
    "allowPause": false
  }'::jsonb;

-- Post-test analysis toggles
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS analysis_config JSONB DEFAULT '{
    "enabled": true,
    "showRank": true,
    "showPercentile": true,
    "showLeaderboard": true,
    "showSolutions": true,
    "showQuestionAnalysis": true,
    "showSectionAnalysis": true,
    "showSubjectAnalysis": true,
    "showChapterAnalysis": true,
    "showTopicAnalysis": true,
    "showSubtopicAnalysis": true
  }'::jsonb;

-- Access / gating config
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS access_config JSONB DEFAULT '{
    "type": "free",
    "requiresPurchase": false,
    "batchIds": [],
    "subscriptionIds": []
  }'::jsonb;

-- Availability window
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '{
    "availableFrom": null,
    "availableTill": null
  }'::jsonb;

-- =====================================================================
-- 2. QUESTIONS TABLE — bilingual, taxonomy, source tracking
-- =====================================================================

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS estimated_time INTEGER;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS question_text_hi TEXT;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS options_hi JSONB DEFAULT '[]'::jsonb;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS explanation_hi TEXT;

-- Source metadata (structured, replaces the plain VARCHAR source column)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS source_config JSONB DEFAULT '{
    "type": null,
    "examId": null,
    "year": null,
    "shift": null,
    "paper": null
  }'::jsonb;

-- Multi-value taxonomy arrays (JSON import has arrays; DB had singular FKs)
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS exam_category_ids TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS exam_ids TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS question_stage_ids TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS concept_ids TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS skill_ids TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{"en"}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS chapter_ids TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS topic_ids TEXT[] DEFAULT '{}';

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS subtopic_ids TEXT[] DEFAULT '{}';

-- =====================================================================
-- 3. TEST_SECTIONS TABLE — ordering, flags, per-section config
-- =====================================================================

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS subject_id INTEGER;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 0;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS total_marks INTEGER DEFAULT 0;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS negative_marking NUMERIC(4,2) DEFAULT 0;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS mandatory BOOLEAN DEFAULT true;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS optional BOOLEAN DEFAULT false;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS qualifying BOOLEAN DEFAULT false;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS allow_navigation BOOLEAN DEFAULT true;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false;

ALTER TABLE test_sections
  ADD COLUMN IF NOT EXISTS instructions JSONB DEFAULT '[]'::jsonb;

-- =====================================================================
-- 4. Indexes for the new JSONB columns (GIN for @> containment queries)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_tests_show_config ON tests USING GIN (show_config);
CREATE INDEX IF NOT EXISTS idx_tests_timing_config ON tests USING GIN (timing_config);
CREATE INDEX IF NOT EXISTS idx_tests_analysis_config ON tests USING GIN (analysis_config);
CREATE INDEX IF NOT EXISTS idx_tests_access_config ON tests USING GIN (access_config);
CREATE INDEX IF NOT EXISTS idx_tests_availability ON tests USING GIN (availability);
CREATE INDEX IF NOT EXISTS idx_questions_source_config ON questions USING GIN (source_config);
