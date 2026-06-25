import pool from '../database/db.js'

export const UserRepository = {
  async findAll() {
    const { rows } = await pool.query('SELECT id, name, email, role, is_pro, pro_expiry, created_at FROM users')
    return rows
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_pro, pro_expiry, created_at FROM users WHERE id = $1',
      [id]
    )
    return rows[0]
  },

  // FIX CRIT-07: Exclude password_hash from standard queries
  async findByEmail(email, includePassword = false) {
    const cols = includePassword
      ? 'id, name, email, password_hash, role, is_pro, pro_expiry, created_at'
      : 'id, name, email, role, is_pro, pro_expiry, created_at'
    const { rows } = await pool.query(
      `SELECT ${cols} FROM users WHERE email = $1`,
      [email]
    )
    return rows[0]
  },

  async create(data) {
    const { name, email, password_hash, role = 'user', is_pro = false, pro_expiry } = data
    
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_pro, pro_expiry)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, is_pro, pro_expiry, created_at`,
      [name, email, password_hash, role, is_pro, pro_expiry]
    )
    
    return rows[0]
  },

  async updateProStatus(userId, isPro, proExpiry) {
    const { rows } = await pool.query(
      `UPDATE users 
       SET is_pro = $1, pro_expiry = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, role, is_pro, pro_expiry`,
      [isPro, proExpiry, userId]
    )
    return rows[0]
  }
}