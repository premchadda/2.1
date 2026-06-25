import { pool } from '../src/infrastructure/database/postgres-helpers.js';

async function main() {
  try {
    console.log('Altering app_settings table...');
    await pool.query(`
      ALTER TABLE app_settings 
      ADD COLUMN IF NOT EXISTS coming_soon_config JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('Column coming_soon_config added successfully.');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await pool.end();
  }
}
main();
