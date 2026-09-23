import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';

async function check() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'questions' 
    ORDER BY ordinal_position
  `);

  console.table(cols.rows);

  const fks = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'questions'::regclass AND c.contype = 'f';
  `);

  console.log('Foreign keys:');
  console.table(fks.rows);

  await pool.end();
}

check();
