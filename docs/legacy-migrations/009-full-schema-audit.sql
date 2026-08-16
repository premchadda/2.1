-- =====================================================
-- COMPREHENSIVE DATABASE SCHEMA AUDIT
-- Run this in Supabase SQL Editor to check all issues
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- 1. USER ID TYPE CONSISTENCY
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 1: User ID Type Consistency' as check_name,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
AND table_schema = 'public'
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════
-- 2. TABLE ID TYPES (permissions, roles, etc.)
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 2: Core Tables ID Types' as check_name,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('permissions', 'roles', 'user_roles', 'role_permissions', 'audit_logs', 'navigation_config', 'coming_soon_features')
AND column_name = 'id'
AND table_schema = 'public';

-- ═══════════════════════════════════════════════════════
-- 3. FOREIGN KEY CONSTRAINTS
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 3: Foreign Keys' as check_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Check for MISSING foreign keys on critical columns
SELECT 
  'CHECK 3b: Potentially Missing FKs' as check_name,
  kcu.table_name,
  kcu.column_name
FROM information_schema.key_column_usage kcu
LEFT JOIN information_schema.table_constraints tc 
  ON tc.constraint_name = kcu.constraint_name 
  AND tc.constraint_type = 'FOREIGN KEY'
WHERE kcu.table_schema = 'public'
AND kcu.column_name LIKE '%_id'
AND kcu.column_name NOT IN ('id', 'role_id', 'permission_id')
AND tc.constraint_name IS NULL
LIMIT 20;

-- ═══════════════════════════════════════════════════════
-- 4. ARRAY-TYPE COLUMNS
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 4: Array Type Columns' as check_name,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND data_type LIKE '%array%'
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════
-- 5. JSONB COLUMNS COUNT
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 5: JSONB Columns' as check_name,
  table_name,
  COUNT(*) as jsonb_count
FROM information_schema.columns
WHERE data_type = 'jsonb' AND table_schema = 'public'
GROUP BY table_name
ORDER BY jsonb_count DESC;

-- ═══════════════════════════════════════════════════════
-- 6. INDEX COVERAGE
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 6: Index Count' as check_name,
  COUNT(*) as total_indexes
FROM pg_indexes
WHERE schemaname = 'public';

-- Critical indexes check
SELECT 
  'CHECK 6b: Critical Indexes' as check_name,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
  'idx_questions_test_id',
  'idx_questions_category_id', 
  'idx_questions_chapter_id',
  'idx_questions_topic_id',
  'idx_attempts_user_id',
  'idx_attempts_test_id',
  'idx_tests_series_id',
  'idx_tests_stage_id'
);

-- ═══════════════════════════════════════════════════════
-- 7. SOFT DELETE COLUMNS
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 7: Soft Delete Columns' as check_name,
  table_name,
  column_name
FROM information_schema.columns
WHERE column_name IN ('is_deleted', 'deleted_by', 'deleted_at')
AND table_schema = 'public';

-- ═══════════════════════════════════════════════════════
-- 8. ORPHANED RECORDS CHECK
-- ═══════════════════════════════════════════════════════

SELECT 'CHECK 8: Orphaned Records' as check_name, 'questions -> chapter_id' as relationship, 
  COUNT(*) as orphan_count
FROM questions q
LEFT JOIN chapters c ON q.chapter_id = c.id
WHERE q.chapter_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT '', 'questions -> topic_id',
  COUNT(*)
FROM questions q
LEFT JOIN topics t ON q.topic_id = t.id
WHERE q.topic_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT '', 'attempts -> user_id',
  COUNT(*)
FROM attempts a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT '', 'attempts -> test_id',
  COUNT(*)
FROM attempts a
LEFT JOIN tests t ON a.test_id = t.id
WHERE a.test_id IS NOT NULL AND t.id IS NULL
UNION ALL
SELECT '', 'test_questions -> section_id',
  COUNT(*)
FROM test_questions tq
LEFT JOIN test_sections ts ON tq.section_id = ts.id
WHERE tq.section_id IS NOT NULL AND ts.id IS NULL;

-- ═══════════════════════════════════════════════════════
-- 9. TIMESTAMP ISSUES
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 9: Timestamp Default Issues' as check_name,
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND data_type LIKE '%timestamp%'
AND (column_default LIKE '%""%' OR column_default LIKE '%\'\'')
LIMIT 10;

-- ═══════════════════════════════════════════════════════
-- 10. PUBLIC ID COLUMNS
-- ═══════════════════════════════════════════════════════

SELECT 
  'CHECK 10: Public ID Columns' as check_name,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'public_id'
AND table_schema = 'public';

-- ═══════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════

SELECT 
  'SUMMARY' as check_name,
  'Tables' as metric,
  COUNT(DISTINCT table_name)::text as value
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT '', 'Foreign Keys',
  COUNT(DISTINCT constraint_name)::text
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
UNION ALL
SELECT '', 'Indexes',
  COUNT(*)::text
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT '', 'Functions',
  COUNT(*)::text
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;

-- ═══════════════════════════════════════════════════════
-- TEST HELPER FUNCTIONS (if they exist)
-- ═══════════════════════════════════════════════════════

-- Check if audit functions exist
SELECT 
  'FUNCTIONS CHECK' as check_name,
  proname as function_name
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND proname IN (
  'log_audit_event',
  'check_orphaned_records', 
  'clean_invalid_timestamps',
  'soft_delete_record',
  'restore_record',
  'get_user_public_id',
  'get_user_id_from_public_id'
);

-- ═══════════════════════════════════════════════════════
-- END OF AUDIT
-- ═══════════════════════════════════════════════════════