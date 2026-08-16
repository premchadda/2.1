-- Migration 093: HNSW Vector Index Tuning for High-Scale Semantic Search (1M+ Embeddings)
-- Replaces legacy IVFFlat indexes with HNSW (Hierarchical Navigable Small World) indexes
-- for higher recall and ultra-fast cosine similarity search without requiring minimum row warmup limits.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    
    -- 1. General Embeddings Table HNSW Index
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'embeddings') THEN
      -- Drop legacy ivfflat index if present
      DROP INDEX IF EXISTS idx_embeddings_vector_ivfflat;
      
      -- Create high-performance HNSW index for 1M+ embeddings scale
      CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
        ON embeddings USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

    -- 2. Question Search Index HNSW Index
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_search_index') THEN
      -- Drop legacy ivfflat index if present
      DROP INDEX IF EXISTS idx_search_embedding;
      
      -- Create high-performance HNSW index for question vector search
      CREATE INDEX IF NOT EXISTS idx_question_search_vector_hnsw
        ON question_search_index USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    END IF;

  END IF;
END $$;
