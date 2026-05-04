import bcrypt from 'bcryptjs'
import { pool } from './apps/backend/src/infrastructure/database/postgres-helpers.js'
import { randomBytes } from 'crypto'

/**
 * Generate a strong random password satisfying:
 * - At least 8 characters (we generate longer)
 * - Includes uppercase, lowercase, numbers, and special characters
 */
function generateStrongPassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  // Ensure at least one of each required type
  let password = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)]
  ]
  
  // Fill the rest with random characters from all sets
  const allChars = uppercase + lowercase + numbers + special
  for (let i = password.length; i < length; i++) {
    password.push(allChars[Math.floor(Math.random() * allChars.length)])
  }
  
  // Shuffle the array
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]]
  }
  
  return password.join('')
}

async function seedAdmin() {
  const email = 'admin@trstprep.com'
  
  // Use env var if provided, otherwise generate random strong password
  const password = process.env.ADMIN_DEFAULT_PASSWORD || generateStrongPassword()
  
  const name = 'Admin'

  try {
    // Check if admin exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existing.rows.length > 0) {
      console.log('Admin user already exists')
      // If env var provided and different, update password?
      // For security, we skip updating existing admin password automatically
      return
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create admin user
    const result = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, 'admin', true, NOW(), NOW())
      RETURNING id, email, role
    `, [name, email, hashedPassword])

    console.log('✅ Admin created:', result.rows[0])
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      console.log('🔐 Generated admin password:', password)
      console.log('⚠️  IMPORTANT: Save this password! It will not be shown again.')
    } else {
      console.log('🔐 Using password from ADMIN_DEFAULT_PASSWORD environment variable')
    }
  } catch (error) {
    console.error('Seed error:', error.message)
  } finally {
    await pool.end()
  }
}

seedAdmin()