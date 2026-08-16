import { pool } from '../../infrastructure/database/postgres-helpers.js'

/**
 * GIN tsvector full-text-search RAG Service
 */
export const ragService = {
  /**
   * Split text into overlapping chunks
   */
  chunkText(text, chunkSize = 1000, chunkOverlap = 200) {
    const chunks = []
    if (!text || typeof text !== 'string') return chunks
    let startIndex = 0
    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length)
      chunks.push(text.substring(startIndex, endIndex))
      if (endIndex === text.length) break
      startIndex += chunkSize - chunkOverlap
    }
    return chunks
  },

  /**
   * Add a document to the RAG system
   */
  async addDocument(documentName, text) {
    const chunks = this.chunkText(text)
    if (chunks.length === 0) return { success: false, message: 'No content to index' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Delete existing chunks for same document to prevent duplicates
      await client.query('DELETE FROM document_chunks WHERE document_name = $1', [documentName])

      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          `INSERT INTO document_chunks (document_name, chunk_index, content)
           VALUES ($1, $2, $3)`,
          [documentName, i, chunks[i]]
        )
      }

      await client.query('COMMIT')
      console.log(`[RAG] Indexed document "${documentName}" with ${chunks.length} chunks`)
      return { success: true, chunksCount: chunks.length }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('[RAG] Indexing failed:', error)
      throw error
    } finally {
      client.release()
    }
  },

  /**
   * Retrieve relevant document chunks using PostgreSQL Full Text Search (tsv_content)
   */
  async retrieveContext(query, limit = 3) {
    if (!query || typeof query !== 'string') return ''

    const client = await pool.connect()
    try {
      // Find matching chunks using standard plainto_tsquery and ts_rank
      const result = await client.query(
        `SELECT content, ts_rank_cd(tsv_content, plainto_tsquery('english', $1)) AS rank
         FROM document_chunks
         WHERE tsv_content @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $2`,
        [query, limit]
      )

      if (result.rows.length === 0) {
        return ''
      }

      return result.rows
        .map((row, index) => `[Context Chunk ${index + 1}]:\n${row.content}`)
        .join('\n\n')
    } catch (error) {
      console.error('[RAG] Context retrieval failed:', error)
      return ''
    } finally {
      client.release()
    }
  }
}
