const { Pool } = require('pg');
require('dotenv').config({ path: 'apps/backend/.env' });

const dbUrl = process.env.DATABASE_URL;
const isSupabase = dbUrl.includes('supabase') || dbUrl.includes('.co') || dbUrl.includes('sslmode=require');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isSupabase ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('Adding attempt_number column to test_attempts table if not exists...');
    await pool.query(`
      ALTER TABLE test_attempts 
      ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
    `);
    console.log('Successfully added attempt_number column to test_attempts table.');

    // Populate attempt_number for existing rows using ROW_NUMBER() per user & test
    await pool.query(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, test_id ORDER BY id ASC) as calculated_attempt_no
        FROM test_attempts
      )
      UPDATE test_attempts
      SET attempt_number = numbered.calculated_attempt_no
      FROM numbered
      WHERE test_attempts.id = numbered.id AND (test_attempts.attempt_number IS NULL OR test_attempts.attempt_number = 1);
    `);
    console.log('Successfully backfilled attempt_number for historical test attempts.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
