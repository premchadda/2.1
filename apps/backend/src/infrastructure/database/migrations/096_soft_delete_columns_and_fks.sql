-- Migration 096: Add soft-delete columns to tables that use soft_delete_record()
-- Phase 7.4: soft_delete_record() RPC expects 4 columns (is_active, deleted_by,
-- deleted_at, deleted_reason) but most tables only have is_active.

-- Apply to all tables that are soft-deleted via dbHelpers.softDelete() but
-- don't yet have the full soft-delete column set.
DO $$
DECLARE
  t TEXT;
  tables_to_update TEXT[] := ARRAY[
    'subjects', 'chapters', 'topics', 'subtopics', 'units', 'subject_parts',
    'tests', 'test_series', 'questions', 'sections', 'stages',
    'exam_categories', 'exams', 'exam_info', 'exam_seasons', 'exam_yearly_data', 'exam_updates',
    'coupons', 'subscription_plans', 'promotions', 'banners', 'faqs',
    'notifications', 'email_templates', 'navigation_config',
    'tag_configs', 'study_materials', 'subject_videos', 'subject_pdfs', 'topic_tests',
    'current_affairs', 'blogs', 'doubts', 'study_groups', 'discussions',
    'leaderboards', 'results', 'subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_update LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by INTEGER', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_reason TEXT', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_deleted_at ON %I(deleted_at) WHERE deleted_at IS NOT NULL', t, t);
    EXCEPTION WHEN OTHERS THEN
      -- Table may not exist — skip silently
      RAISE NOTICE 'Skipping %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- Add missing FKs (Phase 7.6)
DO $$
BEGIN
  BEGIN
    ALTER TABLE question_bookmarks ADD CONSTRAINT fk_qb_question
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping fk_qb_question: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE question_reports ADD CONSTRAINT fk_qr_question
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping fk_qr_question: %', SQLERRM;
  END;
END $$;

