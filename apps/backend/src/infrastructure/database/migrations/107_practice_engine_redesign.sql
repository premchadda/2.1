-- Migration 107: Practice Engine & Concept Graph Workspace Redesign
-- Adds fundamental skill drills, structured multi-tab explanations, community approaches,
-- knowledge vault categorized items, and learning telemetry.

CREATE TABLE IF NOT EXISTS fundamental_skill_drills (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- 'tables', 'squares', 'cubes', 'roots', 'fractions', 'ratios', 'triplets', 'mental_math'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  level INT DEFAULT 1,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_fundamental_mastery (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  level INT DEFAULT 1,
  score INT DEFAULT 0,
  best_speed_ms INT DEFAULT 0,
  total_attempts INT DEFAULT 0,
  last_practiced_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_fundamental_category UNIQUE(user_id, category)
);

CREATE TABLE IF NOT EXISTS question_explanations_v2 (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  explanation_text JSONB DEFAULT '{}'::jsonb, -- { concept, step_by_step, shortcut, common_mistake }
  explanation_visual JSONB DEFAULT '{}'::jsonb, -- { diagram_url, svg_content, animation_steps }
  explanation_video JSONB DEFAULT '{}'::jsonb, -- { video_url, duration, timestamps, transcript }
  explanation_formula JSONB DEFAULT '[]'::jsonb, -- [ { name, formula_latex, description } ]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_question_explanation UNIQUE(question_id)
);

CREATE TABLE IF NOT EXISTS question_approaches (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name VARCHAR(255),
  approach_type VARCHAR(50) NOT NULL, -- 'fastest', 'traditional', 'logical', 'formula', 'exam_shortcut', 'ai_method'
  title VARCHAR(255),
  content TEXT NOT NULL,
  time_complexity VARCHAR(50),
  upvotes INT DEFAULT 0,
  is_approved BOOLEAN DEFAULT true,
  is_community_best BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_vault_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  save_reason VARCHAR(50) NOT NULL, -- 'new_concept', 'hard_question', 'important_pyq', 'good_shortcut', 'needs_revision', 'mistake', 'favourite'
  collection_name VARCHAR(100) DEFAULT 'Default',
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_learning_telemetry (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id VARCHAR(100),
  time_spent_ms INT DEFAULT 0,
  is_correct BOOLEAN,
  hint_requested INT DEFAULT 0,
  explanation_tabs_viewed TEXT[] DEFAULT '{}',
  video_watched_pct INT DEFAULT 0,
  discussion_viewed BOOLEAN DEFAULT false,
  saved_to_vault BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundamental_mastery_user ON user_fundamental_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_question_approaches_q ON question_approaches(question_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_vault_user ON knowledge_vault_items(user_id, collection_name);
CREATE INDEX IF NOT EXISTS idx_learning_telemetry_user ON question_learning_telemetry(user_id, question_id);
