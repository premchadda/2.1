-- Migration 049: Fix critical FK issues and missing columns
-- All backfills wrapped in EXCEPTION blocks to prevent one failure from blocking others

-- ========== UNITS TABLE ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'subject_id') THEN
    ALTER TABLE units ADD COLUMN subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE;
    CREATE INDEX idx_units_subject_id ON units(subject_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'part_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'subject_id') THEN
    UPDATE units u
    SET subject_id = sp.subject_id
    FROM subject_parts sp
    WHERE u.part_id = sp.id
      AND u.subject_id IS NULL
      AND EXISTS (SELECT 1 FROM subjects s WHERE s.id = sp.subject_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 049: units backfill skipped — %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_units_subject_id_active ON units(subject_id, is_active);

-- ========== TOPICS TABLE ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'subject_id') THEN
    ALTER TABLE topics ADD COLUMN subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL;
    CREATE INDEX idx_topics_subject_id ON topics(subject_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'importance') THEN
    ALTER TABLE topics ADD COLUMN importance VARCHAR(20) DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'frequently_asked') THEN
    ALTER TABLE topics ADD COLUMN frequently_asked BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'estimated_questions') THEN
    ALTER TABLE topics ADD COLUMN estimated_questions INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'difficulty') THEN
    ALTER TABLE topics ADD COLUMN difficulty VARCHAR(20) DEFAULT 'Mixed';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapters' AND column_name = 'study_material_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'subject_id') THEN
    UPDATE topics t
    SET subject_id = c.study_material_id
    FROM chapters c
    WHERE t.chapter_id = c.id
      AND t.subject_id IS NULL
      AND EXISTS (SELECT 1 FROM subjects s WHERE s.id = c.study_material_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 049: topics backfill skipped — %', SQLERRM;
END $$;

-- ========== TESTS TABLE ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'passing_marks') THEN
    ALTER TABLE tests ADD COLUMN passing_marks INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'instructions') THEN
    ALTER TABLE tests ADD COLUMN instructions TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'shuffle_questions') THEN
    ALTER TABLE tests ADD COLUMN shuffle_questions BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'shuffle_options') THEN
    ALTER TABLE tests ADD COLUMN shuffle_options BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'allow_review') THEN
    ALTER TABLE tests ADD COLUMN allow_review BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'max_attempts') THEN
    ALTER TABLE tests ADD COLUMN max_attempts INTEGER;
  END IF;
END $$;

-- ========== TEST_SERIES TABLE ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'is_pro') THEN
    ALTER TABLE test_series ADD COLUMN is_pro BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'price') THEN
    ALTER TABLE test_series ADD COLUMN price NUMERIC(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'difficulty') THEN
    ALTER TABLE test_series ADD COLUMN difficulty VARCHAR(20) DEFAULT 'Medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'tags') THEN
    ALTER TABLE test_series ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'is_pinned') THEN
    ALTER TABLE test_series ADD COLUMN is_pinned BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'exam_category_id') THEN
    ALTER TABLE test_series ADD COLUMN exam_category_id INTEGER REFERENCES exam_categories(id) ON DELETE SET NULL;
    CREATE INDEX idx_test_series_exam_category_id ON test_series(exam_category_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'exam_id_fk') THEN
    ALTER TABLE test_series ADD COLUMN exam_id_fk INTEGER REFERENCES exams(id) ON DELETE SET NULL;
    CREATE INDEX idx_test_series_exam_id_fk ON test_series(exam_id_fk);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_categories' AND column_name = 'slug')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_categories' AND column_name = 'name')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'category') THEN
    UPDATE test_series ts
    SET exam_category_id = ec.id
    FROM exam_categories ec
    WHERE ts.exam_category_id IS NULL
      AND (ts.category::text = ec.slug::text OR ts.category::text = ec.name::text);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 049: test_series exam_category backfill skipped — %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'exam_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'subcategory')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'exam_id') THEN
    UPDATE test_series ts
    SET exam_id_fk = e.id
    FROM exams e
    WHERE ts.exam_id_fk IS NULL
      AND (ts.subcategory::text = e.exam_id::text OR ts.exam_id::text = e.exam_id::text);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 049: test_series exam_id backfill skipped — %', SQLERRM;
END $$;

-- ========== EXAM_INFO TABLE ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_info' AND column_name = 'series_id_int') THEN
    ALTER TABLE exam_info ADD COLUMN series_id_int INTEGER REFERENCES test_series(id) ON DELETE SET NULL;
    CREATE INDEX idx_exam_info_series_id_int ON exam_info(series_id_int);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_info' AND column_name = 'series_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_info' AND column_name = 'series_id_int') THEN
    UPDATE exam_info ei
    SET series_id_int = CAST(ei.series_id AS INTEGER)
    WHERE ei.series_id IS NOT NULL
      AND ei.series_id ~ '^[0-9]+$'
      AND ei.series_id_int IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 049: exam_info backfill skipped — %', SQLERRM;
END $$;
