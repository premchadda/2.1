-- =====================================================
-- Migration 033: Reconcile subtopics Definitions
-- Purpose: The subtopics table was defined twice:
--            026-add-subtopics-assets-resources.sql:19
--            postgres-helpers.js:1333
--          Migration 026 takes precedence (newer, lives
--          in repo, has the topic_id FK). The
--          postgres-helpers.js variant adds icon,
--          stage_ids, order_index. We add any missing
--          columns from postgres-helpers.js to the live
--          schema so that the existing
--          CREATE TABLE IF NOT EXISTS doesn't leave the
--          columns out on a freshly-restored DB.
--
--          Resolves audit issue:
--            M3  - subtopics defined twice
--
-- Idempotent: ADD COLUMN IF NOT EXISTS for each of the
--             three reconciling columns.
-- Depends on: 026-add-subtopics-assets-resources.sql.
-- =====================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'subtopics') THEN
    RAISE WARNING 'subtopics table does not exist; migration 033 skipped';
    RETURN;
  END IF;

  -- Add icon, stage_ids, order_index if missing.
  -- These are the columns that postgres-helpers.js
  -- declares but the migration left out.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'subtopics' AND column_name = 'icon'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN icon VARCHAR(100);
    RAISE NOTICE 'subtopics: added icon VARCHAR(100)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'subtopics' AND column_name = 'stage_ids'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN stage_ids INTEGER[] DEFAULT '{}';
    RAISE NOTICE 'subtopics: added stage_ids INTEGER[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'subtopics' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN order_index INTEGER DEFAULT 0;
    RAISE NOTICE 'subtopics: added order_index INTEGER';
  END IF;

  -- description is also referenced in the codebase
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'subtopics' AND column_name = 'description'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN description TEXT;
    RAISE NOTICE 'subtopics: added description TEXT';
  END IF;

  -- is_active / public_id / public_id_uuid (mentioned in
  -- ENTITY_PREFIXES / RELATIONSHIP_DEFINITIONS) — kept
  -- defensive since the postgres-helpers.js variant
  -- assumes them.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'subtopics' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'subtopics: added is_active BOOLEAN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'subtopics' AND column_name = 'public_id_uuid'
  ) THEN
    ALTER TABLE subtopics ADD COLUMN public_id_uuid UUID DEFAULT gen_random_uuid();
    RAISE NOTICE 'subtopics: added public_id_uuid UUID';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'subtopics' AND column_name = 'public_id'
  ) THEN
    ALTER TABLE subtopics
      ADD COLUMN public_id TEXT
        GENERATED ALWAYS AS ('stp_' || public_id_uuid::text) STORED;
    RAISE NOTICE 'subtopics: added public_id TEXT (generated)';
  END IF;
END $$;

-- Indexes referenced by the codebase
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE tablename = 'subtopics'
                    AND indexname = 'idx_subtopics_public_id') THEN
    CREATE UNIQUE INDEX idx_subtopics_public_id ON subtopics(public_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE tablename = 'subtopics'
                    AND indexname = 'idx_subtopics_stage_ids') THEN
    CREATE INDEX idx_subtopics_stage_ids ON subtopics USING GIN(stage_ids);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE tablename = 'subtopics'
                    AND indexname = 'idx_subtopics_order_index') THEN
    CREATE INDEX idx_subtopics_order_index ON subtopics(order_index);
  END IF;
END $$;

COMMIT;
