import bcrypt from 'bcryptjs'
import { pool } from './apps/backend/src/infrastructure/database/postgres-helpers.js'
import { randomBytes } from 'crypto'

function generateStrongPassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  let password = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)]
  ]
  
  const allChars = uppercase + lowercase + numbers + special
  for (let i = password.length; i < length; i++) {
    password.push(allChars[Math.floor(Math.random() * allChars.length)])
  }
  
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]]
  }
  
  return password.join('')
}

async function resetAdminPassword() {
  const email = 'admin@trstprep.com'
  const newPassword = process.env.ADMIN_DEFAULT_PASSWORD || generateStrongPassword()

  try {
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [hashedPassword, email]
    )

    console.log('✅ Password reset for:', email)
    
    // Verify
    const result = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email])
    const isValid = await bcrypt.compare(newPassword, result.rows[0].password_hash)
    console.log('Verification:', isValid ? 'PASS' : 'FAIL')
    
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      console.log('🔐 New admin password:', newPassword)
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await pool.end()
  }
}

resetAdminPassword()
