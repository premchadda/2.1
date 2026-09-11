-- 139: user_recommendations schema reconciliation (non-concurrent, transactional)
-- ---------------------------------------------------------------------------
-- Non-concurrent by design: migrationRunner wraps this file in BEGIN/COMMIT
-- (see migrationRunner.js). Plain ADD COLUMN / CREATE INDEX IF NOT EXISTS only.
--
-- Context: the live database has drifted ahead of the shipped migrations.
-- The recommendation pipeline (recommendationService.js) writes columns
-- that NO shipped migration creates. The baseline (108) defines
-- user_recommendations with metadata/created_at, but the code writes:
--   user_recommendations: payload, generated_at, expires_at, is_active, updated_at
-- The live DB already has these (verified via information_schema); this
-- migration reconciles the repo baseline so a fresh environment matches
-- what the code actually writes. Soft-delete columns (is_deleted/deleted_at/
-- deleted_by) were added by migration 111's table loop and are included
-- here as existence-guarded additions for fresh environments.
--
-- Service behavior note: recommendationService.saveRecommendations now
-- deactivates the previous active row (is_active = false) before inserting
-- the new one, bounding history to one active row per (user, type).
-- This migration also backfills is_active = true for pre-existing rows so
-- old rows are not re-read after the service change ships.
--
-- Append-only: every statement is IF NOT EXISTS / existence-guarded.
-- No DROP/TRUNCATE/DELETE anywhere.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 1. Ensure the table exists (baseline for fresh environments)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(100),
    entity_id INTEGER,
    score NUMERIC(5, 2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. Columns the recommendation pipeline writes
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='payload') THEN
    ALTER TABLE user_recommendations ADD COLUMN payload JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE '139: user_recommendations.payload added';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='generated_at') THEN
    ALTER TABLE user_recommendations ADD COLUMN generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    RAISE NOTICE '139: user_recommendations.generated_at added';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='expires_at') THEN
    ALTER TABLE user_recommendations ADD COLUMN expires_at TIMESTAMP;
    RAISE NOTICE '139: user_recommendations.expires_at added';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='is_active') THEN
    ALTER TABLE user_recommendations ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE '139: user_recommendations.is_active added';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='updated_at') THEN
    ALTER TABLE user_recommendations ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    RAISE NOTICE '139: user_recommendations.updated_at added';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='is_deleted') THEN
    ALTER TABLE user_recommendations ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    RAISE NOTICE '139: user_recommendations.is_deleted added';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='deleted_at') THEN
    ALTER TABLE user_recommendations ADD COLUMN deleted_at TIMESTAMP;
    RAISE NOTICE '139: user_recommendations.deleted_at added';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='deleted_by') THEN
    ALTER TABLE user_recommendations ADD COLUMN deleted_by INTEGER;
    RAISE NOTICE '139: user_recommendations.deleted_by added';
  END IF;
END $$;

-- =====================================================
-- 3. Indexes for the service's active-row lookups
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_id
  ON user_recommendations (user_id);

CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_id_type_active
  ON user_recommendations (user_id, recommendation_type, is_active)
  WHERE is_active = true;

-- =====================================================
-- 4. Backfill: mark pre-existing rows active so the
--    deactivation-on-save pattern doesn't orphan them
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_recommendations' AND column_name='is_active'
  ) THEN
    UPDATE user_recommendations
    SET is_active = true
    WHERE is_active IS NULL;
    RAISE NOTICE '139: user_recommendations is_active NULLs backfilled';
  END IF;
END $$;
