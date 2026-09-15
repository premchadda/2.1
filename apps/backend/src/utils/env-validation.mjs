import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// HIGH-10 FIX: Startup env validation script
// Checks all required env vars from turbo.json globalEnv

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET']
const RECOMMENDED_VARS = ['NODE_ENV', 'PORT', 'FRONTEND_URL', 'ADMIN_PANEL_URL']
const OPTIONAL_VARS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'REDIS_URL']

// Load .env file if present
try {
  const envPath = join(__dirname, '../../.env')
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex !== -1) {
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      if (!(key in process.env)) process.env[key] = value
    }
  }
} catch {
  // No .env file; vars come from environment
}

// Provide safe defaults for standard deployment URLs if not explicitly specified
if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = 'https://trstprep.vercel.app'
}
if (!process.env.ADMIN_PANEL_URL) {
  process.env.ADMIN_PANEL_URL = 'https://trstprep-admin.vercel.app'
}

// Synchronize DB_ENCRYPTION_KEY and legacy PGCRYPTO_KEY alias
const encKey = process.env.DB_ENCRYPTION_KEY || process.env.PGCRYPTO_KEY
if (encKey) {
  process.env.DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || encKey
  process.env.PGCRYPTO_KEY = process.env.PGCRYPTO_KEY || encKey
}

const errors = []
const warnings = []

// Check required vars
for (const v of REQUIRED_VARS) {
  if (!process.env[v]) errors.push(`Missing REQUIRED env var: ${v}`)
}
// JWT_SECRET additional length check
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  errors.push('JWT_SECRET must be at least 32 characters long')
}
// DB_ENCRYPTION_KEY / PGCRYPTO_KEY validation
if (!encKey) {
  if (process.env.NODE_ENV === 'production') {
    errors.push(
      'Missing REQUIRED env var: DB_ENCRYPTION_KEY (or PGCRYPTO_KEY). Set a 32+ character random secret in your deployment dashboard (e.g. node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")'
    )
  } else {
    warnings.push(
      'DB_ENCRYPTION_KEY is not set — falling back to development defaults. Set a 32+ character key for production.'
    )
  }
} else if (encKey.length < 32) {
  errors.push('DB_ENCRYPTION_KEY must be at least 32 characters long')
} else if (process.env.JWT_SECRET && encKey === process.env.JWT_SECRET) {
  errors.push('DB_ENCRYPTION_KEY must not equal JWT_SECRET (cryptographic separation required)')
}
// NODE_ENV format check
if (process.env.NODE_ENV && !['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
  errors.push(`NODE_ENV must be development/production/test (got: ${process.env.NODE_ENV})`)
}
// PORT format check
if (process.env.PORT) {
  const p = parseInt(process.env.PORT, 10)
  if (isNaN(p) || p < 1 || p > 65535) {
    errors.push(`PORT must be a valid port number (got: ${process.env.PORT})`)
  }
}
// DATABASE_URL format check
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgres://') && !process.env.DATABASE_URL.startsWith('postgresql://')) {
  errors.push('DATABASE_URL must start with postgres:// or postgresql://')
}

// Check recommended vars
for (const v of RECOMMENDED_VARS) {
  if (!process.env[v]) warnings.push(`Missing recommended env var: ${v}`)
}

// Check optional vars
for (const v of OPTIONAL_VARS) {
  if (!process.env[v]) warnings.push(`Missing optional env var: ${v}`)
}

// Output warnings
if (warnings.length > 0) {
  console.warn('\n⚠️  Environment Warnings:')
  for (const w of warnings) console.warn(`   - ${w}`)
}

// Throw errors
if (errors.length > 0) {
  console.error('\n❌ Environment Errors:')
  for (const e of errors) console.error(`   - ${e}`)
  process.exit(1)
}

console.log('✅ Environment validation passed')
export default true