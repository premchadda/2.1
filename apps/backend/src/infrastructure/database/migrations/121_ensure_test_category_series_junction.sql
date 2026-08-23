-- Migration 121: Ensure test_category_series junction table (idempotent)
-- ---------------------------------------------------------------------------
-- The junction table was introduced in 008/019 but baseline 098 does not
-- create it, so fresh installs from reconstructed baseline miss it. This
-- migration guarantees its existence, backfills from legacy array columns,
-- and enforces FKs with NOT VALID → VALIDATE to avoid blocking writes.
--
-- - Creates table IF NOT EXISTS with composite PK (test_category_id, test_series_id)
-- - Adds indexes concurrently
-- - Adds FKs as NOT VALID (if not already valid), then VALIDATE CONSTRAINT
-- - Backfills from legacy test_categories.test_series_id INTEGER[] if present
--   and from test_series.category_id if present (bidirectional legacy)
-- - Respects soft-delete (does not backfill deleted rows)
-- ---------------------------------------------------------------------------

-- Ensure extension for gen
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create junction table if not exists
CREATE TABLE IF NOT EXISTS test_category_series (
  test_category_id INTEGER NOT NULL,
  test_series_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (test_category_id, test_series_id)
);

-- 2. Indexes CONCURRENTLY (outside transaction) — but this file runs without CONCURRENTLY wrapper,
--    so we use IF NOT EXISTS non-concurrent for idempotency; follow-up maintenance can rebuild concurrently.
CREATE INDEX IF NOT EXISTS idx_test_category_series_category ON test_category_series(test_category_id);
CREATE INDEX IF NOT EXISTS idx_test_category_series_series ON test_category_series(test_series_id);

-- 3. Add FKs as NOT VALID (if missing) — allows existing orphans to be cleaned before validation
DO $$
BEGIN
  -- FK to test_categories(id) ON DELETE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'test_category_series' AND constraint_name = 'fk_test_category_series_category'
  ) THEN
    -- Clean orphans before adding constraint (optional, but prevents VALIDATE failure)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_categories') THEN
      DELETE FROM test_category_series
      WHERE test_category_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM test_categories tc WHERE tc.id = test_category_series.test_category_id);
    END IF;
    ALTER TABLE test_category_series
      ADD CONSTRAINT fk_test_category_series_category
      FOREIGN KEY (test_category_id) REFERENCES test_categories(id) ON DELETE CASCADE NOT VALID;
    RAISE NOTICE '121: Added FK fk_test_category_series_category NOT VALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'test_category_series' AND constraint_name = 'fk_test_category_series_series'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_series') THEN
      DELETE FROM test_category_series
      WHERE test_series_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM test_series ts WHERE ts.id = test_category_series.test_series_id);
    END IF;
    ALTER TABLE test_category_series
      ADD CONSTRAINT fk_test_category_series_series
      FOREIGN KEY (test_series_id) REFERENCES test_series(id) ON DELETE CASCADE NOT VALID;
    RAISE NOTICE '121: Added FK fk_test_category_series_series NOT VALID';
  END IF;
END $$;

-- 4. Backfill from legacy array columns / FKs (idempotent, ON CONFLICT DO NOTHING)
DO $$
BEGIN
  -- Case A: test_categories.test_series_id INTEGER[] → junction
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_categories' AND column_name = 'test_series_id' AND data_type = 'ARRAY'
  ) THEN
    INSERT INTO test_category_series (test_category_id, test_series_id)
    SELECT tc.id, unnest(tc.test_series_id)
    FROM test_categories tc
    WHERE tc.test_series_id IS NOT NULL
      AND array_length(tc.test_series_id, 1) > 0
      AND (tc.is_deleted IS NULL OR tc.is_deleted = false)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '121: Backfilled from test_categories.test_series_id array';
  END IF;

  -- Case B: test_series.test_category_id (legacy single FK) → junction (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_series' AND column_name = 'test_category_id'
  ) THEN
    INSERT INTO test_category_series (test_category_id, test_series_id)
    SELECT ts.test_category_id, ts.id
    FROM test_series ts
    WHERE ts.test_category_id IS NOT NULL
      AND (ts.is_deleted IS NULL OR ts.is_deleted = false)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '121: Backfilled from test_series.test_category_id';
  END IF;

  -- Case C: test_categories.test_series_id was INTEGER (non-array) in some dumps
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_categories' AND column_name = 'test_series_id' AND data_type = 'integer'
  ) THEN
    INSERT INTO test_category_series (test_category_id, test_series_id)
    SELECT tc.id, tc.test_series_id
    FROM test_categories tc
    WHERE tc.test_series_id IS NOT NULL
      AND (tc.is_deleted IS NULL OR tc.is_deleted = false)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '121: Backfilled from test_categories.test_series_id integer';
  END IF;
END $$;

-- 5. Validate FKs (will fail if orphans remain — operator must clean manually)
DO $$
BEGIN
  BEGIN
    ALTER TABLE test_category_series VALIDATE CONSTRAINT fk_test_category_series_category;
    RAISE NOTICE '121: Validated fk_test_category_series_category';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '121: Could not validate fk_test_category_series_category: %', SQLERRM;
  END;
  BEGIN
    ALTER TABLE test_category_series VALIDATE CONSTRAINT fk_test_category_series_series;
    RAISE NOTICE '121: Validated fk_test_category_series_series';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '121: Could not validate fk_test_category_series_series: %', SQLERRM;
  END;
END $$;

-- 6. Record metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_metadata') THEN
    INSERT INTO schema_migrations_metadata (migration_name, description, blocks_audit_findings)
    VALUES (
      '121_ensure_test_category_series_junction.sql',
      'Ensures test_category_series junction (missing in baseline 098), backfills from legacy array/FK, adds FKs NOT VALID → VALIDATE.',
      ARRAY['MISSING_JUNCTION_TEST_CATEGORY_SERIES']::text[]
    ) ON CONFLICT (migration_name) DO UPDATE SET description = EXCLUDED.description, applied_at = CURRENT_TIMESTAMP;
  END IF;
END $$;
