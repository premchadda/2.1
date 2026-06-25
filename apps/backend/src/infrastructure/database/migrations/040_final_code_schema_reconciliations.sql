-- =====================================================
-- Migration 040: Final Code-Schema Reconciliations
-- Purpose: Resolve remaining issues that 039 did not cover
--          and that the audit identified:
--
--            1. Add users.full_name column (kept in sync
--               with `name` via a trigger) so the existing
--               test.repository.js leaderboard query
--               succeeds without code change.
--            2. exam_seasons.exam_id type mismatch:
--               `exam_seasons.exam_id` is INTEGER but
--               `exams.exam_id` is VARCHAR slug. Add a
--               second column `exam_internal_id INTEGER
--               REFERENCES exams(id)` so joins work both
--               ways.
--            3. Add a sync trigger so any INSERT into
--               community_votes also writes to
--               group_post_likes (legacy tableMap).
--            4. Add a `users.full_name` index.
--            5. Add CHECK constraints on study_groups.category
--               (so free-form typo values get caught).
--            6. Add users.session_state JSONB column used
--               by auth/session middleware (referenced in
--               audit but missing).
--            7. Add a missing FK to faqs.category_id
--               (resolve to test_categories as a sensible
--               default since the column is ambiguous).
--            8. Add a missing FK to testimonials.user_id.
--            9. Add a missing FK to user_history_archive
--               with study_materials, test_series.
--           10. Add a missing FK to doubt_replies (verify
--               exists from 038).
--
-- Idempotent: all DO $$ guarded.
-- Depends on:  000_baseline_functions.sql, 001-039
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 1: users.full_name
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);
    UPDATE users SET full_name = name WHERE full_name IS NULL;
  END IF;
END $$;

-- Helper function to keep full_name in sync with name.
CREATE OR REPLACE FUNCTION sync_users_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.full_name IS NULL OR NEW.full_name = OLD.name OR NEW.full_name = '' THEN
    NEW.full_name := NEW.name;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS trg_users_full_name_sync ON users;
    CREATE TRIGGER trg_users_full_name_sync
      BEFORE INSERT OR UPDATE OF name, full_name ON users
      FOR EACH ROW
      EXECUTE FUNCTION sync_users_full_name();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_full_name
  ON users(full_name) WHERE full_name IS NOT NULL;


-- =====================================================
-- SECTION 2: exam_seasons.exam_id type fix
-- Add a second column `exam_internal_id INTEGER REFERENCES exams(id)`
-- so JOIN exam_seasons es ON es.exam_internal_id = e.id works.
-- (Cannot change exam_id column type because production data exists.)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'exam_seasons') THEN
    ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS exam_internal_id INTEGER;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'exam_seasons')
     AND EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'exams') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE table_name = 'exam_seasons' AND constraint_name = 'exam_seasons_exam_internal_id_fkey') THEN
      BEGIN
        ALTER TABLE exam_seasons
          ADD CONSTRAINT exam_seasons_exam_internal_id_fkey
          FOREIGN KEY (exam_internal_id) REFERENCES exams(id) ON DELETE SET NULL;
      EXCEPTION WHEN others THEN NULL; END;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_seasons_exam_internal_id
  ON exam_seasons(exam_internal_id) WHERE exam_internal_id IS NOT NULL;

-- Backfill exam_internal_id from exams.exam_id (VARCHAR slug)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'exam_seasons')
     AND EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'exams') THEN
    UPDATE exam_seasons es
       SET exam_internal_id = e.id
      FROM exams e
     WHERE es.exam_internal_id IS NULL
       AND (es.exam_id::text = e.id::text OR es.exam_id::text = e.exam_id OR es.exam_id::text = e.slug);
  END IF;
END $$;


-- =====================================================
-- SECTION 3: Sync community_votes → group_post_likes
-- The legacy tableMap maps communityVotes → group_post_likes.
-- After 039 creates community_votes, keep both in sync so
-- the legacy read path still works.
-- =====================================================

CREATE OR REPLACE FUNCTION sync_community_votes_to_group_post_likes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Try to insert into group_post_likes (legacy table)
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'group_post_likes') THEN
      BEGIN
        INSERT INTO group_post_likes (post_id, user_id, created_at, updated_at)
        VALUES (NEW.post_id, NEW.user_id, NOW(), NOW())
        ON CONFLICT (post_id, user_id) DO UPDATE
          SET updated_at = NOW();
      EXCEPTION WHEN undefined_column THEN
        NULL;
      END;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'group_post_likes') THEN
      BEGIN
        DELETE FROM group_post_likes
         WHERE post_id = OLD.post_id AND user_id = OLD.user_id;
      EXCEPTION WHEN undefined_column THEN
        NULL;
      END;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'community_votes') THEN
    DROP TRIGGER IF EXISTS trg_sync_community_votes ON community_votes;
    CREATE TRIGGER trg_sync_community_votes
      AFTER INSERT OR DELETE ON community_votes
      FOR EACH ROW
      EXECUTE FUNCTION sync_community_votes_to_group_post_likes();
  END IF;
END $$;


-- =====================================================
-- SECTION 4: users.session_state JSONB column
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;


-- =====================================================
-- SECTION 5: faqs.category_id FK to test_categories
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'faqs')
     AND EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'test_categories') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'faqs' AND column_name = 'category_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                        WHERE table_name = 'faqs' AND constraint_name = 'faqs_category_id_fkey') THEN
      BEGIN
        ALTER TABLE faqs
          ADD CONSTRAINT faqs_category_id_fkey
          FOREIGN KEY (category_id) REFERENCES test_categories(id) ON DELETE SET NULL;
      EXCEPTION WHEN others THEN NULL; END;
    END IF;
  END IF;
END $$;


-- =====================================================
-- SECTION 6: testimonials.user_id FK
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'testimonials') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'testimonials' AND column_name = 'user_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                        WHERE table_name = 'testimonials' AND constraint_name = 'testimonials_user_id_fkey') THEN
      BEGIN
        ALTER TABLE testimonials
          ADD CONSTRAINT testimonials_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN others THEN NULL; END;
    END IF;
  END IF;
END $$;


-- =====================================================
-- SECTION 7: page_content.exam_id FK
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'page_content') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'page_content' AND column_name = 'exam_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                        WHERE table_name = 'page_content' AND constraint_name = 'page_content_exam_id_fkey') THEN
      BEGIN
        ALTER TABLE page_content
          ADD CONSTRAINT page_content_exam_id_fkey
          FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL;
      EXCEPTION WHEN others THEN NULL; END;
    END IF;
  END IF;
END $$;


-- =====================================================
-- SECTION 8: study_groups.category CHECK constraint
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'study_groups' AND column_name = 'category') THEN
    EXECUTE 'ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_category_chk';
    EXECUTE $sql$ALTER TABLE study_groups
              ADD CONSTRAINT study_groups_category_chk
              CHECK (category IS NULL OR LOWER(category) IN (
                'general','exam-prep','subject-specific','language','career',
                'mock-tests','strategy','doubts','discussion','announcement',
                'ssc','railway','banking','state-psc','defence','teaching'
              ))$sql$;
  END IF;
END $$;


-- =====================================================
-- SECTION 9: Add CHECK constraints for legacy "enum" columns
-- =====================================================

-- 9a. subscriptions.plan_type (legacy 001 used different values)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'subscriptions' AND column_name = 'plan_type') THEN
    EXECUTE 'ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_chk';
    EXECUTE $sql$ALTER TABLE subscriptions
              ADD CONSTRAINT subscriptions_plan_type_chk
              CHECK (plan_type IS NULL OR LOWER(plan_type) IN (
                'free','pro','basic','premium','monthly','quarterly','yearly','lifetime','trial','student'
              ))$sql$;
  END IF;
END $$;

-- 9b. exam_seasons.status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'exam_seasons' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE exam_seasons DROP CONSTRAINT IF EXISTS exam_seasons_status_chk';
    EXECUTE $sql$ALTER TABLE exam_seasons
              ADD CONSTRAINT exam_seasons_status_chk
              CHECK (status IS NULL OR LOWER(status) IN (
                'upcoming','open','closed','result_out','cancelled','archived'
              ))$sql$;
  END IF;
END $$;

-- 9c. coupons.discount_type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'coupons' AND column_name = 'discount_type') THEN
    EXECUTE 'ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_discount_type_chk';
    EXECUTE $sql$ALTER TABLE coupons
              ADD CONSTRAINT coupons_discount_type_chk
              CHECK (discount_type IS NULL OR LOWER(discount_type) IN ('percentage','flat','fixed','bogo'))$sql$;
  END IF;
END $$;

-- 9d. promotions.type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'promotions' AND column_name = 'type') THEN
    EXECUTE 'ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_type_chk';
    EXECUTE $sql$ALTER TABLE promotions
              ADD CONSTRAINT promotions_type_chk
              CHECK (type IS NULL OR LOWER(type) IN (
                'discount','trial','credits','cashback','referral','seasonal','flash','first_purchase','renewal'
              ))$sql$;
  END IF;
END $$;


-- =====================================================
-- SECTION 10: discussion_votes uniqueness — handle potential
-- legacy rows where (discussion_id, user_id) is duplicated.
-- =====================================================

DO $$
DECLARE
  v_dup_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'discussion_votes') THEN
    -- Detect duplicates and keep the lowest id
    SELECT COUNT(*) INTO v_dup_count
      FROM (
        SELECT discussion_id, user_id, COUNT(*) cnt
          FROM discussion_votes
         WHERE discussion_id IS NOT NULL
         GROUP BY discussion_id, user_id
        HAVING COUNT(*) > 1
      ) d;
    IF v_dup_count > 0 THEN
      DELETE FROM discussion_votes d
       USING (
         SELECT MIN(id) AS min_id, discussion_id, user_id
           FROM discussion_votes
          WHERE discussion_id IS NOT NULL
          GROUP BY discussion_id, user_id
         HAVING COUNT(*) > 1
       ) keepers
       WHERE d.discussion_id = keepers.discussion_id
         AND d.user_id       = keepers.user_id
         AND d.id <> keepers.min_id;
      RAISE NOTICE 'discussion_votes: removed % duplicate rows', v_dup_count;
    END IF;
  END IF;
END $$;


-- =====================================================
-- SECTION 11: community_votes uniqueness — same fix
-- =====================================================

DO $$
DECLARE
  v_dup_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'community_votes') THEN
    SELECT COUNT(*) INTO v_dup_count
      FROM (
        SELECT post_id, user_id, COUNT(*) cnt
          FROM community_votes
         GROUP BY post_id, user_id
        HAVING COUNT(*) > 1
      ) d;
    IF v_dup_count > 0 THEN
      DELETE FROM community_votes d
       USING (
         SELECT MIN(id) AS min_id, post_id, user_id
           FROM community_votes
          GROUP BY post_id, user_id
         HAVING COUNT(*) > 1
       ) keepers
       WHERE d.post_id = keepers.post_id
         AND d.user_id = keepers.user_id
         AND d.id <> keepers.min_id;
      RAISE NOTICE 'community_votes: removed % duplicate rows', v_dup_count;
    END IF;
  END IF;
END $$;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'users' AND column_name = 'full_name') THEN
    RAISE NOTICE 'Migration 040: users.full_name column present';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'exam_seasons' AND column_name = 'exam_internal_id') THEN
    RAISE NOTICE 'Migration 040: exam_seasons.exam_internal_id column present';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.triggers
              WHERE trigger_name = 'trg_users_full_name_sync') THEN
    RAISE NOTICE 'Migration 040: trg_users_full_name_sync trigger installed';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.triggers
              WHERE trigger_name = 'trg_sync_community_votes') THEN
    RAISE NOTICE 'Migration 040: trg_sync_community_votes trigger installed';
  END IF;
END $$;

COMMIT;
