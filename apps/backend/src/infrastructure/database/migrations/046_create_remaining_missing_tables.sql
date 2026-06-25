-- =====================================================
-- Migration 046: Create Remaining Missing Tables
-- Purpose: Create the 7+ tables referenced by code but
--          never defined in any prior committed migration.
--          Resolves audit items from docs/AUDIT_2026-06-15.md:
--            - exam_seasons
--            - coupons
--            - promotions
--            - discussions
--            - study_groups
--            - referrals
--            - achievements
--            - app_settings (for coming-soon-config + nav config)
--            - navigation_menu
--
-- Idempotent: every CREATE uses IF NOT EXISTS.
-- Depends on:  000_baseline_functions.sql (helper triggers)
--              025-schema-v3-hierarchy.sql (users, exams, etc.)
--              030_create_missing_tables.sql (current_affairs, etc.)
-- =====================================================

BEGIN;

-- =====================================================
-- PHASE 1: app_settings (singleton config table)
-- Used by /api/admin/coming-soon-config and other settings.
-- =====================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id                    SERIAL PRIMARY KEY,
  coming_soon_config    JSONB DEFAULT '{}'::jsonb,
  navigation_config     JSONB DEFAULT '[]'::jsonb,
  site_config           JSONB DEFAULT '{}'::jsonb,
  metadata              JSONB DEFAULT '{}'::jsonb,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS coming_soon_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS navigation_config JSONB DEFAULT '[]'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_app_settings_is_active ON app_settings(is_active) WHERE is_active = true;

-- (Singleton app_settings row is created lazily by the
--  scripts/seeders/app_settings.seeder.js script. Migrations must
--  not insert demo data; that is the seeder's responsibility.)


-- =====================================================
-- PHASE 2: navigation_menu
-- Used by admin NavigationManager + public navbar.
-- =====================================================

CREATE TABLE IF NOT EXISTS navigation_menu (
  id            SERIAL PRIMARY KEY,
  item_id       VARCHAR(100) UNIQUE,
  label         VARCHAR(200) NOT NULL,
  icon          VARCHAR(100),
  route         VARCHAR(500),
  category      VARCHAR(100),
  parent_id     INTEGER,
  display_order INTEGER DEFAULT 0,
  enabled       BOOLEAN DEFAULT true,
  is_external   BOOLEAN DEFAULT false,
  open_in_new_tab BOOLEAN DEFAULT false,
  roles         JSONB DEFAULT '[]'::jsonb,
  metadata      JSONB DEFAULT '{}'::jsonb,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS item_id VARCHAR(100);
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS parent_id INTEGER;
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS open_in_new_tab BOOLEAN DEFAULT false;
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE navigation_menu ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'navigation_menu' AND indexname = 'idx_navigation_menu_item_id') THEN
    CREATE UNIQUE INDEX idx_navigation_menu_item_id
      ON navigation_menu(item_id) WHERE item_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_navigation_menu_enabled       ON navigation_menu(enabled)        WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_navigation_menu_is_active     ON navigation_menu(is_active)      WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_navigation_menu_category      ON navigation_menu(category)       WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_navigation_menu_parent_id     ON navigation_menu(parent_id)      WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_navigation_menu_display_order ON navigation_menu(display_order);


-- =====================================================
-- PHASE 3: exam_seasons
-- Used by /api/exam-seasons/* (raw SQL) + admin ExamSeasonsManager.
-- =====================================================

CREATE TABLE IF NOT EXISTS exam_seasons (
  id                       SERIAL PRIMARY KEY,
  exam_id                  INTEGER,
  season_slug              VARCHAR(200),
  year                     INTEGER,
  title                    VARCHAR(500),
  notification_date        DATE,
  notification_url         VARCHAR(1000),
  application_start_date   DATE,
  application_end_date     DATE,
  application_url          VARCHAR(1000),
  exam_date                DATE,
  result_date              DATE,
  admit_card_date          DATE,
  vacancy_total            INTEGER DEFAULT 0,
  status                   VARCHAR(50) DEFAULT 'upcoming',
  description              TEXT,
  metadata                 JSONB DEFAULT '{}'::jsonb,
  is_active                BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS season_slug VARCHAR(200);
ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS notification_url VARCHAR(1000);
ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS application_url VARCHAR(1000);
ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS admit_card_date DATE;
ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE exam_seasons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'exam_seasons' AND indexname = 'idx_exam_seasons_season_slug') THEN
    CREATE UNIQUE INDEX idx_exam_seasons_season_slug
      ON exam_seasons(season_slug) WHERE season_slug IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_seasons_exam_id          ON exam_seasons(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_seasons_year             ON exam_seasons(year);
CREATE INDEX IF NOT EXISTS idx_exam_seasons_is_active        ON exam_seasons(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_exam_seasons_status           ON exam_seasons(status)    WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_seasons_exam_date        ON exam_seasons(exam_date) WHERE exam_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_seasons_notification_date ON exam_seasons(notification_date) WHERE notification_date IS NOT NULL;


-- =====================================================
-- PHASE 4: coupons
-- Used by /api/admin/coupons + admin CouponsManager.
-- =====================================================

CREATE TABLE IF NOT EXISTS coupons (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(50) UNIQUE NOT NULL,
  description       TEXT,
  discount_type     VARCHAR(20) DEFAULT 'percentage',
  discount_value    NUMERIC(10,2) DEFAULT 0,
  max_discount      NUMERIC(10,2) DEFAULT 0,
  min_purchase      NUMERIC(10,2) DEFAULT 0,
  usage_limit       INTEGER DEFAULT 0,
  used_count        INTEGER DEFAULT 0,
  used_by_users     JSONB DEFAULT '[]'::jsonb,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  applicable_plans  JSONB DEFAULT '[]'::jsonb,
  new_user_only     BOOLEAN DEFAULT false,
  one_per_user      BOOLEAN DEFAULT true,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'percentage';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_purchase NUMERIC(10,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_by_users JSONB DEFAULT '[]'::jsonb;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_plans JSONB DEFAULT '[]'::jsonb;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS new_user_only BOOLEAN DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS one_per_user BOOLEAN DEFAULT true;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_coupons_is_active   ON coupons(is_active)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coupons_valid_from  ON coupons(valid_from);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_until ON coupons(valid_until);


-- =====================================================
-- PHASE 5: promotions
-- Used by /api/admin/promotions, /api/promotions,
--          admin PromotionManager.
-- =====================================================

CREATE TABLE IF NOT EXISTS promotions (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  type            VARCHAR(50) DEFAULT 'discount',
  code            VARCHAR(50),
  discount_percent NUMERIC(5,2) DEFAULT 0,
  trial_days      INTEGER DEFAULT 0,
  credits         INTEGER DEFAULT 0,
  max_discount    NUMERIC(10,2) DEFAULT 0,
  min_purchase    NUMERIC(10,2) DEFAULT 0,
  valid_from      TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  usage_limit     INTEGER DEFAULT 0,
  used_count      INTEGER DEFAULT 0,
  new_user_only   BOOLEAN DEFAULT false,
  one_per_user    BOOLEAN DEFAULT true,
  status          VARCHAR(20) DEFAULT 'active',
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'discount';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS min_purchase NUMERIC(10,2) DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS new_user_only BOOLEAN DEFAULT false;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS one_per_user BOOLEAN DEFAULT true;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'promotions' AND indexname = 'idx_promotions_code') THEN
    CREATE UNIQUE INDEX idx_promotions_code
      ON promotions(code) WHERE code IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_is_active   ON promotions(is_active)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_status      ON promotions(status)      WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_type        ON promotions(type)        WHERE type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_valid_from  ON promotions(valid_from);
CREATE INDEX IF NOT EXISTS idx_promotions_valid_until ON promotions(valid_until);


-- =====================================================
-- PHASE 6: discussions (community posts/threads)
-- Used by /api/discussions + frontend CommunityHub.
-- =====================================================

CREATE TABLE IF NOT EXISTS discussions (
  id              SERIAL PRIMARY KEY,
  group_id        INTEGER,
  user_id         INTEGER,
  user_name       VARCHAR(200),
  user_avatar     VARCHAR(1000),
  title           VARCHAR(500) NOT NULL,
  content         TEXT,
  post_type       VARCHAR(50) DEFAULT 'discussion',
  is_pinned       BOOLEAN DEFAULT false,
  is_locked       BOOLEAN DEFAULT false,
  is_edited       BOOLEAN DEFAULT false,
  is_anonymous    BOOLEAN DEFAULT false,
  like_count      INTEGER DEFAULT 0,
  comment_count   INTEGER DEFAULT 0,
  view_count      INTEGER DEFAULT 0,
  tags            JSONB DEFAULT '[]'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE discussions ADD COLUMN IF NOT EXISTS group_id INTEGER;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS user_name VARCHAR(200);
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS user_avatar VARCHAR(1000);
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS post_type VARCHAR(50) DEFAULT 'discussion';
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_discussions_group_id    ON discussions(group_id)    WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_user_id     ON discussions(user_id)     WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_is_pinned   ON discussions(is_pinned)   WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_discussions_is_active   ON discussions(is_active)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discussions_post_type   ON discussions(post_type)   WHERE post_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_created_at  ON discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_like_count  ON discussions(like_count DESC) WHERE is_active = true;


-- =====================================================
-- PHASE 7: study_groups (community groups)
-- Used by /api/study-groups + frontend GroupDetail/CommunityHub.
-- =====================================================

CREATE TABLE IF NOT EXISTS study_groups (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  slug            VARCHAR(200),
  description     TEXT,
  avatar          VARCHAR(1000),
  cover_image     VARCHAR(1000),
  category        VARCHAR(100),
  exam_id         INTEGER,
  is_public       BOOLEAN DEFAULT true,
  join_approval   BOOLEAN DEFAULT false,
  member_count    INTEGER DEFAULT 0,
  post_count      INTEGER DEFAULT 0,
  owner_id        INTEGER,
  tags            JSONB DEFAULT '[]'::jsonb,
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS slug VARCHAR(200);
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS avatar VARCHAR(1000);
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS cover_image VARCHAR(1000);
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS exam_id INTEGER;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS join_approval BOOLEAN DEFAULT false;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS post_count INTEGER DEFAULT 0;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS owner_id INTEGER;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_groups' AND indexname = 'idx_study_groups_slug') THEN
    CREATE UNIQUE INDEX idx_study_groups_slug
      ON study_groups(slug) WHERE slug IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_groups_owner_id    ON study_groups(owner_id)    WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_groups_exam_id     ON study_groups(exam_id)     WHERE exam_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_groups_category    ON study_groups(category)    WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_groups_is_active   ON study_groups(is_active)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_groups_is_public   ON study_groups(is_public)   WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_study_groups_created_at  ON study_groups(created_at DESC);


-- =====================================================
-- PHASE 8: study_group_members
-- =====================================================

CREATE TABLE IF NOT EXISTS study_group_members (
  id              SERIAL PRIMARY KEY,
  group_id        INTEGER NOT NULL,
  user_id         INTEGER NOT NULL,
  user_name       VARCHAR(200),
  user_avatar     VARCHAR(1000),
  role            VARCHAR(50) DEFAULT 'member',
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE study_group_members ADD COLUMN IF NOT EXISTS user_name VARCHAR(200);
ALTER TABLE study_group_members ADD COLUMN IF NOT EXISTS user_avatar VARCHAR(1000);
ALTER TABLE study_group_members ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';
ALTER TABLE study_group_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'study_group_members' AND indexname = 'idx_study_group_members_unique') THEN
    CREATE UNIQUE INDEX idx_study_group_members_unique
      ON study_group_members(group_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_group_members_group_id   ON study_group_members(group_id)   WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_group_members_user_id    ON study_group_members(user_id)    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_group_members_role       ON study_group_members(role)       WHERE is_active = true;


-- =====================================================
-- PHASE 9: study_group_messages (chat)
-- =====================================================

CREATE TABLE IF NOT EXISTS study_group_messages (
  id              SERIAL PRIMARY KEY,
  group_id        INTEGER NOT NULL,
  user_id         INTEGER NOT NULL,
  user_name       VARCHAR(200),
  user_avatar     VARCHAR(1000),
  content         TEXT NOT NULL,
  message_type    VARCHAR(50) DEFAULT 'text',
  reply_to_id     INTEGER,
  is_edited       BOOLEAN DEFAULT false,
  is_deleted      BOOLEAN DEFAULT false,
  metadata        JSONB DEFAULT '{}'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS user_name VARCHAR(200);
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS user_avatar VARCHAR(1000);
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text';
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE study_group_messages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_study_group_messages_group_id    ON study_group_messages(group_id)    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_group_messages_user_id     ON study_group_messages(user_id)     WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_group_messages_created_at  ON study_group_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_group_messages_reply_to_id ON study_group_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;


-- =====================================================
-- PHASE 10: referrals
-- Used by /api/referrals + frontend ReferAndEarn.
-- =====================================================

CREATE TABLE IF NOT EXISTS referrals (
  id                    SERIAL PRIMARY KEY,
  referrer_id           INTEGER NOT NULL,
  referee_id            INTEGER,
  referral_code         VARCHAR(50) UNIQUE NOT NULL,
  referee_email         VARCHAR(200),
  referee_phone         VARCHAR(20),
  status                VARCHAR(50) DEFAULT 'pending',
  reward_type           VARCHAR(50) DEFAULT 'credit',
  reward_value          NUMERIC(10,2) DEFAULT 0,
  reward_granted        BOOLEAN DEFAULT false,
  reward_granted_at     TIMESTAMPTZ,
  signup_completed      BOOLEAN DEFAULT false,
  first_purchase_made   BOOLEAN DEFAULT false,
  first_purchase_at     TIMESTAMPTZ,
  ip_address            VARCHAR(50),
  user_agent            TEXT,
  metadata              JSONB DEFAULT '{}'::jsonb,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id INTEGER;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_id INTEGER;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_email VARCHAR(200);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_phone VARCHAR(20);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_type VARCHAR(50) DEFAULT 'credit';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_granted BOOLEAN DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_granted_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS signup_completed BOOLEAN DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS first_purchase_made BOOLEAN DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS first_purchase_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'referrals' AND indexname = 'idx_referrals_referral_code') THEN
    CREATE UNIQUE INDEX idx_referrals_referral_code
      ON referrals(referral_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id    ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id     ON referrals(referee_id)     WHERE referee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_status         ON referrals(status)         WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_is_active      ON referrals(is_active)      WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_referrals_created_at     ON referrals(created_at DESC);


-- =====================================================
-- PHASE 11: achievements
-- Used by /api/achievements + frontend Achievements page.
-- Two tables: definitions + user-earned records.
-- =====================================================

CREATE TABLE IF NOT EXISTS achievement_definitions (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  icon            VARCHAR(100),
  badge_color     VARCHAR(50) DEFAULT 'indigo',
  category        VARCHAR(100),
  tier            VARCHAR(50) DEFAULT 'bronze',
  points          INTEGER DEFAULT 0,
  criteria        JSONB DEFAULT '{}'::jsonb,
  display_order   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS icon VARCHAR(100);
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS badge_color VARCHAR(50) DEFAULT 'indigo';
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS tier VARCHAR(50) DEFAULT 'bronze';
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS criteria JSONB DEFAULT '{}'::jsonb;
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_achievement_definitions_is_active    ON achievement_definitions(is_active)    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_category     ON achievement_definitions(category)     WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_tier         ON achievement_definitions(tier)         WHERE tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_display_order ON achievement_definitions(display_order);

-- User-earned achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL,
  achievement_id      INTEGER NOT NULL,
  achievement_code    VARCHAR(100),
  progress            INTEGER DEFAULT 0,
  progress_target     INTEGER DEFAULT 100,
  is_unlocked         BOOLEAN DEFAULT false,
  unlocked_at         TIMESTAMPTZ,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS achievement_code VARCHAR(100);
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS progress_target INTEGER DEFAULT 100;
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS is_unlocked BOOLEAN DEFAULT false;
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_achievements' AND indexname = 'idx_user_achievements_unique') THEN
    CREATE UNIQUE INDEX idx_user_achievements_unique
      ON user_achievements(user_id, achievement_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id        ON user_achievements(user_id)        WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_achievements_is_unlocked    ON user_achievements(is_unlocked)    WHERE is_unlocked = true;
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at    ON user_achievements(unlocked_at DESC) WHERE is_unlocked = true;


-- =====================================================
-- PHASE 12: enable updated_at triggers for new tables
-- =====================================================

DO $$
DECLARE
  t TEXT;
  v_tables TEXT[] := ARRAY[
    'app_settings', 'navigation_menu', 'exam_seasons', 'coupons',
    'promotions', 'discussions', 'study_groups', 'study_group_members',
    'study_group_messages', 'referrals', 'achievement_definitions',
    'user_achievements'
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


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_missing TEXT[] := '{}';
  v_t TEXT;
  v_tables TEXT[] := ARRAY[
    'app_settings', 'navigation_menu', 'exam_seasons', 'coupons',
    'promotions', 'discussions', 'study_groups', 'study_group_members',
    'study_group_messages', 'referrals', 'achievement_definitions',
    'user_achievements'
  ];
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = v_t) THEN
      v_missing := array_append(v_missing, v_t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NULL THEN
    RAISE NOTICE 'Migration 046: all 12 tables present';
  ELSE
    RAISE WARNING 'Migration 046: missing tables: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

COMMIT;
