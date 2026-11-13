-- Migration 155: Create question_notes table for student note-taking
-- F6: Adds persistent user-scoped notes for question reviews and practice

CREATE TABLE IF NOT EXISTS public.question_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id VARCHAR NOT NULL,
  context_id VARCHAR,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_question_notes_user_question ON public.question_notes (user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_question_notes_user_context ON public.question_notes (user_id, context_id);
CREATE INDEX IF NOT EXISTS idx_question_notes_user_created ON public.question_notes (user_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.question_notes ENABLE ROW LEVEL SECURITY;

-- Owner and admin RLS policy (no IS NULL bypass)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_notes'
      AND policyname = 'question_notes_user_policy'
  ) THEN
    CREATE POLICY question_notes_user_policy ON public.question_notes
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

-- Role grants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trstprep_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_notes TO trstprep_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_notes TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.question_notes TO service_role;
  END IF;
END $$;
