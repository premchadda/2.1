-- Migration 065: Create tables that previously existed only in postgres-helpers.js initTables()
-- These tables had no SQL migration file, meaning they were only created at runtime.
-- Using CREATE TABLE IF NOT EXISTS so this migration is safe to run multiple times.

-- 1. test_sections
CREATE TABLE IF NOT EXISTS "test_sections" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES test_categories(id) ON DELETE SET NULL,
  description TEXT,
  duration INTEGER DEFAULT 60,
  passing_marks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_sections_category ON test_sections(category_id);
CREATE INDEX IF NOT EXISTS idx_test_sections_order ON test_sections(display_order);

-- 2. login_attempts
CREATE TABLE IF NOT EXISTS "login_attempts" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(100) NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW(),
  successful BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at DESC);

-- 3. user_sessions
CREATE TABLE IF NOT EXISTS "user_sessions" (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(50),
  os VARCHAR(50),
  country VARCHAR(100),
  country_code VARCHAR(10),
  city VARCHAR(100),
  region VARCHAR(100),
  session_type VARCHAR(50) DEFAULT 'web',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- 4. practice_sessions
CREATE TABLE IF NOT EXISTS "practice_sessions" (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id         VARCHAR(255),
  subject_id      INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id      INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  topic_id        INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  mode            VARCHAR(32) NOT NULL,
  difficulty      VARCHAR(16),
  target_count    INTEGER,
  time_limit_sec  INTEGER,
  questions_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_index   INTEGER DEFAULT 0,
  correct_count   INTEGER DEFAULT 0,
  wrong_count      INTEGER DEFAULT 0,
  skipped_count   INTEGER DEFAULT 0,
  started_at      TIMESTAMP DEFAULT NOW(),
  last_active_at  TIMESTAMP,
  completed_at    TIMESTAMP,
  is_active       BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id, is_active);

-- 5. practice_answers
CREATE TABLE IF NOT EXISTS "practice_answers" (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      INTEGER REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id     INTEGER NOT NULL,
  selected_option INTEGER,
  is_correct      BOOLEAN,
  is_skipped      BOOLEAN DEFAULT false,
  time_taken_sec  INTEGER,
  mode            VARCHAR(32),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_practice_answers_user_q ON practice_answers(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_wrong ON practice_answers(user_id, is_correct) WHERE is_correct = false;

-- 6. question_bookmarks
CREATE TABLE IF NOT EXISTS "question_bookmarks" (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id  INTEGER NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- 7. practice_streaks
CREATE TABLE IF NOT EXISTS "practice_streaks" (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak    INTEGER DEFAULT 0,
  longest_streak    INTEGER DEFAULT 0,
  last_practice_date DATE,
  total_sessions    INTEGER DEFAULT 0,
  total_questions   INTEGER DEFAULT 0,
  total_correct     INTEGER DEFAULT 0
);

-- 8. practice_ai_cache
CREATE TABLE IF NOT EXISTS "practice_ai_cache" (
  question_id    INTEGER NOT NULL,
  feature        VARCHAR(32) NOT NULL,
  content        JSONB NOT NULL,
  model          VARCHAR(64),
  generated_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (question_id, feature)
);

-- 9. practice_daily_sets
CREATE TABLE IF NOT EXISTS "practice_daily_sets" (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_date     DATE NOT NULL,
  questions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_completed BOOLEAN DEFAULT false,
  score        INTEGER,
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, set_date)
);

-- 10. question_reports
CREATE TABLE IF NOT EXISTS "question_reports" (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  question_id  INTEGER NOT NULL,
  reason       VARCHAR(100),
  notes        TEXT,
  status       VARCHAR(32) DEFAULT 'open',
  created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_question_reports_q ON question_reports(question_id);

-- 11. csrf_tokens
CREATE TABLE IF NOT EXISTS "csrf_tokens" (
  id SERIAL PRIMARY KEY,
  csrf_token TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens(expires_at);
