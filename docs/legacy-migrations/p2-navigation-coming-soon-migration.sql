-- =====================================================
-- P2 Backend Endpoints Database Migration
-- Navigation Manager & Coming Soon Features
-- Upgrades P0 schema with enhanced columns
-- Created: 2026-04-23
-- =====================================================

-- =====================================================
-- 1. NAVIGATION CONFIGURATION TABLE
-- =====================================================

-- Ensure navigation_config table exists (creates if not, skips if exists)
CREATE TABLE IF NOT EXISTS navigation_config (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  route VARCHAR(100),
  "order" INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(50) DEFAULT 'main',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add P2 enhanced columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'navigation_config' AND column_name = 'parent_id') THEN
    ALTER TABLE navigation_config ADD COLUMN parent_id VARCHAR(50) REFERENCES navigation_config(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'navigation_config' AND column_name = 'description') THEN
    ALTER TABLE navigation_config ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'navigation_config' AND column_name = 'badge') THEN
    ALTER TABLE navigation_config ADD COLUMN badge VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'navigation_config' AND column_name = 'badge_color') THEN
    ALTER TABLE navigation_config ADD COLUMN badge_color VARCHAR(20);
  END IF;
END $$;

-- Indexes for navigation
CREATE INDEX IF NOT EXISTS idx_navigation_category ON navigation_config(category);
CREATE INDEX IF NOT EXISTS idx_navigation_order ON navigation_config("order");
CREATE INDEX IF NOT EXISTS idx_navigation_enabled ON navigation_config(enabled);

-- =====================================================
-- 2. COMING SOON FEATURES TABLE
-- =====================================================

-- Ensure coming_soon_features table exists
CREATE TABLE IF NOT EXISTS coming_soon_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  eta DATE,
  category VARCHAR(50),
  status VARCHAR(20) DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add P2 enhanced columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coming_soon_features' AND column_name = 'priority') THEN
    ALTER TABLE coming_soon_features ADD COLUMN priority VARCHAR(10) DEFAULT 'medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coming_soon_features' AND column_name = 'progress_percentage') THEN
    ALTER TABLE coming_soon_features ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coming_soon_features' AND column_name = 'image_url') THEN
    ALTER TABLE coming_soon_features ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- Add CHECK constraints if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'coming_soon_features' AND constraint_name = 'chk_coming_soon_status'
  ) THEN
    ALTER TABLE coming_soon_features ADD CONSTRAINT chk_coming_soon_status 
      CHECK (status IN ('planned', 'in_development', 'testing', 'released'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'coming_soon_features' AND constraint_name = 'chk_coming_soon_priority'
  ) THEN
    ALTER TABLE coming_soon_features ADD CONSTRAINT chk_coming_soon_priority 
      CHECK (priority IN ('high', 'medium', 'low'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'coming_soon_features' AND constraint_name = 'chk_coming_soon_progress'
  ) THEN
    ALTER TABLE coming_soon_features ADD CONSTRAINT chk_coming_soon_progress 
      CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
  END IF;
END $$;

-- Indexes for coming soon features
CREATE INDEX IF NOT EXISTS idx_coming_soon_status ON coming_soon_features(status);
CREATE INDEX IF NOT EXISTS idx_coming_soon_category ON coming_soon_features(category);
CREATE INDEX IF NOT EXISTS idx_coming_soon_priority ON coming_soon_features(priority);

-- =====================================================
-- 3. COMMENTS
-- =====================================================

COMMENT ON TABLE navigation_config IS 'Admin panel navigation structure and configuration';
COMMENT ON TABLE coming_soon_features IS 'Upcoming features tracking with progress and ETA';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verification queries
SELECT 
  'navigation_config' as table_name, 
  COUNT(*) as total_records 
FROM navigation_config
UNION ALL
SELECT 
  'coming_soon_features' as table_name, 
  COUNT(*) as total_records 
FROM coming_soon_features;

-- =====================================================
-- NEXT STEPS
-- =====================================================
-- 1. Run this migration: psql -d your_database -f p2-navigation-coming-soon-migration.sql
-- 2. Verify tables: \dt navigation_config coming_soon_features
-- 3. Test endpoints via admin panel or API
-- =====================================================
