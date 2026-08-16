-- 069_schema_audit_fixes.sql
-- Consolidated migration to fix schema audit issues

-- 0. Add missing metadata column to revision_queue (created in 018 without it,
--    but required by smartRevision.service.js)
ALTER TABLE revision_queue ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 1. Add missing indexes on high-query columns
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at ON attempts(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_score ON attempts(score DESC);
CREATE INDEX IF NOT EXISTS idx_test_series_is_coming_soon ON test_series(is_coming_soon);
CREATE INDEX IF NOT EXISTS idx_live_tests_test_id ON live_tests(test_id);

-- 2. Fix user_achievements FK (currently points to dropped achievements table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_achievements')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'achievement_definitions')
  THEN
    ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_achievement_id_fkey;
    ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_achievement_id_fkey
      FOREIGN KEY (achievement_id) REFERENCES achievement_definitions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Add updated_at trigger for key tables missing them
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON users; CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON tests; CREATE TRIGGER set_updated_at BEFORE UPDATE ON tests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON questions; CREATE TRIGGER set_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON test_series; CREATE TRIGGER set_updated_at BEFORE UPDATE ON test_series FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON attempts; CREATE TRIGGER set_updated_at BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON subscriptions; CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON enrollments; CREATE TRIGGER set_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON stages; CREATE TRIGGER set_updated_at BEFORE UPDATE ON stages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON exam_categories; CREATE TRIGGER set_updated_at BEFORE UPDATE ON exam_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON exams; CREATE TRIGGER set_updated_at BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON subjects; CREATE TRIGGER set_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON chapters; CREATE TRIGGER set_updated_at BEFORE UPDATE ON chapters FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON topics; CREATE TRIGGER set_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON notifications; CREATE TRIGGER set_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON coupons; CREATE TRIGGER set_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON promotions; CREATE TRIGGER set_updated_at BEFORE UPDATE ON promotions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON banners; CREATE TRIGGER set_updated_at BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON faqs; CREATE TRIGGER set_updated_at BEFORE UPDATE ON faqs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON leaderboards; CREATE TRIGGER set_updated_at BEFORE UPDATE ON leaderboards FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON study_materials; CREATE TRIGGER set_updated_at BEFORE UPDATE ON study_materials FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Fix date_of_birth column from VARCHAR(20) to DATE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'date_of_birth' AND data_type = 'character varying'
  ) THEN
    ALTER TABLE users ALTER COLUMN date_of_birth TYPE DATE USING
      CASE WHEN date_of_birth ~ '^\d{4}-\d{2}-\d{2}$' THEN date_of_birth::date ELSE NULL END;
  END IF;
END $$;

-- 5. Add csrf_tokens cleanup function
CREATE OR REPLACE FUNCTION clean_expired_csrf_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM csrf_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Fix soft delete inconsistency — add is_deleted, deleted_at, deleted_by where missing
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT table_name FROM information_schema.columns WHERE column_name = 'is_active' AND table_schema = 'public' LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false', tbl);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP', tbl);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by INTEGER', tbl);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

-- 7. Document denormalized text columns on questions (only if columns exist)
DO $$
DECLARE
  v_col TEXT;
  v_cols TEXT[] := ARRAY[
    'subject|Denormalized subject name - use subject_id for FK relationship',
    'chapter|Denormalized chapter name - use chapter_id for FK relationship',
    'topic|Denormalized topic name - use topic_id for FK relationship',
    'category|Free-text category - use category_id for FK relationship to exam_categories'
  ];
  v_parts TEXT[];
BEGIN
  FOREACH v_col IN ARRAY v_cols LOOP
    v_parts := string_to_array(v_col, '|');
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'questions' AND column_name = v_parts[1]
                  AND data_type IN ('character varying', 'text')) THEN
      EXECUTE format('COMMENT ON COLUMN questions.%I IS %L', v_parts[1], v_parts[2]);
    END IF;
  END LOOP;
END $$;
