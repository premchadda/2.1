-- 138: Practice/revision pipeline schema reconciliation (non-concurrent, transactional)
-- ---------------------------------------------------------------------------
-- Non-concurrent by design: migrationRunner wraps this file in BEGIN/COMMIT
-- (see migrationRunner.js). Plain ADD COLUMN / CREATE INDEX IF NOT EXISTS only.
--
-- Context: the live database has drifted ahead of the shipped migrations.
-- The practice wrong-path bridge (practice.js), the practice analytics
-- bridge (analyticsService.recordPracticeAnalytics), and smartRevision all
-- reference columns that code writes but NO shipped migration creates:
--   wrong_questions:  source_attempt_id, test_id, last_seen_at, metadata, is_active
--   revision_queue:  source_attempt_id, schedule_day, due_at, status, completed_at, priority, metadata
--   practice_answers: is_skipped, time_taken_sec, mode
-- The live DB already has these (verified via information_schema); this
-- migration reconciles the repo baseline so a fresh environment matches
-- what the code actually writes.
--
-- FK NOTE: wrong_questions.source_attempt_id and
-- revision_queue.source_attempt_id are INTEGER FKs to attempts(id). Practice
-- sessions have no attempts row, so practice-path inserts MUST leave the
-- column NULL — never a 'practice:<sessionId>' sentinel string.
--
-- Append-only: every statement is IF NOT EXISTS / existence-guarded.
-- No DROP/TRUNCATE/DELETE anywhere.
-- ---------------------------------------------------------------------------

-- =====================================================
-- 1. wrong_questions: columns used by the wrong-path writers
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wrong_questions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wrong_questions' AND column_name='test_id') THEN
      ALTER TABLE wrong_questions ADD COLUMN test_id INTEGER;
      RAISE NOTICE '138: wrong_questions.test_id added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wrong_questions' AND column_name='source_attempt_id') THEN
      ALTER TABLE wrong_questions ADD COLUMN source_attempt_id INTEGER;
      RAISE NOTICE '138: wrong_questions.source_attempt_id added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wrong_questions' AND column_name='last_seen_at') THEN
      ALTER TABLE wrong_questions ADD COLUMN last_seen_at TIMESTAMP;
      RAISE NOTICE '138: wrong_questions.last_seen_at added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wrong_questions' AND column_name='metadata') THEN
      ALTER TABLE wrong_questions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
      RAISE NOTICE '138: wrong_questions.metadata added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wrong_questions' AND column_name='is_active') THEN
      ALTER TABLE wrong_questions ADD COLUMN is_active BOOLEAN DEFAULT true;
      RAISE NOTICE '138: wrong_questions.is_active added';
    END IF;
  END IF;
END $$;

-- Unique (user_id, question_id) — required by the wrong_questions upserts
-- (practice.js wrong-path bridge and analyticsService.upsertWrongQuestions).
-- The live DB already carries this as a constraint; guard on both constraint
-- AND index forms so fresh and drifted schemas converge.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wrong_questions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wrong_questions' AND column_name='question_id') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND tablename='wrong_questions'
        AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%user_id%' AND indexdef LIKE '%question_id%'
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wrong_questions_user_question_unique
        ON wrong_questions(user_id, question_id);
      RAISE NOTICE '138: wrong_questions (user_id, question_id) unique index added';
    END IF;
  END IF;
END $$;

-- =====================================================
-- 2. revision_queue: columns used by the SRS writers
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='revision_queue') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='source_attempt_id') THEN
      ALTER TABLE revision_queue ADD COLUMN source_attempt_id INTEGER;
      RAISE NOTICE '138: revision_queue.source_attempt_id added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='schedule_day') THEN
      ALTER TABLE revision_queue ADD COLUMN schedule_day INTEGER;
      RAISE NOTICE '138: revision_queue.schedule_day added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='due_at') THEN
      ALTER TABLE revision_queue ADD COLUMN due_at TIMESTAMP;
      RAISE NOTICE '138: revision_queue.due_at added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='status') THEN
      ALTER TABLE revision_queue ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
      RAISE NOTICE '138: revision_queue.status added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='completed_at') THEN
      ALTER TABLE revision_queue ADD COLUMN completed_at TIMESTAMP;
      RAISE NOTICE '138: revision_queue.completed_at added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='priority') THEN
      -- priority is INTEGER in the live schema (smartRevision writes ints)
      ALTER TABLE revision_queue ADD COLUMN priority INTEGER DEFAULT 1;
      RAISE NOTICE '138: revision_queue.priority added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='metadata') THEN
      ALTER TABLE revision_queue ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
      RAISE NOTICE '138: revision_queue.metadata added';
    END IF;
  END IF;
END $$;

-- Partial unique index for practice-path rows (source_attempt_id IS NULL).
-- The full unique constraint (user_id, question_id, source_attempt_id,
-- schedule_day) cannot match practice rows: Postgres treats NULLs as
-- distinct, so ON CONFLICT would never fire and repeated wrong answers
-- would pile up duplicate schedule rows. This partial index gives the
-- practice bridge a real conflict target: (user_id, question_id, schedule_day)
-- among practice-origin rows only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='revision_queue')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='schedule_day')
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname='public' AND tablename='revision_queue'
         AND indexname='idx_revision_queue_practice_unique'
     ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_revision_queue_practice_unique
      ON revision_queue(user_id, question_id, schedule_day)
      WHERE source_attempt_id IS NULL';
    RAISE NOTICE '138: revision_queue practice partial unique index added';
  END IF;
END $$;

-- Full unique index for TEST-path upserts (source_attempt_id NOT NULL):
-- analyticsService.upsert/enqueueRevisionRows and learningService use
-- ON CONFLICT (user_id, question_id, source_attempt_id, schedule_day) with
-- no WHERE clause, which requires this exact 4-column unique index to exist
-- or every test submission's revision enqueue 42P10s. The live DB carries it
-- as a CONSTRAINT (revision_queue_user_id_question_id_source_attempt_id_
-- schedu_key); fresh environments get the equivalent index here.
-- NOTE: NULLs are distinct in Postgres unique indexes, so this full index
-- never conflicts with the partial (source_attempt_id IS NULL) one above.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='revision_queue')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='source_attempt_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='revision_queue' AND column_name='schedule_day')
     AND NOT EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname='public' AND tablename='revision_queue'
         -- Match ONLY the full 4-column form; the partial practice index
         -- above also contains 'UNIQUE' + 'source_attempt_id' (in its WHERE
         -- clause) and must not satisfy this guard.
         AND indexdef LIKE '%(user_id, question_id, source_attempt_id, schedule_day)%'
     ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_revision_queue_test_unique
      ON revision_queue(user_id, question_id, source_attempt_id, schedule_day)';
    RAISE NOTICE '138: revision_queue full (test-path) unique index added';
  END IF;
END $$;

-- =====================================================
-- 3. practice_answers: columns the practice engine writes
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='practice_answers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='practice_answers' AND column_name='is_skipped') THEN
      ALTER TABLE practice_answers ADD COLUMN is_skipped BOOLEAN DEFAULT false;
      RAISE NOTICE '138: practice_answers.is_skipped added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='practice_answers' AND column_name='time_taken_sec') THEN
      ALTER TABLE practice_answers ADD COLUMN time_taken_sec INTEGER DEFAULT 0;
      RAISE NOTICE '138: practice_answers.time_taken_sec added';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='practice_answers' AND column_name='mode') THEN
      ALTER TABLE practice_answers ADD COLUMN mode VARCHAR(20) DEFAULT 'practice';
      RAISE NOTICE '138: practice_answers.mode added';
    END IF;
  END IF;
END $$;
