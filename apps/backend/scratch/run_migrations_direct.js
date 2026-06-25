import 'dotenv/config';
import { pool } from '../src/infrastructure/database/postgres-helpers.js';
import { runMigrations } from '../src/infrastructure/database/migrationRunner.js';

async function main() {
  try {
    console.log('Starting migration execution...');
    await runMigrations(pool);
    console.log('Migrations executed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

main();
