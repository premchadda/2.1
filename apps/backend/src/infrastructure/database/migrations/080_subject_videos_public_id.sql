-- 080_subject_videos_public_id.sql
-- Add ELITE-style public_id (UUID + prefixed generated column) to subject_videos
-- so video URLs can use a stable UUID instead of the raw integer primary key.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. UUID column (default backfills existing rows with a random UUID)
ALTER TABLE subject_videos
  ADD COLUMN IF NOT EXISTS public_id_uuid UUID DEFAULT gen_random_uuid();

-- 2. Prefixed, immutable public_id (mirrors subjects/chapters/topics pattern)
ALTER TABLE subject_videos
  ADD COLUMN IF NOT EXISTS public_id TEXT
  GENERATED ALWAYS AS ('vid_' || public_id_uuid::text) STORED;

-- 3. Unique index for fast public_id lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_videos_public_id
  ON subject_videos(public_id);

-- 4. Ensure any pre-existing rows without a UUID get one (safety net)
UPDATE subject_videos
SET public_id_uuid = gen_random_uuid()
WHERE public_id_uuid IS NULL;
