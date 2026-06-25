-- =====================================================
-- Migration 040: Discussions Self-Referencing + Forum Fixes
-- Purpose: Add the columns that the live `discussions`
--          table has but migration 038 didn't declare:
--            - type          (post/reply)
--            - parent_id     (self-FK for threading)
--            - reference_type (question/group/general)
--            - reference_id
--            - upvotes/downvotes
--            - public_id
--          Also fixes the questionDiscussions/discussionReplies
--          tableMap mapping (both point to `discussions`).
-- =====================================================

BEGIN;

-- Add self-referencing FK columns + forum columns to discussions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discussions') THEN
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS parent_id       INTEGER;
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS type            VARCHAR(50) DEFAULT 'discussion';
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS reference_type  VARCHAR(50);
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS reference_id    INTEGER;
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS upvotes         INTEGER DEFAULT 0;
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS downvotes       INTEGER DEFAULT 0;
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS public_id_uuid  UUID DEFAULT gen_random_uuid();
    ALTER TABLE discussions ADD COLUMN IF NOT EXISTS public_id       TEXT;

    -- Self-referencing FK for threading
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'discussions_parent_id_fkey' AND table_name = 'discussions') THEN
      ALTER TABLE discussions
        ADD CONSTRAINT discussions_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES discussions(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discussions_parent_id
  ON discussions(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_type
  ON discussions(type) WHERE type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_reference
  ON discussions(reference_type, reference_id) WHERE reference_type IS NOT NULL;


-- =====================================================
-- Add `discussions` reference from `discussions_votes`
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discussion_votes') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'discussion_votes' AND column_name = 'discussion_id') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                      WHERE constraint_name = 'discussion_votes_discussion_id_fkey' AND table_name = 'discussion_votes') THEN
        ALTER TABLE discussion_votes
          ADD CONSTRAINT discussion_votes_discussion_id_fkey
          FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;


-- =====================================================
-- Enrollments FKs (series_id, study_material_id) — were created
-- as bare INTEGERs in 018 without FK constraints in some envs.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enrollments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'enrollments_study_material_id_fkey' AND table_name = 'enrollments') THEN
      ALTER TABLE enrollments
        ADD CONSTRAINT enrollments_study_material_id_fkey
        FOREIGN KEY (study_material_id) REFERENCES study_materials(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_study_material_id
  ON enrollments(study_material_id) WHERE study_material_id IS NOT NULL;


-- =====================================================
-- Tags table for question_tag_map.tag_id FK target.
-- The migration 030 created question_tag_map; the `tags` table
-- is the canonical target but the FK wasn't added.
-- =====================================================

CREATE TABLE IF NOT EXISTS tags (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  category    VARCHAR(100),
  color       VARCHAR(50) DEFAULT 'gray',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_tag_map') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_tag_map' AND column_name = 'tag_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'question_tag_map_tag_id_fkey' AND table_name = 'question_tag_map') THEN
          ALTER TABLE question_tag_map
            ADD CONSTRAINT question_tag_map_tag_id_fkey
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
        END IF;
      END IF;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tags_is_active ON tags(is_active) WHERE is_active = true;


-- =====================================================
-- Faqs FK to exam_categories
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faqs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'faqs_category_id_fkey' AND table_name = 'faqs') THEN
      ALTER TABLE faqs
        ADD CONSTRAINT faqs_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES exam_categories(category_id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;


-- =====================================================
-- Testimonials.user_id FK to users
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'testimonials') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'testimonials_user_id_fkey' AND table_name = 'testimonials') THEN
      ALTER TABLE testimonials
        ADD CONSTRAINT testimonials_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;


-- =====================================================
-- Media.uploaded_by FK to users
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'media_uploaded_by_fkey' AND table_name = 'media') THEN
      ALTER TABLE media
        ADD CONSTRAINT media_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;




-- =====================================================
-- test_state_machine — referenced in 032 list but never created.
-- Track test lifecycle transitions for audit.
-- =====================================================

CREATE TABLE IF NOT EXISTS test_state_machine (
  id            SERIAL PRIMARY KEY,
  test_id       INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  from_state    VARCHAR(50),
  to_state      VARCHAR(50) NOT NULL,
  changed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason        TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  transitioned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_state_machine_test_id  ON test_state_machine(test_id);
CREATE INDEX IF NOT EXISTS idx_test_state_machine_to_state ON test_state_machine(to_state) WHERE to_state IS NOT NULL;


-- =====================================================
-- Add tableMap entry for new tables and discussionReplies
-- Now that `discussions` has `parent_id` (self-FK), the
-- `questionDiscussions` and `discussionReplies` mappings
-- both correctly point to the same `discussions` table.
-- Code must filter by type='reply' for replies.
-- (No SQL change needed; documentation only.)
-- =====================================================


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_missing TEXT[] := '{}';
  v_t TEXT;
  v_tables TEXT[] := ARRAY['tags', 'test_state_machine'];
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = v_t) THEN
      v_missing := array_append(v_missing, v_t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE 'Migration 040: both new tables present';
  ELSE
    RAISE WARNING 'Migration 040: missing tables: %', array_to_string(v_missing, ', ');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'discussions' AND column_name = 'parent_id') THEN
    RAISE NOTICE 'Migration 040: discussions.parent_id added';
  ELSE
    RAISE WARNING 'Migration 040: discussions.parent_id missing';
  END IF;
END $$;

COMMIT;
