-- Migration 114: Reconcile test_series total_tests and free_tests to exclude transient Live Tests and Live Quizzes
-- Live tests are temporary events and should NOT contribute to permanent series inventory.

BEGIN;

UPDATE test_series s
SET total_tests = counts.actual_count,
    updated_at = NOW()
FROM (
  SELECT s2.id, COUNT(t.id)::integer AS actual_count
  FROM test_series s2
  LEFT JOIN tests t
    ON t.series_id = s2.id 
    AND COALESCE(t.is_deleted, false) = false
    AND COALESCE(t.is_active, true) = true
    AND COALESCE(t.is_live, false) = false
    AND COALESCE(t.type, '') NOT IN ('live-tests', 'live', 'quiz', 'quizzes', 'live-quiz', 'live-quizzes')
    AND COALESCE(t.test_type, '') NOT IN ('live-tests', 'live', 'quiz', 'quizzes', 'live-quiz', 'live-quizzes')
    AND COALESCE(t.category, '') NOT ILIKE '%live%'
    AND COALESCE(t.test_category_id, 0) <> 20
  WHERE COALESCE(s2.is_deleted, false) = false
  GROUP BY s2.id
) counts
WHERE s.id = counts.id
  AND COALESCE(s.total_tests, 0) <> counts.actual_count;

UPDATE test_series s
SET free_tests = counts.actual_count,
    updated_at = NOW()
FROM (
  SELECT s2.id, COUNT(t.id)::integer AS actual_count
  FROM test_series s2
  LEFT JOIN tests t
    ON t.series_id = s2.id 
    AND COALESCE(t.is_deleted, false) = false
    AND COALESCE(t.is_active, true) = true
    AND (t.type = 'Free' OR COALESCE(t.is_pro, false) = false)
    AND COALESCE(t.is_live, false) = false
    AND COALESCE(t.type, '') NOT IN ('live-tests', 'live', 'quiz', 'quizzes', 'live-quiz', 'live-quizzes')
    AND COALESCE(t.test_type, '') NOT IN ('live-tests', 'live', 'quiz', 'quizzes', 'live-quiz', 'live-quizzes')
    AND COALESCE(t.category, '') NOT ILIKE '%live%'
    AND COALESCE(t.test_category_id, 0) <> 20
  WHERE COALESCE(s2.is_deleted, false) = false
  GROUP BY s2.id
) counts
WHERE s.id = counts.id
  AND COALESCE(s.free_tests, 0) <> counts.actual_count;

COMMIT;
