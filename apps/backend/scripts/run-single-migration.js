import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION = process.argv[2] || '055_full_test_import_schema.sql';
const migrationsDir = path.join(__dirname, '..', 'src', 'infrastructure', 'database', 'migrations');
const filePath = path.join(migrationsDir, MIGRATION);

if (!fs.existsSync(filePath)) {
  console.error(`❌  Migration file not found: ${filePath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Aborting.\n');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`🚀  Applying migration: ${MIGRATION}`);
  try {
    await pool.query(sql);
    await pool.query(
      'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING;',
      [MIGRATION]
    );
    console.log(`✅  Migration ${MIGRATION} applied successfully.`);
  } catch (err) {
    console.error(`❌  Migration failed:`, err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
