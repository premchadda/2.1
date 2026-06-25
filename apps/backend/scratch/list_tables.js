import 'dotenv/config';
import { pool } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    const tablesRes = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log('--- ALL TABLES ---');
    for (const row of tablesRes.rows) {
      console.log(row.tablename);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
