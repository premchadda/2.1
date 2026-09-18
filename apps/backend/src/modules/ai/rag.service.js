import { pool } from '../../infrastructure/database/postgres-helpers.js'
import logger from '../../infrastructure/logger/logger.js'

/**
 * GIN tsvector full-text-search RAG Service
 */
export const ragService = {
  /**
   * Split text into overlapping chunks (capped so a giant extraction can't
   * blow up rows/memory in a single ingest transaction).
   */
  chunkText(text, chunkSize = 1000, chunkOverlap = 200, maxChunks = 200) {
    const chunks = []
    if (!text || typeof text !== 'string') return chunks
    let startIndex = 0
    while (startIndex < text.length && chunks.length < maxChunks) {
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
    const safeName = String(documentName || '').substring(0, 255)
    if (!safeName) return { success: false, message: 'Document name is required' }
    const chunks = this.chunkText(text)
    if (chunks.length === 0) return { success: false, message: 'No content to index' }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Delete existing chunks for same document to prevent duplicates
      await client.query('DELETE FROM document_chunks WHERE document_name = $1', [safeName])

      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          `INSERT INTO document_chunks (document_name, chunk_index, content)
           VALUES ($1, $2, $3)`,
          [safeName, i, chunks[i]]
        )
      }

      await client.query('COMMIT')
      logger.info({ document: safeName, chunks: chunks.length }, '[RAG] Document indexed')
      return { success: true, chunksCount: chunks.length }
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ err: error }, '[RAG] Indexing failed')
      throw error
    } finally {
      client.release()
    }
  },

  /**
   * Retrieve relevant document chunks using PostgreSQL Full Text Search.
   * Multi-pass: 'english' stemming first, then 'simple' (no stemming —
   * Hindi/Hinglish recall), then 'hindi' when the dictionary is installed.
   * Each pass is guarded: a missing dictionary (42883/22023) falls through
   * to the next instead of 500ing, and without the fallbacks the LLM would
   * silently answer with no course context.
   */
  async retrieveContext(query, limit = 3) {
    if (!query || typeof query !== 'string') return ''

    const runPass = async (client, dict) => client.query(
      `SELECT content, ts_rank_cd(tsv_content, plainto_tsquery($1, $2)) AS rank
       FROM document_chunks
       WHERE tsv_content @@ plainto_tsquery($1, $2)
       ORDER BY rank DESC
       LIMIT $3`,
      [dict, query, limit]
    )

    const client = await pool.connect()
    try {
      // Find matching chunks using standard plainto_tsquery and ts_rank
      let result = null
      for (const dict of ['english', 'simple', 'hindi']) {
        try {
          result = await runPass(client, dict)
        } catch (dictErr) {
          // Missing text-search dictionary (or bad config) — try the next.
          const code = String(dictErr?.code || '')
          if (code === '42883' || code === '22023' || /dictionary|configuration/i.test(dictErr?.message || '')) {
            result = null
            continue
          }
          throw dictErr
        }
        if (result && result.rows.length > 0) break
      }

      if (!result || result.rows.length === 0) {
        return ''
      }

      return result.rows
        .map((row, index) => `[Context Chunk ${index + 1}]:\n${row.content}`)
        .join('\n\n')
    } catch (error) {
      logger.error({ err: error }, '[RAG] Context retrieval failed')
      try {
        const { default: AiGenerationLog } = await import('../../data/models/ai/AiGenerationLog.js')
        await AiGenerationLog.logFailure({
          entityType: 'rag_retrieve',
          prompt: String(query).substring(0, 500),
          error: error.message,
          metadata: { limit },
        }).catch(() => {})
      } catch {
        /* failure logging is best-effort */
      }
      return ''
    } finally {
      client.release()
    }
  }
}
