-- Migration 109: Columns referenced by the admin assessment/quiz/series forms.
-- Closes frontend<->backend contract gaps where form fields had no backing column:
--   quizzes: negative_marking, shuffle_options, chapter, question_ids, tags
--   test_series: "order", banner_asset_id, promotion_banner_asset_id
--   questions: hint

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS negative_marking NUMERIC(5,2) DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS chapter VARCHAR(255);
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_ids JSONB DEFAULT '[]';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

ALTER TABLE test_series ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS banner_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS promotion_banner_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS hint TEXT;
