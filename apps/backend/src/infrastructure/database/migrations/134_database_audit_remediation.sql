-- =====================================================
-- Migration 134: Database Audit Remediation
-- Purpose:
--   1. Create missing coming_soon_features & notification_preferences tables
--   2. Add missing idx_topics_subject index & GIN metadata indexes
--   3. Secure helper functions with SECURITY DEFINER and fixed search_path
--   4. Re-tune HNSW vector search indexes (m=32, ef_construction=200)
-- =====================================================

-- 1. Create missing tables
CREATE TABLE IF NOT EXISTS coming_soon_features (
    id SERIAL PRIMARY KEY,
    feature_key VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    eta VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    marketing BOOLEAN DEFAULT false,
    test_reminders BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_notification_preferences_user UNIQUE (user_id)
);

-- 2. Performance & GIN Indexes
DO $$
BEGIN
    -- Ensure topics table exists and has subject_id index
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'topics') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'topics' AND column_name = 'subject_id') THEN
            CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
        END IF;
    END IF;

    -- Ensure subject_topics has subject_id index
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_topics') THEN
        CREATE INDEX IF NOT EXISTS idx_topics_subject ON subject_topics(subject_id);
    END IF;
END $$;

-- GIN Indexes on JSONB metadata
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attempts' AND column_name = 'metadata') THEN
        CREATE INDEX IF NOT EXISTS idx_attempts_metadata_gin ON attempts USING gin (metadata);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'metadata') THEN
        CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING gin (metadata);
    END IF;
END $$;

-- 3. Security Definer & Search Path on Auth Helper Functions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_user_id_setting') THEN
        ALTER FUNCTION public.current_user_id_setting() SECURITY DEFINER SET search_path = public, pg_catalog, pg_temp;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_is_admin') THEN
        ALTER FUNCTION public.current_is_admin() SECURITY DEFINER SET search_path = public, pg_catalog, pg_temp;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_role') THEN
        ALTER FUNCTION public.is_service_role() SECURITY DEFINER SET search_path = public, pg_catalog, pg_temp;
    END IF;
END $$;

-- 4. HNSW Vector Search Index Re-Tuning (if pgvector extension and tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'embeddings') THEN
            DROP INDEX IF EXISTS idx_embeddings_vector_hnsw;
            CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
                ON embeddings USING hnsw (embedding vector_cosine_ops)
                WITH (m = 32, ef_construction = 200);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'question_search_index') THEN
            DROP INDEX IF EXISTS idx_question_search_vector_hnsw;
            CREATE INDEX IF NOT EXISTS idx_question_search_vector_hnsw
                ON question_search_index USING hnsw (embedding vector_cosine_ops)
                WITH (m = 32, ef_construction = 200);
        END IF;
    END IF;
END $$;
