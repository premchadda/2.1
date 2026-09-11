-- 137: Rename subject_topics index for naming consistency (non-concurrent, transactional)
-- ---------------------------------------------------------------------------
-- Non-concurrent by design: migrationRunner wraps this file in BEGIN/COMMIT
-- (see migrationRunner.js), so plain CREATE INDEX IF NOT EXISTS is used
-- throughout. No explicit transaction control here — the runner wraps.
--
-- Context: a working-tree edit renamed an index inside shipped
-- 134_database_audit_remediation.sql; shipped files are append-only and must
-- never be edited. This follow-up redelivers that rename properly:
--   idx_topics_subject -> idx_subject_topics_subject
-- Append-only: idempotent, guarded by pg_indexes checks. No DROP/TRUNCATE/DELETE.
-- ---------------------------------------------------------------------------

-- Rename legacy index name when present (guarded, transactional-safe).
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_topics_subject') THEN EXECUTE 'ALTER INDEX public.idx_topics_subject RENAME TO idx_subject_topics_subject'; END IF; END $$;

-- Ensure the canonical index exists (covers fresh DBs where 134 never created
-- the old name). Guarded on table + column existence so a partial schema
-- skips instead of failing the whole migration run.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subject_topics')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subject_topics' AND column_name='subject_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subject_topics_subject ON subject_topics(subject_id)';
  END IF;
END $$;
