-- Migration 141: FortSpy encrypted-stream columns on subject_videos
-- Enables the FortSpy player: videos-public.js + hierarchical feed expose
-- fortspy_id / is_encrypted / encryption_type, and
-- POST /api/fortspy/generate-stream-token resolves the decryption key
-- server-side from fortspy_key (the key is NEVER returned to clients).

ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS fortspy_id TEXT;
ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS fortspy_key TEXT;
ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;
ALTER TABLE subject_videos ADD COLUMN IF NOT EXISTS encryption_type VARCHAR(32) DEFAULT 'AES-256-CTR';

-- One encrypted asset per row; NULLs (unencrypted videos) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_videos_fortspy_id
  ON subject_videos(fortspy_id) WHERE fortspy_id IS NOT NULL;
