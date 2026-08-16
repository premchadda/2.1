-- Migration: 068_consolidate_competing_schemas.sql
-- Purpose: Consolidate overlapping table definitions from migrations 018, 046, 060
-- These migrations created the same tables with different schemas.
-- This migration uses IF NOT EXISTS to be idempotent and defines the canonical schema.
--
-- Key decisions:
--   referrals:      Merged best of 018 (simple referrer/referred + reward_amount),
--                   046 (richest: reward_type, reward_value, reward_granted, signup
--                   tracking, referee_email/phone, metadata, ip_address, user_agent),
--                   060 (referred_email, reward_status). Canonical schema picks 046
--                   as base (most columns) with additions from 060 (referred_email
--                   aligned to referee_email, reward_status).
--   study_groups:   018 had minimal (name, description, created_by, is_public,
--                   max_members=50, is_active). 046 added slug, avatar, cover_image,
--                   category, join_approval, member_count, post_count, owner_id,
--                   tags, metadata. 060 had name, slug, exam_id, max_members,
--                   is_public, is_active, created_by. Canonical merges 046 (richest)
--                   with 060's created_by->users FK and 018's subject_id.
--   app_settings:   046 used singleton-row pattern (coming_soon_config, navigation_config
--                   as separate JSONB columns). 060 used key/value pattern (key UNIQUE,
--                   value JSONB). Key/value is more flexible and avoids single-row
--                   bottleneck. Canonical uses 060's pattern with additions from 046
--                   (description, updated_by).
--   study_group_members: 018 didn't define this table. 046 had user_name, user_avatar,
--                   is_active, separate unique index. 060 had FK references, CHECK
--                   on role, inline UNIQUE. Canonical merges FK constraints from 060
--                   with display columns from 046.

-- ============================================================
-- referrals (canonical: merges 046 richness + 060 reward_status)
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id                SERIAL PRIMARY KEY,
  referrer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id        INTEGER REFERENCES users(id),
  referral_code     VARCHAR(50) UNIQUE NOT NULL,
  referee_email     VARCHAR(255),
  referee_phone     VARCHAR(20),
  status            VARCHAR(50) DEFAULT 'pending',
  reward_type       VARCHAR(50) DEFAULT 'credit',
  reward_value      DECIMAL(10,2) DEFAULT 0,
  reward_status     VARCHAR(20) DEFAULT 'pending',
  reward_granted    BOOLEAN DEFAULT false,
  reward_granted_at TIMESTAMPTZ,
  signup_completed   BOOLEAN DEFAULT false,
  first_purchase_made BOOLEAN DEFAULT false,
  first_purchase_at  TIMESTAMPTZ,
  ip_address         VARCHAR(50),
  user_agent         TEXT,
  metadata           JSONB DEFAULT '{}'::jsonb,
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns from 018/060 that may be missing are added
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referee_id') THEN
    ALTER TABLE referrals ADD COLUMN referee_id INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referee_email') THEN
    ALTER TABLE referrals ADD COLUMN referee_email VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'referee_phone') THEN
    ALTER TABLE referrals ADD COLUMN referee_phone VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'reward_type') THEN
    ALTER TABLE referrals ADD COLUMN reward_type VARCHAR(50) DEFAULT 'credit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'reward_value') THEN
    ALTER TABLE referrals ADD COLUMN reward_value DECIMAL(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'reward_status') THEN
    ALTER TABLE referrals ADD COLUMN reward_status VARCHAR(20) DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'reward_granted') THEN
    ALTER TABLE referrals ADD COLUMN reward_granted BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'reward_granted_at') THEN
    ALTER TABLE referrals ADD COLUMN reward_granted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'signup_completed') THEN
    ALTER TABLE referrals ADD COLUMN signup_completed BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'first_purchase_made') THEN
    ALTER TABLE referrals ADD COLUMN first_purchase_made BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'first_purchase_at') THEN
    ALTER TABLE referrals ADD COLUMN first_purchase_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'ip_address') THEN
    ALTER TABLE referrals ADD COLUMN ip_address VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'user_agent') THEN
    ALTER TABLE referrals ADD COLUMN user_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'metadata') THEN
    ALTER TABLE referrals ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'referrals' AND column_name = 'is_active') THEN
    ALTER TABLE referrals ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'idx_referrals_referral_code') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'idx_referrals_referrer_id') THEN
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'idx_referrals_referee_id') THEN
    CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON referrals(referee_id) WHERE referee_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'idx_referrals_status') THEN
    CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status) WHERE status IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'idx_referrals_is_active') THEN
    CREATE INDEX IF NOT EXISTS idx_referrals_is_active ON referrals(is_active) WHERE is_active = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'idx_referrals_created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);
  END IF;
END $$;


-- ============================================================
-- study_groups (canonical: merges 046 display/richness + 060 FK + 018 basics)
-- ============================================================
CREATE TABLE IF NOT EXISTS study_groups (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255),
  description     TEXT,
  avatar          VARCHAR(1000),
  cover_image     VARCHAR(1000),
  category        VARCHAR(100),
  exam_id         INTEGER,
  subject_id      INTEGER,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  is_public       BOOLEAN DEFAULT true,
  join_approval   BOOLEAN DEFAULT false,
  max_members     INTEGER DEFAULT 50,
  member_count    INTEGER DEFAULT 0,
  post_count      INTEGER DEFAULT 0,
  invite_code     VARCHAR(50) UNIQUE,
  status          VARCHAR(20) DEFAULT 'active',
  tags            JSONB DEFAULT '[]'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'created_by') THEN
    ALTER TABLE study_groups ADD COLUMN created_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'slug') THEN
    ALTER TABLE study_groups ADD COLUMN slug VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'avatar') THEN
    ALTER TABLE study_groups ADD COLUMN avatar VARCHAR(1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'cover_image') THEN
    ALTER TABLE study_groups ADD COLUMN cover_image VARCHAR(1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'category') THEN
    ALTER TABLE study_groups ADD COLUMN category VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'exam_id') THEN
    ALTER TABLE study_groups ADD COLUMN exam_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'subject_id') THEN
    ALTER TABLE study_groups ADD COLUMN subject_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'join_approval') THEN
    ALTER TABLE study_groups ADD COLUMN join_approval BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'max_members') THEN
    ALTER TABLE study_groups ADD COLUMN max_members INTEGER DEFAULT 50;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'member_count') THEN
    ALTER TABLE study_groups ADD COLUMN member_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'post_count') THEN
    ALTER TABLE study_groups ADD COLUMN post_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'invite_code') THEN
    ALTER TABLE study_groups ADD COLUMN invite_code VARCHAR(50) UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'status') THEN
    ALTER TABLE study_groups ADD COLUMN status VARCHAR(20) DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'tags') THEN
    ALTER TABLE study_groups ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'metadata') THEN
    ALTER TABLE study_groups ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_groups' AND column_name = 'is_active') THEN
    ALTER TABLE study_groups ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_slug') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_study_groups_slug ON study_groups(slug) WHERE slug IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_study_groups_created_by ON study_groups(created_by) WHERE created_by IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_exam_id') THEN
    CREATE INDEX IF NOT EXISTS idx_study_groups_exam_id ON study_groups(exam_id) WHERE exam_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_category') THEN
    CREATE INDEX IF NOT EXISTS idx_study_groups_category ON study_groups(category) WHERE category IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_is_active') THEN
    CREATE INDEX IF NOT EXISTS idx_study_groups_is_active ON study_groups(is_active) WHERE is_active = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_is_public') THEN
    CREATE INDEX IF NOT EXISTS idx_study_groups_is_public ON study_groups(is_public) WHERE is_public = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_study_groups_created_at ON study_groups(created_at DESC);
  END IF;
END $$;


-- ============================================================
-- study_group_members (canonical: FK constraints from 060 + display cols from 046)
-- ============================================================
CREATE TABLE IF NOT EXISTS study_group_members (
  id              SERIAL PRIMARY KEY,
  group_id        INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name       VARCHAR(200),
  user_avatar     VARCHAR(1000),
  role             VARCHAR(50) DEFAULT 'member',
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_group_members' AND column_name = 'user_name') THEN
    ALTER TABLE study_group_members ADD COLUMN user_name VARCHAR(200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_group_members' AND column_name = 'user_avatar') THEN
    ALTER TABLE study_group_members ADD COLUMN user_avatar VARCHAR(1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_group_members' AND column_name = 'role') THEN
    ALTER TABLE study_group_members ADD COLUMN role VARCHAR(50) DEFAULT 'member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_group_members' AND column_name = 'is_active') THEN
    ALTER TABLE study_group_members ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_group_members' AND indexname = 'idx_study_group_members_unique') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_study_group_members_unique ON study_group_members(group_id, user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_group_members' AND indexname = 'idx_study_group_members_group_id') THEN
    CREATE INDEX IF NOT EXISTS idx_study_group_members_group_id ON study_group_members(group_id) WHERE is_active = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_group_members' AND indexname = 'idx_study_group_members_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_study_group_members_user_id ON study_group_members(user_id) WHERE is_active = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_group_members' AND indexname = 'idx_study_group_members_role') THEN
    CREATE INDEX IF NOT EXISTS idx_study_group_members_role ON study_group_members(role) WHERE is_active = true;
  END IF;
END $$;


-- ============================================================
-- app_settings (canonical: key/value pattern from 060 — more flexible)
-- 046 used a singleton-row with separate JSONB columns per config type.
-- 060 uses (key, value) rows — scales better, supports N settings without
-- schema changes. Added updated_by from 046's audit-friendly design.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(255) UNIQUE NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by  INTEGER REFERENCES users(id),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'description') THEN
    ALTER TABLE app_settings ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'updated_by') THEN
    ALTER TABLE app_settings ADD COLUMN updated_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'is_active') THEN
    ALTER TABLE app_settings ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'app_settings' AND indexname = 'idx_app_settings_key') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'app_settings' AND indexname = 'idx_app_settings_is_active') THEN
    CREATE INDEX IF NOT EXISTS idx_app_settings_is_active ON app_settings(is_active) WHERE is_active = true;
  END IF;
END $$;


-- ============================================================
-- Enable updated_at triggers for consolidated tables
-- ============================================================
DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'referrals', 'study_groups', 'study_group_members', 'app_settings'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    FOREACH t IN ARRAY v_tables LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = t) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
        EXECUTE format(
          'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
          t
        );
      END IF;
    END LOOP;
  ELSE
    RAISE WARNING 'update_updated_at_column() not present; skipping trigger creation';
  END IF;
END $$;


-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
  v_missing TEXT[] := '{}';
  v_t TEXT;
  v_tables TEXT[] := ARRAY[
    'referrals', 'study_groups', 'study_group_members', 'app_settings'
  ];
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = v_t) THEN
      v_missing := array_append(v_missing, v_t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE 'Migration 068: all 4 consolidated tables present';
  ELSE
    RAISE WARNING 'Migration 068: missing tables: %', array_to_string(v_missing, ', ');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'referrals' AND column_name = 'referee_email') THEN
    RAISE NOTICE 'referrals.referee_email present (from 046/060 merge)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'study_groups' AND column_name = 'invite_code') THEN
    RAISE NOTICE 'study_groups.invite_code present (from 018 merge)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'app_settings' AND column_name = 'key') THEN
    RAISE NOTICE 'app_settings uses key/value pattern (from 060)';
  END IF;
END $$;
