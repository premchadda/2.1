import { pool } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_settings';
    `);
    console.log('Columns in app_settings:');
    res.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
main();
