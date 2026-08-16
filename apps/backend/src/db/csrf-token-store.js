import { pool } from '../infrastructure/database/postgres-helpers.js'

/**
 * DB-backed CSRF token store
 * Falls back to in-memory Map (never filesystem) when DB is unavailable
 */

// In-memory fallback — never persists tokens to disk
const memoryStore = new Map()

/**
 * Initialize CSRF token table if not exists
 */
export async function initCsrfTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS csrf_tokens (
        id SERIAL PRIMARY KEY,
        csrf_token TEXT UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(csrf_token)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens(expires_at)')
    console.log('✅ CSRF token table initialized')
  } catch (e) {
    console.warn('⚠️  Using in-memory CSRF token store (table creation failed)')
  }
}

/**
 * Create a CSRF token
 */
export async function createCsrfToken(userId, token, expiresAt) {
  try {
    await pool.query(
      'INSERT INTO csrf_tokens (csrf_token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, userId, expiresAt]
    )
  } catch (e) {
    // Fallback to in-memory storage
    memoryStore.set(token, { userId, expiresAt: expiresAt.toISOString() })
  }
}

/**
 * Verify a CSRF token (returns true if valid, deletes token if one-time-use)
 */
export async function verifyCsrfToken(token) {
  try {
    const result = await pool.query(
      'SELECT id, expires_at FROM csrf_tokens WHERE csrf_token = $1 AND expires_at > NOW()',
      [token]
    )
    if (result.rows.length > 0) {
      await pool.query('DELETE FROM csrf_tokens WHERE id = $1', [result.rows[0].id])
      return true
    }
    return false
  } catch {
    // Fallback to in-memory storage
    const entry = memoryStore.get(token)
    if (entry && new Date(entry.expiresAt) > new Date()) {
      memoryStore.delete(token)
      return true
    }
    return false
  }
}

/**
 * Cleanup expired CSRF tokens older than 1 hour
 */
export async function cleanupExpiredCsrfTokens() {
  try {
    const result = await pool.query(
      "DELETE FROM csrf_tokens WHERE expires_at < NOW() - INTERVAL '1 hour'"
    )
    console.log(`🧹 Cleaned up ${result.rowCount} expired CSRF tokens`)
    return result.rowCount
  } catch {
    // Fallback to in-memory storage
    const now = new Date()
    let cleaned = 0
    for (const [key, value] of memoryStore.entries()) {
      if (new Date(value.expiresAt) < now) {
        memoryStore.delete(key)
        cleaned++
      }
    }
    return cleaned
  }
}

// Periodic cleanup: purge expired tokens from the in-memory fallback every 5 min
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
setInterval(() => {
  const now = new Date()
  let cleaned = 0
  for (const [key, value] of memoryStore.entries()) {
    if (new Date(value.expiresAt) < now) {
      memoryStore.delete(key)
      cleaned++
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 In-memory CSRF cleanup: removed ${cleaned} expired token(s)`)
  }
}, CLEANUP_INTERVAL_MS).unref()

export default { initCsrfTable, createCsrfToken, verifyCsrfToken, cleanupExpiredCsrfTokens }