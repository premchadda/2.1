-- Migration 100: Reconcile duplicate table definitions
-- Phase 7: promotions, referrals, study_groups, discussions have duplicate
-- schemas from competing migrations. This migration consolidates them.

-- Promotions: ensure canonical schema exists
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  code VARCHAR(100),
  discount_type VARCHAR(50),
  discount_value NUMERIC(10,2),
  min_purchase NUMERIC(10,2),
  max_discount NUMERIC(10,2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  type VARCHAR(50) DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals: ensure canonical schema exists
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL,
  referred_id INTEGER,
  referral_code VARCHAR(100) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',
  reward_amount NUMERIC(10,2),
  reward_paid BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Study groups: ensure canonical schema exists
CREATE TABLE IF NOT EXISTS study_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id INTEGER,
  owner_id INTEGER,
  user_id INTEGER,
  max_members INTEGER DEFAULT 50,
  is_public BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS creator_id INTEGER;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS owner_id INTEGER;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Discussions: ensure canonical schema exists
CREATE TABLE IF NOT EXISTS discussions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  user_id INTEGER NOT NULL,
  author_id INTEGER,
  category VARCHAR(100),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  reply_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS author_id INTEGER;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS category VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_discussions_user ON discussions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category) WHERE is_active = true;

-- Navigation menu: reconcile navigation_config vs navigation_menu
-- Keep navigation_config as canonical (used by admin panel)
-- Drop navigation_menu if it exists (redundant)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'navigation_menu') THEN
    -- Migrate any data from navigation_menu to navigation_config
    INSERT INTO navigation_config (label, path, icon, category, display_order, enabled, created_at)
    SELECT label, path, icon, category, display_order, enabled, created_at
    FROM navigation_menu
    ON CONFLICT DO NOTHING;
    -- Drop the redundant table
    DROP TABLE navigation_menu;
  END IF;
END $$;
