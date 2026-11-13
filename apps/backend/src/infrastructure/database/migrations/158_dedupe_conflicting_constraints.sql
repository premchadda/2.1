-- Migration 156: Deduplicate conflicting foreign key constraints (SCH-01)
-- Resolves dual CASCADE vs SET NULL conflicts and cross-hierarchy category_id FK collision.

-- 1. attempt_section_scores: remove conflicting ON DELETE SET NULL and duplicate attempt FK
ALTER TABLE public.attempt_section_scores 
  DROP CONSTRAINT IF EXISTS attempt_section_scores_section_id_fkey;

ALTER TABLE public.attempt_section_scores 
  DROP CONSTRAINT IF EXISTS attempt_section_scores_attempt_id_fkey;

-- 2. user_topic_stats: remove conflicting ON DELETE SET NULL and duplicate topic FK
ALTER TABLE public.user_topic_stats 
  DROP CONSTRAINT IF EXISTS user_topic_stats_topic_id_fkey;

ALTER TABLE public.user_topic_stats 
  DROP CONSTRAINT IF EXISTS user_topic_stats_topic_id_fkey1;

ALTER TABLE public.user_topic_stats 
  DROP CONSTRAINT IF EXISTS fk_user_topic_stats_topic_id;

-- 3. faqs: drop colliding test_categories FK (faqs.category_id references exam_categories)
ALTER TABLE public.faqs 
  DROP CONSTRAINT IF EXISTS faqs_category_id_fkey;
