import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const res = await pool.query(`SELECT id, name, slug FROM subjects ORDER BY id;`);
  console.table(res.rows);
  await pool.end();
}
main().catch(console.error);
