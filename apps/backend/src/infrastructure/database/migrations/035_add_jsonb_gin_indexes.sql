-- =====================================================
-- Migration 035: Add GIN Indexes on JSONB Columns (CONCURRENT)
-- Purpose: Several JSONB columns are used in WHERE
--          clauses (attempts.section_timers,
--          live_tests.questions, daily_quizzes.questions,
--          users.notification_preferences, etc.). Without
--          GIN indexes, every query falls back to a full
--          table scan. This migration adds GIN indexes
--          where the column exists and is JSONB.
--
--          Resolves audit issue:
--            M5  - JSONB columns used in WHERE without
--                  GIN indexes
--
-- Concurrent: Uses CREATE INDEX CONCURRENTLY to avoid
--             blocking writes. MUST run outside transaction
--             block (no BEGIN/COMMIT wrapper). The runner
--             detects CONCURRENTLY and skips transaction.
--             Sets maintenance_work_mem for faster builds.
-- Idempotent: CREATE INDEX CONCURRENTLY IF NOT EXISTS on
--             each pair; safe to re-run.
-- Depends on: any prior migration that creates the
--             target tables.
-- =====================================================

SET maintenance_work_mem = '512MB';

-- attempts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_section_timers_gin ON attempts USING GIN (section_timers);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_section_scores_gin ON attempts USING GIN (section_scores);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_section_times_gin ON attempts USING GIN (section_times);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_answers_gin ON attempts USING GIN (answers);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempts_metadata_gin ON attempts USING GIN (metadata);
-- tests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_cutoff_marks_gin ON tests USING GIN (cutoff_marks);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_config_json_gin ON tests USING GIN (config_json);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_metadata_gin ON tests USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_category_path_ids_gin ON tests USING GIN (category_path_ids);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_category_path_names_gin ON tests USING GIN (category_path_names);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_languages_gin ON tests USING GIN (languages);
-- test_templates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_templates_config_json_gin ON test_templates USING GIN (config_json);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_templates_template_data_gin ON test_templates USING GIN (template_data);
-- live_tests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_tests_questions_gin ON live_tests USING GIN (questions);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_tests_answers_gin ON live_tests USING GIN (answers);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_tests_question_results_gin ON live_tests USING GIN (question_results);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_tests_solutions_gin ON live_tests USING GIN (solutions);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_tests_metadata_gin ON live_tests USING GIN (metadata);
-- question_versions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_versions_options_gin ON question_versions USING GIN (options);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_versions_metadata_gin ON question_versions USING GIN (metadata);
-- attempt_question_snapshots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempt_question_snapshots_options_gin ON attempt_question_snapshots USING GIN (options);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attempt_question_snapshots_metadata_gin ON attempt_question_snapshots USING GIN (metadata);
-- import_logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_logs_errors_gin ON import_logs USING GIN (errors);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_logs_metadata_gin ON import_logs USING GIN (metadata);
-- daily_quizzes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_quizzes_questions_gin ON daily_quizzes USING GIN (questions);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_quizzes_metadata_gin ON daily_quizzes USING GIN (metadata);
-- daily_quiz_attempts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_quiz_attempts_answers_gin ON daily_quiz_attempts USING GIN (answers);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_quiz_attempts_metadata_gin ON daily_quiz_attempts USING GIN (metadata);
-- users (jsonb prefs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_notification_preferences_gin ON users USING GIN (notification_preferences);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_privacy_gin ON users USING GIN (privacy);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_attempted_tests_gin ON users USING GIN (attempted_tests);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_enrolled_study_materials_gin ON users USING GIN (enrolled_study_materials);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_metadata_gin ON users USING GIN (metadata);
-- test_series, questions, study_materials, bookmarks, wrong_questions, revision_queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_series_metadata_gin ON test_series USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_options_gin ON questions USING GIN (options);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_metadata_gin ON questions USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_settings_gin ON questions USING GIN (settings);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_materials_metadata_gin ON study_materials USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_metadata_gin ON bookmarks USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wrong_questions_metadata_gin ON wrong_questions USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_revision_queue_metadata_gin ON revision_queue USING GIN (metadata);
-- pyp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pyp_papers_questions_gin ON pyp_papers USING GIN (questions);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pyp_papers_solutions_gin ON pyp_papers USING GIN (solutions);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pyp_attempts_answers_gin ON pyp_attempts USING GIN (answers);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pyp_attempts_question_results_gin ON pyp_attempts USING GIN (question_results);
-- practise_modules, audit_logs, notifications, current_affairs, leaderboard_snapshots, community_comments, user_topic_performance, user_answers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practise_modules_metadata_gin ON practise_modules USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_details_gin ON audit_logs USING GIN (details);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_old_values_gin ON audit_logs USING GIN (old_values);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_new_values_gin ON audit_logs USING GIN (new_values);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_metadata_gin ON notifications USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_current_affairs_metadata_gin ON current_affairs USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leaderboard_snapshots_rankings_gin ON leaderboard_snapshots USING GIN (rankings);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_community_comments_metadata_gin ON community_comments USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_topic_performance_metadata_gin ON user_topic_performance USING GIN (metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_answers_metadata_gin ON user_answers USING GIN (metadata);

RESET maintenance_work_mem;
