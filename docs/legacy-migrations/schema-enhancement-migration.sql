-- =====================================================
-- Global Schema Enhancement Migration
-- Adds missing columns and indexes for data consistency
-- Created: 2026-04-30
-- =====================================================

-- =====================================================
-- 1. ADD MISSING TIMESTAMPS (created_at, updated_at)
-- =====================================================

-- Add created_at to tables missing it
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE attempt_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE test_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE ui_tag_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE practice_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE daily_quizzes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add updated_at to tables missing it
ALTER TABLE achievement_definitions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE attempt_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE banners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE daily_quiz_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE daily_quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE discussion_votes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE exam_updates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE exam_yearly_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE platform_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE pyp_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE practice_answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE quick_access ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE subscription_features ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE topic_tests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE ui_tag_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE user_recommendations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE question_options ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- =====================================================
-- 2. ADD is_active SOFT-DELETE FLAG
-- =====================================================

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE attempt_events ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE coming_soon_features ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE csrf_tokens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE daily_quiz_attempts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE daily_quiz_questions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE discussion_votes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE migration_progress ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE navigation_config ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE practice_answers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE pyp_attempts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE question_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE revision_queue ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE study_streaks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE test_questions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE topic_analytics ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE user_topic_stats ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- 3. ADD MISSING INDEXES ON FOREIGN KEYS
-- =====================================================

-- Index on user_id
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_question_discussions_user_id ON _backup_question_discussions(user_id);

-- Index on question_id
CREATE INDEX IF NOT EXISTS idx_backup_question_discussions_question_id ON _backup_question_discussions(question_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question_id ON question_attempts(question_id);

-- Index on attempt_id
CREATE INDEX IF NOT EXISTS idx_attempt_events_attempt_id ON attempt_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_attempt_id ON question_attempts(attempt_id);

-- Index on quiz_id
CREATE INDEX IF NOT EXISTS idx_daily_quiz_attempts_quiz_id ON daily_quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_daily_quiz_questions_quiz_id ON daily_quiz_questions(quiz_id);

-- Index on discussion_id
CREATE INDEX IF NOT EXISTS idx_discussion_votes_discussion_id ON discussion_votes(discussion_id);

-- Index on exam_id
CREATE INDEX IF NOT EXISTS idx_enrollments_exam_id ON enrollments(exam_id);

-- Index on study_material_id
CREATE INDEX IF NOT EXISTS idx_enrollments_study_material_id ON enrollments(study_material_id);

-- Index on category_id
CREATE INDEX IF NOT EXISTS idx_exams_category_id ON exams(category_id);

-- Index on topic_id
CREATE INDEX IF NOT EXISTS idx_subject_pdfs_topic_id ON subject_pdfs(topic_id);
CREATE INDEX IF NOT EXISTS idx_subject_videos_topic_id ON subject_videos(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_tests_topic_id ON topic_tests(topic_id);

-- Index on created_by
CREATE INDEX IF NOT EXISTS idx_promotions_created_by ON promotions(created_by);

-- Index on parent_id
CREATE INDEX IF NOT EXISTS idx_navigation_config_parent_id ON navigation_config(parent_id);

-- Index on role_id, permission_id
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Index on achievement_id
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- Index on test_id
CREATE INDEX IF NOT EXISTS idx_test_sections_test_id ON test_sections(test_id);
CREATE INDEX IF NOT EXISTS idx_pyp_papers_stage_id ON pyp_papers(stage_id);

-- Index on series_id
ALTER TABLE tests ADD COLUMN IF NOT EXISTS series_id INTEGER REFERENCES test_series(id);

-- =====================================================
-- 4. ADD PUBLIC_ID FOR API EXPOSURE (optional, for sensitive tables)
-- =====================================================

-- Add public_id to sensitive tables that need obfuscated IDs in API responses
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE backups ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE leaderboards ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;
ALTER TABLE units ADD COLUMN IF NOT EXISTS public_id VARCHAR(50) UNIQUE;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify columns were added
SELECT 
    'created_at added' AS check,
    COUNT(DISTINCT table_name) AS tables_modified
FROM information_schema.columns
WHERE column_name = 'created_at' AND table_schema = 'public';

SELECT 
    'is_active added' AS check,
    COUNT(DISTINCT table_name) AS tables_modified
FROM information_schema.columns
WHERE column_name = 'is_active' AND table_schema = 'public';

SELECT 
    'indexes added' AS check,
    COUNT(*) AS indexes_created
FROM pg_indexes
WHERE indexname LIKE 'idx_%' AND schemaname = 'public'
AND indexname NOT IN (SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%' AND schemaname = 'public' LIMIT 0);