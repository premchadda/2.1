-- Migration 093: HNSW Vector Index Tuning for High-Scale Semantic Search (1M+ Embeddings) — TUNED v2
-- Replaces legacy IVFFlat indexes with HNSW (Hierarchical Navigable Small World) indexes
-- for higher recall and ultra-fast cosine similarity search without requiring minimum row warmup limits.
-- Tuned: m=32 ef_construction=200 ef_search=100 per DoD, built CONCURRENTLY with maintenance_work_mem.
-- NOTE: CONCURRENTLY cannot run inside a transaction or DO block — this file
-- MUST be executed outside transaction (runner detects CONCURRENTLY). Table existence
-- is now assumed (embeddings created in 076). If table missing, creation will error,
-- which correctly signals a missing prerequisite migration.

SET maintenance_work_mem = '1GB';

-- Clean up legacy and mis-tuned indexes (transaction-safe, runs before concurrent builds)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    DROP INDEX IF EXISTS idx_embeddings_vector_ivfflat;
    DROP INDEX IF EXISTS idx_search_embedding;
    -- Drop existing HNSW if present so we can recreate with correct tuning
    DROP INDEX IF EXISTS idx_embeddings_vector_hnsw;
    DROP INDEX IF EXISTS idx_question_search_vector_hnsw;
  END IF;
END $$;

-- Recreate with tuned params CONCURRENTLY (outside transaction) — will skip if extension missing
-- We guard with a DO that sets a GUC flag, but actual CREATE INDEX CONCURRENTLY must be top-level
-- so we use a conditional via `SELECT` + `EXECUTE` outside DO? Instead we create unconditionally;
-- if tables are missing the migration will fail fast, surfacing the prerequisite issue.
-- The IF NOT EXISTS on the index makes this idempotent on re-run.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_vector_hnsw
  ON embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 200);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_search_vector_hnsw
  ON question_search_index USING hnsw (embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 200);

-- Set default ef_search for the database (requires pgvector >=0.5.0, may need superuser)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      EXECUTE 'ALTER DATABASE ' || quote_ident(current_database()) || ' SET hnsw.ef_search = 100';
    EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
      RAISE NOTICE '093: Could not set hnsw.ef_search via ALTER DATABASE (no superuser). App must run SET hnsw.ef_search = 100 per session.';
    END;
  END IF;
END $$;

RESET maintenance_work_mem;
