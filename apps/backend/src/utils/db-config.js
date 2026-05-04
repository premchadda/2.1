import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// Shared database configuration for scripts
const createDbPool = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'false'
      ? { rejectUnauthorized: false }
      : (isDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true })
  })
}

export default createDbPool