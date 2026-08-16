-- Migration 113: leaderboards config-table columns, nullable user_id,
-- tag_configs description/filter_value, promotions type constraint extension.
--
-- Rationale:
--   * leaderboards was created by migration 095 as a per-user SCORE-ROWS table
--     (test_id, user_id NOT NULL, score, rank, percentile, batch_date), but
--     leaderboards-admin.js treats it as a CONFIG table (name, description,
--     type, scope, scope_id, period, start/end dates, ranking_criteria,
--     is_published, show_on_homepage, max_rankings, rankings,
--     total_participants, is_archived, last_calculated_at, created_by).
--     Add the missing config columns idempotently and drop the NOT NULL on
--     user_id so config rows (no owning user) can be inserted. Score rows and
--     config rows coexist: config rows simply have a NULL user_id.
--   * Migration 032 only adds is_deleted when is_active already exists; the
--     095 baseline leaderboards has neither, so re-assert the soft-delete
--     column set here.
--   * tag_configs (098:82-94) has no description or filter_value columns, but
--     TagConfigsManager (admin panel) and admin-navigation-tags.js now
--     persist both. Add them.
--   * promotions_type_chk (migration 040) allows only
--     'discount','trial','credits','cashback','referral','seasonal','flash',
--     'first_purchase','renewal' (+ NULL). The admin panel's trial-extension
--     feature needs 'trial_extension'. Extend the allowed list; do NOT touch
--     promotions_status_chk ('active','expired','draft','paused' — migration
--     036) because no other status value is used by the panel.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS +
-- CREATE INDEX IF NOT EXISTS everywhere. Defensive: every ALTER/CREATE INDEX
-- wrapped in exception-safe DO $$ blocks so a missing table never aborts the
-- whole migration (mirrors 110/111/112 style).

BEGIN;

-- =====================================================
-- 1. leaderboards: admin-panel config columns
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'leaderboards') THEN
    RAISE NOTICE 'Migration 113: skipping leaderboards (table does not exist)';
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'test';
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS scope VARCHAR(50) DEFAULT 'global';
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS scope_id VARCHAR(100);
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS period VARCHAR(50) DEFAULT 'all-time';
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS ranking_criteria JSONB DEFAULT '["score","timeTaken"]'::jsonb;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN DEFAULT false;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS max_rankings INTEGER DEFAULT 100;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS rankings JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS total_participants INTEGER DEFAULT 0;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS created_by INTEGER;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS deleted_by INTEGER;
  EXCEPTION WHEN OTHERS THEN
    -- Never abort the migration because one table misbehaves
    RAISE NOTICE 'Migration 113: skipping leaderboards columns: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 2. leaderboards: allow config rows (user_id NULL)
--    The unique index idx_leaderboards_unique
--    (test_id, user_id, batch_date) keeps protecting
--    score rows — NULL user_id/test_id rows are not
--    covered by a B-tree unique index (PostgreSQL:
--    NULL != NULL), so config rows never collide.
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'leaderboards') THEN
    RAISE NOTICE 'Migration 113: skipping leaderboards user_id NOT NULL drop (table does not exist)';
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE leaderboards ALTER COLUMN user_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration 113: skipping leaderboards user_id NOT NULL drop: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 3. leaderboards: lookup indexes
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'leaderboards') THEN
    RETURN;
  END IF;
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_leaderboards_type ON leaderboards(type);
    CREATE INDEX IF NOT EXISTS idx_leaderboards_is_deleted ON leaderboards (is_deleted) WHERE is_deleted = true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration 113: skipping leaderboards indexes: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 4. tag_configs: description + filter_value columns
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'tag_configs') THEN
    RAISE NOTICE 'Migration 113: skipping tag_configs (table does not exist)';
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE tag_configs ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE tag_configs ADD COLUMN IF NOT EXISTS filter_value VARCHAR(255);
    -- Optional category column (not present in the 098 baseline); index only
    -- when the column exists so a future baseline can enable it cheaply.
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'tag_configs'
                  AND column_name = 'category') THEN
      CREATE INDEX IF NOT EXISTS idx_tag_configs_category ON tag_configs(category);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration 113: skipping tag_configs columns: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 5. promotions: extend type CHECK with 'trial_extension'
--    (existing 040 list kept verbatim; status constraint
--     untouched — 036 list is complete for the panel)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'promotions') THEN
    RAISE NOTICE 'Migration 113: skipping promotions type constraint (table does not exist)';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'promotions'
                    AND column_name = 'type') THEN
    RAISE NOTICE 'Migration 113: skipping promotions type constraint (type column missing)';
    RETURN;
  END IF;
  BEGIN
    EXECUTE 'ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_type_chk';
    EXECUTE $sql$ALTER TABLE promotions
              ADD CONSTRAINT promotions_type_chk
              CHECK (type IS NULL OR LOWER(type) IN (
                'discount','trial','credits','cashback','referral','seasonal','flash','first_purchase','renewal','trial_extension'
              ))$sql$;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration 113: skipping promotions type constraint: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 6. subjects: admin-panel column backfill
--    The 108 baseline only creates name/slug/icon/is_active;
--    the panel (StudyMaterialsManager/SubjectHierarchyManager),
--    the subjects seeder and public routes (study.js, practice.js)
--    expect color/description/parent_id/sort_order/subject_group/"order".
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'subjects') THEN
    RAISE NOTICE 'Migration 113: skipping subjects (table does not exist)';
    RETURN;
  END IF;
  BEGIN
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS color VARCHAR(20);
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE;
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_group VARCHAR(255);
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_subjects_parent_id ON subjects(parent_id) WHERE parent_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_subjects_sort_order ON subjects(sort_order);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration 113: skipping subjects columns: %', SQLERRM;
  END;
END $$;

COMMIT;
