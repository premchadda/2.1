import { pool } from '../infrastructure/database/postgres-helpers.js'

/**
 * CRIT-08 FIX: DB-backed CSRF token store
 * Replaces in-memory Map with persistent file-based storage via JSON file
 */

const TOKEN_FILE = './csrf-tokens-store.json'

// Simple file-based persistent store as fallback when DB isn't available
import fs from 'fs'

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
    console.warn('⚠️  Using file-based CSRF token store (table creation failed)')
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
    // Fallback to file storage
    const tokens = loadTokens()
    tokens[token] = { userId, expiresAt: expiresAt.toISOString() }
    saveTokens(tokens)
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
    // Fallback to file storage
    const tokens = loadTokens()
    if (tokens[token] && new Date(tokens[token].expiresAt) > new Date()) {
      delete tokens[token]
      saveTokens(tokens)
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
    // Fallback to file storage
    const tokens = loadTokens()
    const now = new Date()
    let cleaned = 0
    for (const [key, value] of Object.entries(tokens)) {
      if (new Date(value.expiresAt) < now) {
        delete tokens[key]
        cleaned++
      }
    }
    saveTokens(tokens)
    return cleaned
  }
}

// File-based fallback helpers
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
    }
    return {}
  } catch {
    return {}
  }
}

function saveTokens(tokens) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens))
  } catch (e) {
    console.error('Failed to save CSRF tokens:', e.message)
  }
}

export default { initCsrfTable, createCsrfToken, verifyCsrfToken, cleanupExpiredCsrfTokens }