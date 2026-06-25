import 'dotenv/config';
import { pool } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'exam_seasons'
      ORDER BY ordinal_position;
    `);
    console.log('Table: promotions');
    console.log(res.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
