-- Migration 106: Node Engine V2 Learning Graph & User Skill Model

-- 1. Create nodes table (V1 baseline + V2 AI layer)
CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    parent_id INT REFERENCES nodes(id) ON DELETE CASCADE,
    node_type VARCHAR(50) DEFAULT 'topic', -- 'exam', 'stage', 'subject', 'chapter', 'topic', 'subtopic'
    exam_id INT,
    subject_id INT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    ai_meta JSONB DEFAULT '{"difficulty_score": 0.5, "mastery_score": 0.0, "attempt_count": 0, "correct_rate": 0.0, "recommendation_weight": 0.5}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure ai_meta column exists if nodes table was created previously
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS ai_meta JSONB DEFAULT '{"difficulty_score": 0.5, "mastery_score": 0.0, "attempt_count": 0, "correct_rate": 0.0, "recommendation_weight": 0.5}'::jsonb;

-- 2. Create user_node_skill table (V2 AI skill model)
CREATE TABLE IF NOT EXISTS user_node_skill (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id INT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    mastery_score FLOAT DEFAULT 0.0,      -- 0.0 to 1.0
    confidence_score FLOAT DEFAULT 0.0,   -- self + performance
    attempt_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    last_attempted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_user_node_skill_user ON user_node_skill(user_id);
CREATE INDEX IF NOT EXISTS idx_user_node_skill_node ON user_node_skill(node_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
