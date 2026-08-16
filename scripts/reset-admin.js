import bcrypt from 'bcrypt'
import { pool } from '../apps/backend/src/infrastructure/database/postgres-helpers.js'
import { randomInt } from 'crypto'

function generateStrongPassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  let password = [
    uppercase[randomInt(uppercase.length)],
    lowercase[randomInt(lowercase.length)],
    numbers[randomInt(numbers.length)],
    special[randomInt(special.length)]
  ]

  const allChars = uppercase + lowercase + numbers + special
  for (let i = password.length; i < length; i++) {
    password.push(allChars[randomInt(allChars.length)])
  }

  for (let i = password.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[password[i], password[j]] = [password[j], password[i]]
  }

  return password.join('')
}

async function resetAdminPassword() {
  const email = (process.env.ADMIN_EMAIL || 'admin@trstprep.com').toLowerCase().trim()
  const newPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || generateStrongPassword()
  const role = process.env.ADMIN_ROLE || 'admin'

  try {
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Use a single keyed connection for the whole operation: the users table's
    // PII trigger requires app.pgcrypto_key to be set in the session.
    const cryptoKey = process.env.PGCRYPTO_KEY || 'dev-fallback-trstprep-pgcrypto-key-32bytes'
    const client = await pool.connect()
    try {
      await client.query("SELECT set_config('app.pgcrypto_key', $1, false);", [cryptoKey])

      // Upsert: update if the account exists, otherwise create it.
      // The users table stores the hash in the `password` column (generic reads
      // strip it for security, but login fetches it explicitly).
      const updateRes = await client.query(
        'UPDATE users SET password = $1, role = $2, is_active = true, updated_at = NOW() WHERE email = $3',
        [hashedPassword, role, email]
      )

      if (updateRes.rowCount === 0) {
        await client.query(
          `INSERT INTO users (email, password, name, role, is_active, is_email_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, true, NOW(), NOW())`,
          [email, hashedPassword, 'Admin', role]
        )
        console.log('✅ Created admin account:', email)
      } else {
        console.log('✅ Updated admin account:', email)
      }

      // Verify the hash is valid (same keyed connection)
      const result = await client.query('SELECT password FROM users WHERE email = $1', [email])
      const isValid = await bcrypt.compare(newPassword, result.rows[0].password)
      console.log('Verification:', isValid ? 'PASS' : 'FAIL')

      if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_DEFAULT_PASSWORD) {
        console.log('🔐 New admin password:', newPassword)
      } else {
        console.log('🔐 Admin password set from provided value (not printed).')
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await pool.end()
  }
}

resetAdminPassword()
