/**
 * Standalone Migration Runner (one-off)
 * ----------------------------------------------------------------
 * Runs the SQL migrations against $DATABASE_URL using the
 * canonical migrationRunner. Use only when you need to apply
 * migrations outside the normal backend startup (e.g. an
 * infrastructure job, a one-off dev environment, or a manual
 * production verification before redeploy).
 *
 * Usage:   node scripts/run-migration.js
 * Env:     DATABASE_URL (required)
 *
 * For day-to-day use, the migrationRunner runs automatically
 * during backend startup (apps/backend/src/app-port5001.js) and
 * should not be invoked manually.
 */
import 'dotenv/config';
import pg from 'pg';
import { runMigrations } from '../src/infrastructure/database/migrationRunner.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('\u274c  DATABASE_URL is not set. Aborting.\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    console.log('\u{1F680}  Running migrations against', process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':***@'));
    await runMigrations(pool);
    console.log('\u2705  Migrations complete.');
  } catch (err) {
    console.error('\u274c  Migration run failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
