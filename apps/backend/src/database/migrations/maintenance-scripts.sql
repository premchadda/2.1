-- =====================================================
-- Database Maintenance and Utility Scripts
-- Run these periodically to maintain database health
-- =====================================================

-- =====================================================
-- 1. CHECK DATABASE HEALTH
-- =====================================================

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check for missing indexes on FK columns
SELECT
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE contype = 'f'
AND conrelid::regclass::text NOT LIKE 'pg_%'
ORDER BY conrelid::regclass::text;

-- =====================================================
-- 2. CLEANUP ORPHANED RECORDS
-- =====================================================

-- Find orphaned questions (chapter_id)
SELECT COUNT(*) as orphaned_question_chapters
FROM questions q
LEFT JOIN chapters c ON q.chapter_id = c.id
WHERE q.chapter_id IS NOT NULL AND c.id IS NULL;

-- Find orphaned questions (topic_id)
SELECT COUNT(*) as orphaned_question_topics
FROM questions q
LEFT JOIN topics t ON q.topic_id = t.id
WHERE q.topic_id IS NOT NULL AND t.id IS NULL;

-- Find orphaned test_questions (section_id)
SELECT COUNT(*) as orphaned_test_questions_sections
FROM test_questions tq
LEFT JOIN test_sections ts ON tq.section_id = ts.id
WHERE tq.section_id IS NOT NULL AND ts.id IS NULL;

-- Find orphaned attempts (user_id)
SELECT COUNT(*) as orphaned_attempts_users
FROM attempts a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.user_id IS NOT NULL AND u.id IS NULL;

-- Clean orphaned questions (chapter_id)
-- WARNING: Review before running!
-- UPDATE questions 
-- SET chapter_id = NULL 
-- WHERE chapter_id IS NOT NULL 
-- AND NOT EXISTS (SELECT 1 FROM chapters WHERE id = questions.chapter_id);

-- Clean orphaned questions (topic_id)
-- WARNING: Review before running!
-- UPDATE questions 
-- SET topic_id = NULL 
-- WHERE topic_id IS NOT NULL 
-- AND NOT EXISTS (SELECT 1 FROM topics WHERE id = questions.topic_id);

-- =====================================================
-- 3. PERFORMANCE MAINTENANCE
-- =====================================================

-- Reindex all tables (run during low-traffic periods)
-- REINDEX TABLE public.questions;
-- REINDEX TABLE public.tests;
-- REINDEX TABLE public.attempts;

-- Analyze tables (update statistics for query planner)
ANALYZE public.questions;
ANALYZE public.tests;
ANALYZE public.attempts;
ANALYZE public.users;
ANALYZE public.test_series;
ANALYZE public.test_categories;

-- Vacuum analyze (reclaim storage and update statistics)
-- VACUUM ANALYZE public.questions;
-- VACUUM ANALYZE public.tests;
-- VACUUM ANALYZE public.attempts;

-- =====================================================
-- 4. AUDIT LOG MAINTENANCE
-- =====================================================

-- Count audit logs by status
SELECT 
    status,
    COUNT(*) as count
FROM audit_logs
GROUP BY status
ORDER BY count DESC;

-- Count audit logs by resource
SELECT 
    resource,
    COUNT(*) as count,
    MAX(created_at) as last_activity
FROM audit_logs
GROUP BY resource
ORDER BY count DESC;

-- Clean old successful audit logs (keep failures for 1 year)
-- DELETE FROM audit_logs 
-- WHERE status = 'success' 
-- AND created_at < NOW() - INTERVAL '1 year';

-- Find failed audit logs (potential issues)
SELECT 
    resource,
    action,
    COUNT(*) as failure_count
FROM audit_logs
WHERE status = 'failure'
GROUP BY resource, action
ORDER BY failure_count DESC;

-- =====================================================
-- 5. USER ACTIVITY ANALYSIS
-- =====================================================

-- Active users (last 30 days)
SELECT 
    COUNT(DISTINCT a.user_id) as active_users,
    COUNT(*) as total_attempts
FROM attempts a
WHERE a.created_at >= NOW() - INTERVAL '30 days';

-- User attempt distribution
SELECT 
    u.id as user_id,
    u.email,
    COUNT(a.id) as attempt_count,
    MAX(a.created_at) as last_attempt
FROM users u
LEFT JOIN attempts a ON u.id = a.user_id
GROUP BY u.id, u.email
ORDER BY attempt_count DESC
LIMIT 100;

-- =====================================================
-- 6. TEST ANALYSIS
-- =====================================================

-- Test attempts by category
SELECT 
    tc.category_id,
    ec.category_name,
    COUNT(t.id) as test_count,
    COUNT(a.id) as total_attempts
FROM test_categories tc
LEFT JOIN exam_categories ec ON tc.category_id = ec.category_id
LEFT JOIN tests t ON t.test_category_id = tc.id
LEFT JOIN attempts a ON a.test_id = t.id
GROUP BY tc.category_id, ec.category_name
ORDER BY total_attempts DESC;

-- Tests without attempts (potential issues)
SELECT 
    t.id,
    t.title,
    t.test_category_id
FROM tests t
LEFT JOIN attempts a ON t.id = a.test_id
WHERE a.id IS NULL
ORDER BY t.id;

-- =====================================================
-- 7. QUESTION ANALYSIS
-- =====================================================

-- Questions by category
SELECT 
    q.category_id,
    ec.category_name,
    COUNT(q.id) as question_count
FROM questions q
LEFT JOIN exam_categories ec ON q.category_id = ec.category_id
GROUP BY q.category_id, ec.category_name
ORDER BY question_count DESC;

-- Questions without test association
SELECT COUNT(*) as orphaned_questions
FROM questions q
WHERE q.test_id IS NULL 
AND q.is_practice = false;

-- =====================================================
-- 8. DATABASE SIZE AND GROWTH
-- =====================================================

-- Total database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Schema size breakdown
SELECT 
    schemaname,
    SUM(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY schemaname;

-- Table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- =====================================================
-- 9. INDEX MAINTENANCE
-- =====================================================

-- Find unused indexes (candidate for removal)
SELECT 
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(indexrelid)),
    idx_scan,
    idx_tup_read
FROM pg_stat_user_indexes
JOIN pg_index USING (indexrelid)
WHERE idx_scan = 0
AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find duplicate indexes
SELECT 
    array_agg(indexname),
    indrelid::regclass,
    indexdef
FROM pg_indexes
JOIN pg_index ON indexname = indexrelname
WHERE schemaname = 'public'
GROUP BY indrelid, indexdef
HAVING COUNT(*) > 1;

-- =====================================================
-- 10. CONNECTION AND LOCK MONITORING
-- =====================================================

-- Current connections
SELECT 
    datname,
    numbackends as connections,
    xact_commit,
    xact_rollback,
    tup_returned,
    tup_fetched,
    tup_inserted,
    tup_updated,
    tup_deleted
FROM pg_stat_database
WHERE datname = current_database();

-- Long-running queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
AND state != 'idle';

-- Locks
SELECT 
    blocked_locks.pid     AS blocked_pid,
    blocked_activity.usename  AS blocked_user,
    blocking_locks.pid     AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query    AS blocked_statement,
    blocking_activity.query   AS blocking_statement
FROM  pg_catalog.pg_locks         blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks         blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- =====================================================
-- 11. SOFT DELETE CLEANUP (Optional)
-- =====================================================

-- Count soft-deleted records by table
SELECT 'test_categories' as table_name, COUNT(*) as deleted_count 
FROM test_categories WHERE is_deleted = true
UNION ALL
SELECT 'questions', COUNT(*) FROM questions WHERE is_deleted = true
UNION ALL
SELECT 'tests', COUNT(*) FROM tests WHERE is_deleted = true
UNION ALL
SELECT 'chapters', COUNT(*) FROM chapters WHERE is_deleted = true
UNION ALL
SELECT 'topics', COUNT(*) FROM topics WHERE is_deleted = true;

-- Permanently delete old soft-deleted records (CAUTION!)
-- DELETE FROM test_categories WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '90 days';
-- DELETE FROM questions WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '90 days';
-- DELETE FROM tests WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL '90 days';

-- =====================================================
-- 12. EXPORT/BACKUP HELPERS
-- =====================================================

-- Export user data (for backup)
-- COPY (SELECT * FROM users WHERE id = 123) TO '/tmp/user_123.csv' WITH CSV HEADER;

-- Export test data with related questions
-- COPY (
--     SELECT t.*, q.* 
--     FROM tests t 
--     LEFT JOIN test_questions tq ON t.id = tq.test_id 
--     LEFT JOIN questions q ON tq.question_id = q.id 
--     WHERE t.id = 456
-- ) TO '/tmp/test_456_with_questions.csv' WITH CSV HEADER;

-- =====================================================
-- END OF MAINTENANCE SCRIPTS
-- =====================================================
