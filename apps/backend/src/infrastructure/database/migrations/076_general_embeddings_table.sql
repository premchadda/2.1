-- Migration 076: General-purpose embeddings table for semantic search across all content types

-- 1. Create embeddings table for multi-content-type vector search
CREATE TABLE IF NOT EXISTS embeddings (
  id SERIAL PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL,
  content_id INTEGER NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(content_type, content_id)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_id ON embeddings(content_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_composite ON embeddings(content_type, content_id);

-- 3. IVFFlat index for fast cosine similarity search
-- Note: IVFFlat requires at least 100 rows for optimal performance
-- For smaller datasets, HNSW is a better choice
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_ivfflat
  ON embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata ON embeddings USING gin(metadata);

-- 5. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_embeddings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_embeddings_updated_at ON embeddings;
CREATE TRIGGER trigger_update_embeddings_updated_at
BEFORE UPDATE ON embeddings
FOR EACH ROW EXECUTE FUNCTION update_embeddings_updated_at();

-- 6. Add comment for documentation
COMMENT ON TABLE embeddings IS 'General-purpose vector embeddings for semantic search across questions, study materials, and other content types';
COMMENT ON COLUMN embeddings.content_type IS 'Type of content: question, study_material, chapter, video, pdf, etc.';
COMMENT ON COLUMN embeddings.content_id IS 'Foreign key to the content table';
COMMENT ON COLUMN embeddings.embedding IS 'Vector embedding (1536 dimensions for OpenAI ada-002/text-embedding-3-small)';
COMMENT ON COLUMN embeddings.metadata IS 'Additional metadata as JSONB (title, tags, difficulty, etc.)';
