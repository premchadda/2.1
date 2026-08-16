-- Migration 003: Baseline Sequence Harmonization & Critical Indexes
-- Establishes unbroken numerical continuity for migrations and ensures baseline tables/indexes exist.

-- 1. Ensure user_sessions has tracking columns
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- 2. Essential Performance Indexes
CREATE INDEX IF NOT EXISTS idx_attempts_user_completed ON attempts(user_id, score DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_questions_tags_gin ON questions USING GIN (tags) WHERE tags IS NOT NULL;
