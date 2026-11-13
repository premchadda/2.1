-- Migration 159: Convert unique constraints on soft-deletable tables to partial indexes (SOFT-01)
-- Allows re-registration and reuse of slugs/emails when existing records are soft-deleted.

-- 1. users: email uniqueness only for active (undeleted) accounts
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
DROP INDEX IF EXISTS public.users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_active 
  ON public.users (email) 
  WHERE is_deleted = false;

-- 2. coupons: code uniqueness only for undeleted coupons
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_code_key;
DROP INDEX IF EXISTS public.coupons_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique_active 
  ON public.coupons (code) 
  WHERE is_deleted = false;

-- 3. subjects: slug uniqueness only for active subjects
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_slug_key;
DROP INDEX IF EXISTS public.subjects_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_slug_unique_active 
  ON public.subjects (slug) 
  WHERE is_deleted = false;

-- 4. quizzes: slug uniqueness only for active quizzes
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_slug_key;
DROP INDEX IF EXISTS public.quizzes_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_slug_unique_active 
  ON public.quizzes (slug) 
  WHERE is_deleted = false;

-- 5. test_series: slug uniqueness only for active series
ALTER TABLE public.test_series DROP CONSTRAINT IF EXISTS test_series_slug_key;
DROP INDEX IF EXISTS public.test_series_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS test_series_slug_unique_active 
  ON public.test_series (slug) 
  WHERE is_deleted = false;

-- 6. study_materials: slug uniqueness only for active materials
ALTER TABLE public.study_materials DROP CONSTRAINT IF EXISTS study_materials_slug_key;
DROP INDEX IF EXISTS public.study_materials_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS study_materials_slug_unique_active 
  ON public.study_materials (slug) 
  WHERE is_deleted = false;

-- 7. blogs: slug uniqueness only for active posts (uses deleted_at)
ALTER TABLE public.blogs DROP CONSTRAINT IF EXISTS blogs_slug_key;
DROP INDEX IF EXISTS public.blogs_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS blogs_slug_unique_active 
  ON public.blogs (slug) 
  WHERE deleted_at IS NULL;
