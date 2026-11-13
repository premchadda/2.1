-- Migration 156: Create fundamental_drill_sessions and exam_cutoffs tables
-- F6: Adds session history for speed drills and historical cutoffs for exam catalog

-- 1. fundamental_drill_sessions
CREATE TABLE IF NOT EXISTS public.fundamental_drill_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category VARCHAR NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  duration_ms INTEGER,
  accuracy NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundamental_drill_sessions_user_created ON public.fundamental_drill_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fundamental_drill_sessions_category ON public.fundamental_drill_sessions (category);

ALTER TABLE public.fundamental_drill_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fundamental_drill_sessions'
      AND policyname = 'fundamental_drill_sessions_user_policy'
  ) THEN
    CREATE POLICY fundamental_drill_sessions_user_policy ON public.fundamental_drill_sessions
      FOR ALL
      USING (
        ((user_id)::text = (auth.uid())::text)
        OR (current_user_id_setting() = user_id)
        OR (current_setting('role'::text, true) = 'service_role'::text)
        OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text)
        OR (current_is_admin() = true)
      )
      WITH CHECK (
        ((user_id)::text = (auth.uid())::text)
        OR (current_user_id_setting() = user_id)
        OR (current_setting('role'::text, true) = 'service_role'::text)
        OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text)
        OR (current_is_admin() = true)
      );
  END IF;
END $$;

-- 2. exam_cutoffs
CREATE TABLE IF NOT EXISTS public.exam_cutoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id VARCHAR NOT NULL,
  category VARCHAR NOT NULL DEFAULT 'UR',
  year INTEGER NOT NULL,
  cutoff_marks NUMERIC(6,2) NOT NULL,
  total_marks NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_exam_cutoffs_exam_category_year UNIQUE (exam_id, category, year)
);

CREATE INDEX IF NOT EXISTS idx_exam_cutoffs_exam_year ON public.exam_cutoffs (exam_id, year);

ALTER TABLE public.exam_cutoffs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_cutoffs'
      AND policyname = 'exam_cutoffs_public_read'
  ) THEN
    CREATE POLICY exam_cutoffs_public_read ON public.exam_cutoffs
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_cutoffs'
      AND policyname = 'exam_cutoffs_admin_write'
  ) THEN
    CREATE POLICY exam_cutoffs_admin_write ON public.exam_cutoffs
      FOR ALL
      USING (
        (current_setting('role'::text, true) = 'service_role'::text)
        OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text)
        OR (current_is_admin() = true)
      )
      WITH CHECK (
        (current_setting('role'::text, true) = 'service_role'::text)
        OR (current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text)
        OR (current_is_admin() = true)
      );
  END IF;
END $$;

-- Role grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trstprep_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fundamental_drill_sessions TO trstprep_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exam_cutoffs TO trstprep_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fundamental_drill_sessions TO authenticated;
    GRANT SELECT ON TABLE public.exam_cutoffs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON TABLE public.exam_cutoffs TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.fundamental_drill_sessions TO service_role;
    GRANT ALL ON TABLE public.exam_cutoffs TO service_role;
  END IF;
END $$;
