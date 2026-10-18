-- Migration 154: Allow NULL question_id in question_reports for exam-level reports & create video_progress table
--
-- Findings:
--  * Exam Error Reporting (POST /api/exam-info/report-error) was crashing with FK violation on question_id = 0
--    Allowing NULL question_id lets exam-level feedback be reported safely without a question context.
--  * Add exam_id column to question_reports so exam reports can optionally associate with the exam record.
--  * Create video_progress table for persisting video watch progress across server restarts.
--
-- Non-transactional-safe by design: migrationRunner wraps this file in its own transaction.

-- 1. Allow nullable question_id for exam/general content reports
ALTER TABLE question_reports ALTER COLUMN question_id DROP NOT NULL;

-- 2. Add optional exam_id column to question_reports
ALTER TABLE question_reports ADD COLUMN IF NOT EXISTS exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_question_reports_exam_id ON question_reports(exam_id);

-- 3. Persist video watch progress and playback checkpoints
CREATE TABLE IF NOT EXISTS video_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id VARCHAR(100) NOT NULL,
    last_timestamp NUMERIC(10, 2) DEFAULT 0,
    total_time_spent NUMERIC(10, 2) DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_video_progress_user_video UNIQUE (user_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_progress_user ON video_progress(user_id);
