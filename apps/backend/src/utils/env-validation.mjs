import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// HIGH-10 FIX: Startup env validation script
// Checks all required env vars from turbo.json globalEnv

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL']
const RECOMMENDED_VARS = ['NODE_ENV', 'PORT', 'ADMIN_PANEL_URL', 'VITE_API_URL', 'VITE_SOCKET_URL']
const OPTIONAL_VARS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'VITE_FRONTEND_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']

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