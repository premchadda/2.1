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
    const colsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tests'
      ORDER BY ordinal_position ASC
    `);
    console.log('=== Columns in tests table ===');
    console.table(colsRes.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
