import { pool } from './src/infrastructure/database/postgres-helpers.js';
const c = await pool.connect();
try {
  // Check what 057 columns exist
  const checks = [
    { table: 'tests', col: 'is_live' },
    { table: 'tests', col: 'is_coming_soon' },
    { table: 'tests', col: 'is_featured' },
    { table: 'tests', col: 'passing_marks' },
    { table: 'tests', col: 'seo' },
    { table: 'tests', col: 'cutoff_marks' },
    { table: 'tests', col: 'proctoring' },
    { table: 'tests', col: 'adaptive' },
    { table: 'tests', col: 'features' },
    { table: 'tests', col: 'exam_category_id' },
    { table: 'questions', col: 'ai_generated' },
    { table: 'test_sections', col: 'section_code' },
  ];
  
  for (const { table, col } of checks) {
    const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, col]);
    console.log(`${table}.${col}: ${r.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
  }
  
  // Check constraint
  const con = await c.query("SELECT conname FROM pg_constraint WHERE conname = 'fk_tests_exam_category_id'");
  console.log(`fk_tests_exam_category_id: ${con.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);

  // Check schema_migrations
  const mig = await c.query("SELECT migration_name FROM schema_migrations WHERE migration_name LIKE '05%'");
  console.log('Applied 05x:', mig.rows.map(r => r.migration_name));
} catch(e) { console.error('ERROR:', e.message); } finally { c.release(); process.exit(0); }
