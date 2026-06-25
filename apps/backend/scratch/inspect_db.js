import { pool } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    const statusRes = await pool.query(`
      SELECT status, COUNT(*) 
      FROM attempts 
      GROUP BY status;
    `);
    console.log('Distinct statuses in attempts:', statusRes.rows);
  } catch (error) {
    console.error('Error inspecting database:', error);
  } finally {
    await pool.end();
  }
}

main();
