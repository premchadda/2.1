-- Migration 098: Reconstructed baseline — creates tables that should have been
-- created by migrations 003-017 (which don't exist in the repo). This migration
-- uses CREATE TABLE IF NOT EXISTS so it's safe to run even if the tables already
-- exist in the live DB.

-- Core user sessions (should have been in 005)
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  country VARCHAR(100),
  country_code VARCHAR(10),
  city VARCHAR(100),
  session_type VARCHAR(20) DEFAULT 'web',
  is_active BOOLEAN DEFAULT TRUE,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  refresh_token_hash VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

-- Test sections (should have been in 007)
CREATE TABLE IF NOT EXISTS test_sections (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER,
  description TEXT,
  duration INTEGER,
  passing_marks NUMERIC,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_sections_test ON test_sections(test_id);

-- Exam info (detailed exam information)
CREATE TABLE IF NOT EXISTS exam_info (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER,
  exam_slug VARCHAR(255),
  title VARCHAR(500),
  description TEXT,
  eligibility TEXT,
  important_dates JSONB DEFAULT '{}',
  application_process TEXT,
  syllabus TEXT,
  exam_pattern TEXT,
  year INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_info_exam ON exam_info(exam_id);

-- Exam seasons
CREATE TABLE IF NOT EXISTS exam_seasons (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER,
  name VARCHAR(255),
  season VARCHAR(50),
  year INTEGER,
  start_date DATE,
  end_date DATE,
  notification_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_seasons_exam ON exam_seasons(exam_id);

-- Tag configs
CREATE TABLE IF NOT EXISTS tag_configs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  label VARCHAR(255),
  color VARCHAR(20),
  icon VARCHAR(100),
  route VARCHAR(500),
  filter_key VARCHAR(100),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz questions (junction table for quizzes)
CREATE TABLE IF NOT EXISTS daily_quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, question_id)
);

-- Daily quizzes
CREATE TABLE IF NOT EXISTS daily_quizzes (
  id SERIAL PRIMARY KEY,
  quiz_date DATE UNIQUE NOT NULL,
  title VARCHAR(255),
  total_questions INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_daily_quizzes_date ON daily_quizzes(quiz_date);

-- Study streaks
CREATE TABLE IF NOT EXISTS study_streaks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  total_active_days INTEGER DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_streaks_user ON study_streaks(user_id);

-- Transactions (payment records)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  order_id VARCHAR(255),
  payment_id VARCHAR(255),
  amount NUMERIC(10,2),
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(50) DEFAULT 'pending',
  plan_id VARCHAR(100),
  coupon_code VARCHAR(100),
  gateway VARCHAR(50) DEFAULT 'razorpay',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(100),
  subject VARCHAR(500),
  body TEXT,
  variables JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Navigation config
CREATE TABLE IF NOT EXISTS navigation_config (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  path VARCHAR(500),
  icon VARCHAR(100),
  category VARCHAR(100),
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Section aliases
CREATE TABLE IF NOT EXISTS section_aliases (
  id SERIAL PRIMARY KEY,
  section_id INTEGER,
  canonical_name VARCHAR(255),
  alias_name VARCHAR(255),
  alias VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE section_aliases ADD COLUMN IF NOT EXISTS section_id INTEGER;
ALTER TABLE section_aliases ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
ALTER TABLE section_aliases ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255);
ALTER TABLE section_aliases ADD COLUMN IF NOT EXISTS alias_name VARCHAR(255);
ALTER TABLE section_aliases ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE section_aliases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_section_aliases_section ON section_aliases(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_section_aliases_alias ON section_aliases(alias_name) WHERE alias_name IS NOT NULL;

-- Payments ledger (admin-facing) — P1 FIX: ensure via migration, not runtime CREATE TABLE
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  gateway VARCHAR(50),
  gateway_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  refunded_at TIMESTAMP,
  refunded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_id ON payments(gateway_payment_id);

-- Attempt answers (detailed answer tracking)
CREATE TABLE IF NOT EXISTS attempt_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  selected_option_id INTEGER,
  selected_option VARCHAR(100),
  is_correct BOOLEAN DEFAULT FALSE,
  is_unattempted BOOLEAN DEFAULT TRUE,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON attempt_answers(question_id);
