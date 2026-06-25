-- =====================================================
-- Migration 038: Audit Fixes & Missing Tables
-- Purpose: Create the missing tables flagged by dbHelpers audit:
--            - doubt_replies
--            - subject_relations
--            - study_progress
--            - user_history_archive
--          Apply standard soft-delete columns if needed.
-- =====================================================

BEGIN;

-- 1. Create doubt_replies table
CREATE TABLE IF NOT EXISTS doubt_replies (
  id SERIAL PRIMARY KEY,
  doubt_id INTEGER NOT NULL REFERENCES doubts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  content TEXT NOT NULL,
  is_accepted BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  upvotes INTEGER DEFAULT 0,
  upvoted_by JSONB DEFAULT '[]'::jsonb,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  public_id_uuid UUID DEFAULT gen_random_uuid(),
  public_id TEXT GENERATED ALWAYS AS ('dbr_' || public_id_uuid::text) STORED
);

CREATE INDEX IF NOT EXISTS idx_doubt_replies_doubt_id ON doubt_replies(doubt_id);
CREATE INDEX IF NOT EXISTS idx_doubt_replies_user_id ON doubt_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_doubt_replies_public_id ON doubt_replies(public_id);
CREATE INDEX IF NOT EXISTS idx_doubt_replies_active_undeleted ON doubt_replies(id) WHERE is_active = true AND is_deleted = false;

-- 2. Create subject_relations table
CREATE TABLE IF NOT EXISTS subject_relations (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  related_subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  relation_type VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_relations_subject_id ON subject_relations(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_relations_related_subject_id ON subject_relations(related_subject_id);

-- 3. Create study_progress table
CREATE TABLE IF NOT EXISTS study_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id INTEGER REFERENCES test_series(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_progress_user_id ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_series_id ON study_progress(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_progress_material_id ON study_progress(material_id) WHERE material_id IS NOT NULL;

-- 4. Create user_history_archive table
CREATE TABLE IF NOT EXISTS user_history_archive (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id INTEGER REFERENCES test_series(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  original_id INTEGER,
  data JSONB NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_history_archive_user_id ON user_history_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_archive_type ON user_history_archive(type);

COMMIT;
