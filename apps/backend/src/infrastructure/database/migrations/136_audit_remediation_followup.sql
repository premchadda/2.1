-- 136: Audit remediation follow-up (non-concurrent, transactional)
-- ---------------------------------------------------------------------------
-- Non-concurrent by design: migrationRunner wraps this file in BEGIN/COMMIT
-- (see migrationRunner.js), so online index builds that opt out of the
-- transaction block are forbidden here — per the 121:27-30 precedent, plain
-- CREATE INDEX IF NOT EXISTS is used throughout.
-- A later maintenance window may rebuild hot indexes outside a transaction
-- if lock pressure requires it. No explicit BEGIN/COMMIT here — the runner wraps.
--
-- 1. user_topic_stats key reconciliation: backend adaptiveDifficulty.js
--    reads/writes numeric `topic_id`, while analyticsService.js upserts on
--    text `topic` (+ subject). 018 created text `topic`; 028 added
--    `topic_id` + FK + backfill. Both columns must coexist — never
--    drop/rename either. This migration re-asserts both, backfills both
--    directions, and indexes both read paths.
-- 2. audit_logs canonical: 001/002 created+extended it, 019 recreated it,
--    024/092 restored middleware columns. Do NOT create `audit_trail`;
--    base.repository.js allowlists `audit_logs`.
-- 3. reviewCount promotion: smartRevision.service.js keeps reviewCount in
--    revision_queue.metadata JSONB (metadata added by 069). Promote to a
--    dedicated `review_count` INTEGER with backfill; other revision tables
--    are comment-only (see below).
-- 4. Practice-write-path indexes: analyticsService writes
--    wrong_questions(user_id, question_id, ...) and
--    revision_queue(user_id, question_id, due_at, ...) — index both.
--
-- Append-only: every statement is IF NOT EXISTS guarded (or existence
-- checked inside DO blocks). No DROP/TRUNCATE/DELETE anywhere.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 1. user_topic_stats: text `topic` + numeric `topic_id` coexist
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
  ) THEN
    -- Text key used by analyticsService upsert (user_id, topic)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
        AND column_name = 'topic'
    ) THEN
      ALTER TABLE user_topic_stats ADD COLUMN topic VARCHAR(255);
      RAISE NOTICE '136: user_topic_stats.topic column added';
    END IF;

    -- Numeric key used by adaptiveDifficulty (user_id, topic_id); 028 origin
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
        AND column_name = 'topic_id'
    ) THEN
      ALTER TABLE user_topic_stats ADD COLUMN topic_id INTEGER;
      RAISE NOTICE '136: user_topic_stats.topic_id column added';
    END IF;
  END IF;
END $$;

-- FK topic_id -> topics(id), matching 028's constraint name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
      AND column_name = 'topic_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'topics'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_topic_stats'
      AND constraint_name = 'fk_user_topic_stats_topic_id'
  ) THEN
    ALTER TABLE user_topic_stats
      ADD CONSTRAINT fk_user_topic_stats_topic_id
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
    RAISE NOTICE '136: user_topic_stats.topic_id FK added';
  END IF;
END $$;

-- Backfill topic_id from text `topic` (028 logic, extended to subject_topics
-- which weakAreaDetection/topicAnalytics/ranking join against).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
      AND column_name = 'topic_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
      AND column_name = 'topic'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'topics'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'topics'
        AND column_name = 'is_active'
    ) THEN
      EXECUTE $fill$
        UPDATE user_topic_stats uts
        SET topic_id = t.id
        FROM topics t
        WHERE uts.topic_id IS NULL
          AND uts.topic IS NOT NULL
          AND lower(t.name) = lower(uts.topic)
          AND (t.is_active IS NULL OR t.is_active = true)
      $fill$;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'subject_topics'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subject_topics'
        AND column_name = 'is_active'
    ) THEN
      EXECUTE $fill$
        UPDATE user_topic_stats uts
        SET topic_id = t.id
        FROM subject_topics t
        WHERE uts.topic_id IS NULL
          AND uts.topic IS NOT NULL
          AND lower(t.name) = lower(uts.topic)
          AND (t.is_active IS NULL OR t.is_active = true)
      $fill$;
    END IF;

    -- Reverse direction: rows written by adaptiveDifficulty carry only
    -- topic_id, so populate text `topic` for the analyticsService read path.
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'topics'
    ) THEN
      EXECUTE $fill$
        UPDATE user_topic_stats uts
        SET topic = t.name
        FROM topics t
        WHERE uts.topic IS NULL
          AND uts.topic_id IS NOT NULL
          AND t.id = uts.topic_id
      $fill$;
    END IF;
  END IF;
END $$;

-- Indexes for both read paths (adaptiveDifficulty: user_id+topic_id;
-- analyticsService: user_id+topic). Guarded so fresh/partial schemas skip.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
        AND column_name = 'topic'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_topic_stats_topic ON user_topic_stats(topic)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_topic_stats_user_topic ON user_topic_stats(user_id, topic)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_topic_stats'
        AND column_name = 'topic_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_topic_stats_topic_id ON user_topic_stats(topic_id)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_topic_stats_user_topic_id ON user_topic_stats(user_id, topic_id)';
    END IF;
  END IF;
END $$;

-- =====================================================
-- 2. audit_logs is canonical — do NOT create audit_trail
-- =====================================================
-- NOTE: `audit_logs` (001/002, recreated 019, repaired 024/092) is the
-- canonical audit table and is allowlisted in base.repository.js. There is
-- no `audit_trail` table in this codebase; nothing references that name.
-- This migration deliberately creates no audit table — the block below only
-- asserts presence so a missing table surfaces loudly instead of silently.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    RAISE NOTICE '136: audit_logs confirmed canonical (audit_trail must not be created)';
  ELSE
    RAISE WARNING '136: audit_logs table is missing — investigate baseline before proceeding';
  END IF;
END $$;

-- =====================================================
-- 3. reviewCount out of metadata JSONB -> review_count column
-- =====================================================
-- smartRevision.service.js reads/increments metadata->'reviewCount' on
-- revision_queue (metadata column added by 069). Promote it to a dedicated
-- integer so scheduling queries stop parsing JSONB per row.
-- Other revision-adjacent tables (spaced_repetition, user_topic_performance)
-- have no metadata/reviewCount usage in code and no CREATE TABLE in shipped
-- migrations, so they are intentionally comment-only here: if a future
-- migration introduces a metadata-bearing revision table, add an equivalent
-- review_count INTEGER DEFAULT 0 + backfill there.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'revision_queue'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'revision_queue'
        AND column_name = 'review_count'
    ) THEN
      ALTER TABLE revision_queue ADD COLUMN review_count INTEGER DEFAULT 0;
      RAISE NOTICE '136: revision_queue.review_count column added';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'revision_queue'
        AND column_name = 'metadata'
    ) THEN
      EXECUTE $fill$
        UPDATE revision_queue
        SET review_count = CASE
          WHEN metadata->>'reviewCount' ~ '^[0-9]+$'
               AND LENGTH(metadata->>'reviewCount') <= 9
          THEN (metadata->>'reviewCount')::integer
          ELSE review_count
        END
        WHERE metadata IS NOT NULL
          AND (metadata ? 'reviewCount')
          AND (review_count IS NULL OR review_count = 0)
      $fill$;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 4. Practice-write-path indexes (wrong_questions, revision_queue)
-- =====================================================
-- analyticsService upserts wrong_questions ON CONFLICT (user_id, question_id)
-- and inserts revision_queue rows keyed by (user_id, question_id, due_at).
-- NOTE on naming: no `next_review` column exists in the schema — 018 named
-- it `next_review_at` while the practice path (039/069-era) uses `due_at`
-- (smartRevision aliases due_at AS next_review_at in reads). Both existing
-- columns are indexed below following the 019 conditional-index precedent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wrong_questions'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wrong_questions'
      AND column_name = 'user_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wrong_questions'
      AND column_name = 'question_id'
  ) THEN
    -- Same name as 019's index: no-op on schemas where 019 already ran.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_wrong_questions_user_question ON wrong_questions(user_id, question_id)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'revision_queue'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'revision_queue'
      AND column_name = 'user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'revision_queue'
        AND column_name = 'next_review_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_revision_queue_user_next_review ON revision_queue(user_id, next_review_at)';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'revision_queue'
        AND column_name = 'due_at'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_revision_queue_user_due_at ON revision_queue(user_id, due_at)';
    END IF;
  END IF;
END $$;
