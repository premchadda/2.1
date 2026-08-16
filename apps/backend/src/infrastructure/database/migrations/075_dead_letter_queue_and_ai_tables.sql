-- Migration 075: DLQ, prompt versioning, persistent chats, and tsvector RAG chunks

-- 1. Create dead_letter_jobs table
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id SERIAL PRIMARY KEY,
  queue_name VARCHAR(100) NOT NULL,
  job_id VARCHAR(100) NOT NULL,
  job_name VARCHAR(100) NOT NULL,
  payload JSONB,
  error_message TEXT,
  error_stack TEXT,
  failed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_queue ON dead_letter_jobs(queue_name);
CREATE INDEX IF NOT EXISTS idx_dead_letter_failed ON dead_letter_jobs(failed_at DESC);

-- 2. Create prompt_templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default prompt templates
INSERT INTO prompt_templates (name, system_prompt, user_prompt_template)
VALUES (
  'study_plan',
  'You are an expert exam preparation mentor for Indian competitive exams (SSC, Railway, Banking, etc.). Create a personalized study plan based on the student''s performance analysis. The plan should be practical, achievable, and focused on improving weak areas. Include daily targets, weekly goals, and specific topics to focus on.',
  'Student Performance Analysis:\n- Overall Accuracy: {{overallAccuracy}}%\n- Total Questions Attempted: {{totalQuestionsAttempted}}\n\nWeak Topics:\n{{weakTopics}}\n\nSubject Performance:\n{{subjectPerformance}}\n\nDifficulty Performance:\n{{difficultyPerformance}}\n\nCreate a {{days}}-day study plan that focuses on these areas.'
), (
  'ai_mentor',
  'You are TrstPrep AI Mentor, an expert in Indian competitive exam preparation. You help students with subject doubts, exam strategy, study planning, and motivation. Be friendly, encouraging, and provide practical advice. Keep responses concise but helpful.',
  '{{message}}'
)
ON CONFLICT (name) DO NOTHING;

-- 3. Create ai_conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT 'New Chat',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);

-- 4. Create ai_messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);

-- 5. Create document_chunks table for PG tsvector RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_name VARCHAR(255) NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  tsv_content tsvector,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Trigger to auto-update tsv_content on insert/update
CREATE OR REPLACE FUNCTION document_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.tsv_content := to_tsvector('english', coalesce(NEW.content, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_chunks_tsv ON document_chunks;
CREATE TRIGGER trigger_document_chunks_tsv
BEFORE INSERT OR UPDATE ON document_chunks
FOR EACH ROW EXECUTE FUNCTION document_chunks_tsv_trigger();

CREATE INDEX IF NOT EXISTS idx_document_chunks_tsv ON document_chunks USING gin(tsv_content);
