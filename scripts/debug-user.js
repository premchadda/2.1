import bcrypt from 'bcryptjs'
import { pool } from './apps/backend/src/infrastructure/database/postgres-helpers.js'

async function checkUser() {
  const email = 'admin@trstprep.com'

  try {
    const result = await pool.query(
      'SELECT id, email, role, password_hash, is_active FROM users WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      console.log('No user found')
      return
    }

    const user = result.rows[0]
    console.log('User found:', { id: user.id, email: user.email, role: user.role, isActive: user.is_active })
    // M43: never log password_hash — use it only for verification below

    // Test password - use env var if set, otherwise the default seed-generated one will vary
    const testPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'NOTE: If not set, admin password was randomly generated during seed. Check seed logs.'
    if (testPassword.startsWith('NOTE:')) {
      console.log(testPassword)
    } else {
      const isValid = await bcrypt.compare(testPassword, user.password_hash)
      console.log('Password test:', isValid ? 'PASS' : 'FAIL')
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await pool.end()
  }
}

checkUser()
