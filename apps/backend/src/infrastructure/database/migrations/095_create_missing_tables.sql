-- Migration 095: Create tables referenced in code but missing from migrations
-- Phase 7.2: 10+ tables were referenced in code but never created by any migration.
-- This migration creates them with proper FKs to users.id, attempts.id, etc.

-- notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  action_url VARCHAR(1000),
  priority VARCHAR(20) DEFAULT 'normal',
  scheduled_at TIMESTAMPTZ,
  sent_via VARCHAR(50)[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url VARCHAR(1000);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_via VARCHAR(50)[] DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = false;

-- subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  auto_renew BOOLEAN DEFAULT FALSE,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  amount_paid NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';

-- results table (for legacy result lookups)
CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER,
  series_id INTEGER,
  score NUMERIC,
  total_marks NUMERIC,
  percentage NUMERIC,
  rank INTEGER,
  percentile NUMERIC,
  time_taken INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- In case the table already existed from a missing migration, ensure columns exist
ALTER TABLE results ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE results ADD COLUMN IF NOT EXISTS attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE;
ALTER TABLE results ADD COLUMN IF NOT EXISTS test_id INTEGER;
ALTER TABLE results ADD COLUMN IF NOT EXISTS series_id INTEGER;
ALTER TABLE results ADD COLUMN IF NOT EXISTS score NUMERIC;
ALTER TABLE results ADD COLUMN IF NOT EXISTS total_marks NUMERIC;
ALTER TABLE results ADD COLUMN IF NOT EXISTS percentage NUMERIC;
ALTER TABLE results ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE results ADD COLUMN IF NOT EXISTS percentile NUMERIC;
ALTER TABLE results ADD COLUMN IF NOT EXISTS time_taken INTEGER;
ALTER TABLE results ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_results_user ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_attempt ON results(attempt_id);

-- doubts table
CREATE TABLE IF NOT EXISTS doubts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(20) DEFAULT 'open',
  is_resolved BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  upvotes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  tags VARCHAR(100)[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'open';
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS tags VARCHAR(100)[] DEFAULT '{}';
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_doubts_user ON doubts(user_id);
CREATE INDEX IF NOT EXISTS idx_doubts_status ON doubts(status) WHERE is_active = true;

-- bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL,
  item_id INTEGER NOT NULL,
  title VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS item_type VARCHAR(50);
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS item_id INTEGER;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique ON bookmarks(user_id, item_type, item_id);

-- leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
  id SERIAL PRIMARY KEY,
  test_id INTEGER,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score NUMERIC,
  accuracy NUMERIC,
  time_spent_seconds INTEGER,
  rank INTEGER,
  percentile NUMERIC,
  batch_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS test_id INTEGER;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS score NUMERIC;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS accuracy NUMERIC;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS percentile NUMERIC;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS batch_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_leaderboards_test ON leaderboards(test_id, batch_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboards_unique ON leaderboards(test_id, user_id, batch_date);

-- activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_id INTEGER;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- group_posts, group_post_likes, group_messages (for study groups)
CREATE TABLE IF NOT EXISTS group_posts (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE group_posts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE group_posts ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE group_posts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE group_posts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE group_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_group_posts_group ON group_posts(group_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS group_post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE group_post_likes ADD COLUMN IF NOT EXISTS post_id INTEGER;
ALTER TABLE group_post_likes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS group_messages (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at DESC);

-- Seed default appSettings rows (Phase 5.17: ComingSoonManager GET fails when
-- the appSettings record doesn't exist — returns { success: false } with no data).
-- NOTE: the original INSERT referenced `site_name`, which no migration defines.
-- The canonical schema (068) is key/value (key UNIQUE NOT NULL, value JSONB);
-- the legacy 046 schema is a singleton row with site_config. Guards below make
-- the seed safe on either shape, and ON CONFLICT/WHERE NOT EXISTS keep it
-- idempotent:
--   * key/value row for the coming-soon-config read path (admin-extras.js
--     GET /coming-soon-config does dbHelpers.find("appSettings",
--     { key: "coming_soon_config" }))
--   * id=1 singleton row for the legacy site_config read path
--     (SettingsService.getSiteConfig() reads the first active row)
-- to_regclass() resolves through the current search_path, so the column
-- checks always inspect the very relation the INSERT will target.
DO $$
BEGIN
  IF to_regclass('app_settings') IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('app_settings')
      AND attname = 'key'
      AND NOT attisdropped
  ) THEN
    INSERT INTO app_settings (key, value, description)
    VALUES ('coming_soon_config', '{"siteConfig":{},"pages":[]}'::jsonb, 'Coming soon feature flags')
    ON CONFLICT (key) DO NOTHING;
  END IF;

  IF to_regclass('app_settings') IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('app_settings')
      AND attname = 'site_config'
      AND NOT attisdropped
  ) THEN
    INSERT INTO app_settings (id, site_config, is_active)
    SELECT 1, '{}'::jsonb, true
    WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
  END IF;
END $$;
