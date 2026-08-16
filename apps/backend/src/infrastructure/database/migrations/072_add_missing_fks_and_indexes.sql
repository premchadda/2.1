-- 072_add_missing_fks_and_indexes.sql
-- Clean up orphans and add foreign key constraints for referential integrity
-- Resolves high priority issues:
--   #29: community_comments.post_id has no FK
--   #30: question_tag_map.question_id has no FK
--   #31: attempt_section_scores has no FKs

BEGIN;

-- 1. Clean up orphaned rows first so constraints can be created successfully
DELETE FROM community_comments 
 WHERE post_id IS NOT NULL 
   AND post_id NOT IN (SELECT id FROM group_posts);

DELETE FROM community_comments 
 WHERE user_id IS NOT NULL 
   AND user_id NOT IN (SELECT id FROM users);

DELETE FROM community_comments 
 WHERE parent_id IS NOT NULL 
   AND parent_id NOT IN (SELECT id FROM community_comments);

DELETE FROM question_tag_map 
 WHERE question_id NOT IN (SELECT id FROM questions);

DELETE FROM question_tag_map 
 WHERE tag_id NOT IN (SELECT id FROM tags);

DELETE FROM attempt_section_scores 
 WHERE attempt_id IS NOT NULL 
   AND attempt_id NOT IN (SELECT id FROM attempts);

DELETE FROM attempt_section_scores 
 WHERE section_id IS NOT NULL 
   AND section_id NOT IN (SELECT id FROM test_sections);


-- 2. Add foreign key constraints idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_community_comments_post'
  ) THEN
    ALTER TABLE community_comments 
      ADD CONSTRAINT fk_community_comments_post 
      FOREIGN KEY (post_id) REFERENCES group_posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_community_comments_user'
  ) THEN
    ALTER TABLE community_comments 
      ADD CONSTRAINT fk_community_comments_user 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_community_comments_parent'
  ) THEN
    ALTER TABLE community_comments 
      ADD CONSTRAINT fk_community_comments_parent 
      FOREIGN KEY (parent_id) REFERENCES community_comments(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_tag_map_question'
  ) THEN
    ALTER TABLE question_tag_map 
      ADD CONSTRAINT fk_question_tag_map_question 
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_tag_map_tag'
  ) THEN
    ALTER TABLE question_tag_map 
      ADD CONSTRAINT fk_question_tag_map_tag 
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_attempt_section_scores_attempt'
  ) THEN
    ALTER TABLE attempt_section_scores 
      ADD CONSTRAINT fk_attempt_section_scores_attempt 
      FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_attempt_section_scores_section'
  ) THEN
    ALTER TABLE attempt_section_scores 
      ADD CONSTRAINT fk_attempt_section_scores_section 
      FOREIGN KEY (section_id) REFERENCES test_sections(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
