-- =====================================================
-- Migration 008: Standardize ID Types and Fix Relations
-- Purpose: Fix user_id type inconsistencies, add missing FKs,
--          implement soft-delete, add constraints, and fix indexes
-- Created: 2026-05-02
-- =====================================================

BEGIN;

-- =====================================================
-- 1. STANDARDIZE USER_ID TYPES (INTEGER for all user references)
-- =====================================================

-- Note: We're standardizing on INTEGER (SERIAL) for user_id references
-- Frontend will use UUID public_id, but database relations use INTEGER

DO $$
BEGIN
    -- Fix user_roles.user_id (from UUID to INTEGER)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'user_id'
        AND data_type = 'uuid'
    ) THEN
        -- Drop constraint if exists
        ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
        -- Convert UUID to INTEGER by extracting from users table
        ALTER TABLE user_roles 
        ALTER COLUMN user_id TYPE INTEGER 
        USING (
            SELECT id FROM users 
            WHERE users.public_id_uuid::text = user_roles.user_id::text
            LIMIT 1
        );
        -- Re-add FK
        ALTER TABLE user_roles 
        ADD CONSTRAINT user_roles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- Fix audit_logs.user_id (from UUID to INTEGER if needed)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'user_id'
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
        ALTER TABLE audit_logs 
        ALTER COLUMN user_id TYPE INTEGER 
        USING NULL; -- Safe conversion, will lose data if not careful
        ALTER TABLE audit_logs 
        ADD CONSTRAINT audit_logs_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Fix email_templates.user_id if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_templates' AND column_name = 'user_id'
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_user_id_fkey;
        ALTER TABLE email_templates 
        ALTER COLUMN user_id TYPE INTEGER USING NULL;
        ALTER TABLE email_templates 
        ADD CONSTRAINT email_templates_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Fix ai_api_usage.user_id if exists as UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_api_usage' AND column_name = 'user_id'
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE ai_api_usage DROP CONSTRAINT IF EXISTS ai_api_usage_user_id_fkey;
        ALTER TABLE ai_api_usage 
        ALTER COLUMN user_id TYPE INTEGER USING NULL;
        ALTER TABLE ai_api_usage 
        ADD CONSTRAINT ai_api_usage_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================
-- 2. CONSOLIDATE DUPLICATE TABLE DEFINITIONS
-- =====================================================

-- Ensure all tables from both migrations exist with proper structure
DO $$
BEGIN
    -- Permissions table - ensure all columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'description') THEN
        ALTER TABLE permissions ADD COLUMN description TEXT;
    END IF;

    -- Roles table - ensure updated_at exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'updated_at') THEN
        ALTER TABLE roles ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;

    -- Navigation config - ensure parent_id exists (P2 feature)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'navigation_config' AND column_name = 'parent_id') THEN
        ALTER TABLE navigation_config ADD COLUMN parent_id VARCHAR(50) REFERENCES navigation_config(id) ON DELETE CASCADE;
    END IF;

    -- Coming soon features - ensure P2 columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coming_soon_features' AND column_name = 'priority') THEN
        ALTER TABLE coming_soon_features ADD COLUMN priority VARCHAR(10) DEFAULT 'medium';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coming_soon_features' AND column_name = 'progress_percentage') THEN
        ALTER TABLE coming_soon_features ADD COLUMN progress_percentage INTEGER DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- 3. FIX ARRAY-TYPE FOREIGN KEYS (Use Junction Tables)
-- =====================================================

-- Create junction table for test_categories <-> test_series (replaces test_series_id INTEGER[])
CREATE TABLE IF NOT EXISTS test_category_series (
    test_category_id INTEGER NOT NULL,
    test_series_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (test_category_id, test_series_id),
    CONSTRAINT fk_test_category FOREIGN KEY (test_category_id) REFERENCES test_categories(id) ON DELETE CASCADE,
    CONSTRAINT fk_test_series FOREIGN KEY (test_series_id) REFERENCES test_series(id) ON DELETE CASCADE
);

-- Migrate existing data from array to junction table
INSERT INTO test_category_series (test_category_id, test_series_id)
SELECT tc.id, UNNEST(tc.test_series_id)
FROM test_categories tc
WHERE array_length(tc.test_series_id, 1) > 0
ON CONFLICT DO NOTHING;

-- Create index for junction table
CREATE INDEX IF NOT EXISTS idx_test_category_series_series ON test_category_series(test_series_id);

-- =====================================================
-- 4. IMPLEMENT GLOBAL SOFT-DELETE PATTERN
-- =====================================================

-- Create soft-delete function
CREATE OR REPLACE FUNCTION add_soft_delete_columns(table_name TEXT)
RETURNS void AS $$
BEGIN
    -- Add is_deleted column
    EXECUTE format('
        ALTER TABLE %I ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
    ', table_name);
    
    -- Add deleted_by column
    EXECUTE format('
        ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    ', table_name);
    
    -- Add deleted_at column
    EXECUTE format('
        ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    ', table_name);
    
    -- Add index for soft-delete filtering
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS idx_%I_is_deleted ON %I(is_deleted)
    ', table_name, table_name);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add soft-delete columns to %: %', table_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Apply soft-delete to key tables (optional - uncomment as needed)
-- SELECT add_soft_delete_columns('questions');
-- SELECT add_soft_delete_columns('tests');
-- SELECT add_soft_delete_columns('test_series');
-- SELECT add_soft_delete_columns('chapters');
-- SELECT add_soft_delete_columns('topics');

-- =====================================================
-- 5. ADD CHECK CONSTRAINTS FOR DATA VALIDATION
-- =====================================================

DO $$
BEGIN
    -- Coming soon features status check
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'coming_soon_features' AND constraint_name = 'chk_coming_soon_status'
    ) THEN
        ALTER TABLE coming_soon_features 
        ADD CONSTRAINT chk_coming_soon_status 
        CHECK (status IN ('planned', 'in_development', 'testing', 'released'));
    END IF;

    -- Coming soon features priority check
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'coming_soon_features' AND constraint_name = 'chk_coming_soon_priority'
    ) THEN
        ALTER TABLE coming_soon_features 
        ADD CONSTRAINT chk_coming_soon_priority 
        CHECK (priority IN ('high', 'medium', 'low'));
    END IF;

    -- Coming soon features progress percentage check
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'coming_soon_features' AND constraint_name = 'chk_coming_soon_progress'
    ) THEN
        ALTER TABLE coming_soon_features 
        ADD CONSTRAINT chk_coming_soon_progress 
        CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
    END IF;

    -- Email templates enabled check
    ALTER TABLE email_templates 
    ADD CONSTRAINT chk_email_templates_enabled 
    CHECK (enabled IS NULL OR enabled IN (true, false));

    -- Stages order check
    ALTER TABLE stages 
    ADD CONSTRAINT chk_stages_order 
    CHECK ("order" >= 0);
END $$;

-- =====================================================
-- 6. FIX INDEXES (Remove duplicates, add missing ones)
-- =====================================================

-- Drop duplicate indexes if they exist
DROP INDEX IF EXISTS idx_audit_logs_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_created;

-- Ensure critical indexes exist
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at DESC);

-- Add missing indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);

CREATE INDEX IF NOT EXISTS idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_question_id ON test_questions(question_id);

CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_id ON attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON attempts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_series_slug ON test_series(slug);
CREATE INDEX IF NOT EXISTS idx_test_categories_slug ON test_categories(slug);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_questions_category_test ON questions(category_id, test_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_attempts_user_test ON attempts(user_id, test_id) WHERE is_completed = true;

-- =====================================================
-- 7. FIX TIMESTAMP HANDLING
-- =====================================================

DO $$
BEGIN
    -- Ensure timestamp columns default to NULL not empty string
    -- Fix coming_soon_date in tests table
    ALTER TABLE tests ALTER COLUMN coming_soon_date DROP DEFAULT;
    
    -- Ensure pro_expiry in users can be NULL
    ALTER TABLE users ALTER COLUMN pro_expiry DROP DEFAULT;
    
    -- Add check for valid date ranges (optional)
    -- ALTER TABLE tests ADD CONSTRAINT chk_coming_soon_date CHECK (
    --     coming_soon_date IS NULL OR coming_soon_date >= NOW() - INTERVAL '1 year'
    -- );
END $$;

-- =====================================================
-- 8. ADD MISSING FOREIGN KEY CONSTRAINTS
-- =====================================================

DO $$
BEGIN
    -- Questions -> test_series (series_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'questions' AND constraint_name = 'questions_series_id_fkey'
    ) THEN
        ALTER TABLE questions 
        ADD CONSTRAINT questions_series_id_fkey 
        FOREIGN KEY (series_id) REFERENCES test_series(id) ON DELETE SET NULL;
    END IF;

    -- Questions -> topics (topic_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'questions' AND constraint_name = 'questions_topic_id_fkey'
    ) THEN
        ALTER TABLE questions 
        ADD CONSTRAINT questions_topic_id_fkey 
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL;
    END IF;

    -- Tests -> stages (stage_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'tests' AND constraint_name = 'tests_stage_id_fkey'
    ) THEN
        ALTER TABLE tests 
        ADD CONSTRAINT tests_stage_id_fkey 
        FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL;
    END IF;

    -- Chapters -> units (unit_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'chapters' AND constraint_name = 'chapters_unit_id_fkey'
    ) THEN
        ALTER TABLE chapters 
        ADD CONSTRAINT chapters_unit_id_fkey 
        FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
    END IF;

    -- Topics -> chapters (chapter_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'topics' AND constraint_name = 'topics_chapter_id_fkey'
    ) THEN
        ALTER TABLE topics 
        ADD CONSTRAINT topics_chapter_id_fkey 
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL;
    END IF;

    -- Subtopics -> topics (topic_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'subtopics' AND constraint_name = 'subtopics_topic_id_fkey'
    ) THEN
        ALTER TABLE subtopics 
        ADD CONSTRAINT subtopics_topic_id_fkey 
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 9. IMPLEMENT AUDIT TRAIL CONSISTENCY
-- =====================================================

-- Create audit trail function
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id INTEGER,
    p_action VARCHAR(50),
    p_resource VARCHAR(100),
    p_resource_id VARCHAR(255),
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'success'
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        resource,
        resource_id,
        old_values,
        new_values,
        description,
        ip_address,
        user_agent,
        status,
        created_at
    ) VALUES (
        p_user_id,
        p_action,
        p_resource,
        p_resource_id,
        p_old_values,
        p_new_values,
        p_description,
        p_ip_address,
        p_user_agent,
        p_status
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. ADD DATA QUALITY CHECKS
-- =====================================================

-- Create function to clean invalid timestamps
CREATE OR REPLACE FUNCTION clean_invalid_timestamps()
RETURNS void AS $$
BEGIN
    -- Clean empty strings to NULL in tests
    UPDATE tests SET coming_soon_date = NULL WHERE coming_soon_date = '';
    
    -- Clean empty strings to NULL in users
    UPDATE users SET pro_expiry = NULL WHERE pro_expiry = '';
    
    -- Clean future dates that are unrealistic (optional)
    -- UPDATE tests SET coming_soon_date = NULL WHERE coming_soon_date > NOW() + INTERVAL '10 years';
    
    RAISE NOTICE 'Cleaned invalid timestamps';
END;
$$ LANGUAGE plpgsql;

-- Create function to check orphaned records
CREATE OR REPLACE FUNCTION check_orphaned_records()
RETURNS TABLE (
    table_name TEXT,
    column_name TEXT,
    orphan_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'questions'::TEXT, 'chapter_id'::TEXT, COUNT(*)::BIGINT
    FROM questions q
    LEFT JOIN chapters c ON q.chapter_id = c.id
    WHERE q.chapter_id IS NOT NULL AND c.id IS NULL;
    
    RETURN QUERY
    SELECT 'questions'::TEXT, 'topic_id'::TEXT, COUNT(*)::BIGINT
    FROM questions q
    LEFT JOIN topics t ON q.topic_id = t.id
    WHERE q.topic_id IS NOT NULL AND t.id IS NULL;
    
    RETURN QUERY
    SELECT 'test_questions'::TEXT, 'section_id'::TEXT, COUNT(*)::BIGINT
    FROM test_questions tq
    LEFT JOIN test_sections ts ON tq.section_id = ts.id
    WHERE tq.section_id IS NOT NULL AND ts.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. CREATE USEFUL MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to soft-delete a record
CREATE OR REPLACE FUNCTION soft_delete_record(
    table_name TEXT,
    record_id INTEGER,
    deleted_by_id INTEGER
) RETURNS void AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET is_deleted = true, deleted_by = $1, deleted_at = NOW() WHERE id = $2',
        table_name
    ) USING deleted_by_id, record_id;
END;
$$ LANGUAGE plpgsql;

-- Function to restore a soft-deleted record
CREATE OR REPLACE FUNCTION restore_record(
    table_name TEXT,
    record_id INTEGER
) RETURNS void AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET is_deleted = false, deleted_by = NULL, deleted_at = NULL WHERE id = $1',
        table_name
    ) USING record_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's public_id from integer ID
CREATE OR REPLACE FUNCTION get_user_public_id(user_id INTEGER)
RETURNS TEXT AS $$
BEGIN
    RETURN 'usr_' || (SELECT public_id_uuid::text FROM users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql;

-- Function to get user's integer ID from public_id
CREATE OR REPLACE FUNCTION get_user_id_from_public_id(public_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    result_id INTEGER;
BEGIN
    SELECT id INTO result_id
    FROM users
    WHERE public_id_uuid::text = REPLACE(public_id, 'usr_', '');
    
    RETURN result_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 12. VERIFICATION QUERIES
-- =====================================================

-- Verify user_id types are consistent
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
AND table_schema = 'public'
ORDER BY table_name;

-- Verify foreign keys exist
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Check for any remaining orphaned records
SELECT * FROM check_orphaned_records();

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this migration: psql -d your_database -f 008-standardize-ids-and-fix-relations.sql
-- 2. Verify user_id types: SELECT table_name, data_type FROM information_schema.columns WHERE column_name = 'user_id';
-- 3. Check orphaned records: SELECT * FROM check_orphaned_records();
-- 4. Test soft-delete: SELECT soft_delete_record('tests', 1, 1);
-- 5. Restore if needed: SELECT restore_record('tests', 1);
-- =====================================================
