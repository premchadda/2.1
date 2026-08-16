-- Migration 073: Medium priority database fixes
-- Fixes: #97/#98 category_path type conflicts, #105-#108 missing indexes/constraints

BEGIN;

-- ============================================================
-- FIX #97/#98: Standardize category_path_ids and category_path_names to JSONB
-- The initTables code creates them as TEXT[] first, but migrations/queries treat
-- them as JSONB. Standardize to JSONB since all downstream queries use jsonb operators.
-- ============================================================

DO $$
BEGIN
  -- tests.category_path_ids: convert TEXT[] → JSONB if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests'
      AND column_name = 'category_path_ids'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE tests
      ALTER COLUMN category_path_ids DROP DEFAULT,
      ALTER COLUMN category_path_ids TYPE JSONB USING to_jsonb(category_path_ids),
      ALTER COLUMN category_path_ids SET DEFAULT '[]'::jsonb;
    RAISE NOTICE 'tests.category_path_ids converted from TEXT[] to JSONB';
  END IF;

  -- tests.category_path_names: same conversion
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests'
      AND column_name = 'category_path_names'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE tests
      ALTER COLUMN category_path_names DROP DEFAULT,
      ALTER COLUMN category_path_names TYPE JSONB USING to_jsonb(category_path_names),
      ALTER COLUMN category_path_names SET DEFAULT '[]'::jsonb;
    RAISE NOTICE 'tests.category_path_names converted from TEXT[] to JSONB';
  END IF;
END $$;

-- ============================================================
-- FIX #105: Composite index on test_questions(test_id, section_id)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_test_questions_test_section
  ON test_questions(test_id, section_id);

-- ============================================================
-- FIX #106: Index on attempts.status for filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attempts_status
  ON attempts(status);

-- ============================================================
-- FIX #107: CHECK constraint on attempts.score (non-negative)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_attempts_score_nonneg'
      AND conrelid = 'attempts'::regclass
  ) THEN
    ALTER TABLE attempts ADD CONSTRAINT chk_attempts_score_nonneg CHECK (score >= 0 OR score IS NULL);
    RAISE NOTICE 'Added CHECK constraint chk_attempts_score_nonneg on attempts.score';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL; -- attempts table doesn't exist yet
END $$;

-- ============================================================
-- FIX #108: CHECK constraint on questions.correct_option (valid range 0-9)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_questions_correct_option_range'
      AND conrelid = 'questions'::regclass
  ) THEN
    ALTER TABLE questions ADD CONSTRAINT chk_questions_correct_option_range
      CHECK (correct_option IS NULL OR (correct_option >= 0 AND correct_option <= 9));
    RAISE NOTICE 'Added CHECK constraint chk_questions_correct_option_range on questions.correct_option';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL; -- questions table doesn't exist yet
END $$;

-- ============================================================
-- Additional: Add set_updated_at trigger to practice_sessions (#150)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'practice_sessions') THEN
    DROP TRIGGER IF EXISTS set_updated_at ON practice_sessions;
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON practice_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    RAISE NOTICE 'Added set_updated_at trigger to practice_sessions';
  END IF;
END $$;

-- ============================================================
-- FIX #151: subscriptions.start_date nullable to NOT NULL
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'start_date') THEN
    -- If there are any nulls, backfill them first
    UPDATE subscriptions SET start_date = NOW() WHERE start_date IS NULL;
    ALTER TABLE subscriptions ALTER COLUMN start_date SET NOT NULL;
    RAISE NOTICE 'subscriptions.start_date set to NOT NULL';
  END IF;
END $$;

COMMIT;
