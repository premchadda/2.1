-- =====================================================
-- Analytics Tables Migration
-- User performance, topic analytics, and spaced repetition
-- Created: 2026-04-30
-- =====================================================

-- =====================================================
-- 1. USER TOPIC STATS - Per-topic performance per user
-- =====================================================
CREATE TABLE IF NOT EXISTS user_topic_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  total_attempts INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  wrong_answers INTEGER DEFAULT 0,
  unattempted_answers INTEGER DEFAULT 0,
  total_time_spent_seconds INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  last_attempted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_topic_stats_user_id ON user_topic_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_stats_topic ON user_topic_stats(topic);
CREATE INDEX IF NOT EXISTS idx_user_topic_stats_accuracy ON user_topic_stats(accuracy);

-- =====================================================
-- 2. TOPIC ANALYTICS - Aggregate topic performance
-- =====================================================
CREATE TABLE IF NOT EXISTS topic_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_bucket DATE NOT NULL,
  topic VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  attempt_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  unattempted_count INTEGER DEFAULT 0,
  avg_accuracy DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date_bucket, topic)
);

CREATE INDEX IF NOT EXISTS idx_topic_analytics_date ON topic_analytics(date_bucket);
CREATE INDEX IF NOT EXISTS idx_topic_analytics_topic ON topic_analytics(topic);

-- =====================================================
-- 3. WRONG QUESTIONS - Track questions user got wrong
-- =====================================================
CREATE TABLE IF NOT EXISTS wrong_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_attempt_id INTEGER REFERENCES attempts(id) ON DELETE SET NULL,
  wrong_count INTEGER DEFAULT 1,
  last_seen_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_wrong_questions_user_id ON wrong_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_question_id ON wrong_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_active ON wrong_questions(is_active);

-- =====================================================
-- 4. REVISION QUEUE - Spaced repetition scheduling
-- =====================================================
CREATE TABLE IF NOT EXISTS revision_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_attempt_id INTEGER REFERENCES attempts(id) ON DELETE SET NULL,
  schedule_day INTEGER NOT NULL,
  due_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_queue_user_id ON revision_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_queue_due_at ON revision_queue(due_at);
CREATE INDEX IF NOT EXISTS idx_revision_queue_status ON revision_queue(status);

-- =====================================================
-- 5. STUDY STREAKS - Daily study tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS study_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  total_active_days INTEGER DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_streaks_user_id ON study_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_study_streaks_streak ON study_streaks(current_streak);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Run: psql -d your_database -f analytics-migration.sql
-- Verify: \dt user_topic_stats topic_analytics wrong_questions revision_queue study_streaks