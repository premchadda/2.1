import { pool } from './src/infrastructure/database/postgres-helpers.js';
const c = await pool.connect();
try {
  const r = await c.query("SELECT id, title, slug, test_type, status, series_id, stage_id, test_category_id, exam_id, is_active, source_test_id, imported_from FROM tests WHERE is_deleted = false OR is_deleted IS NULL ORDER BY id");
  console.log(`Total tests: ${r.rows.length}\n`);
  r.rows.forEach(t => {
    console.log(`#${t.id} | ${t.title?.substring(0,50)} | type=${t.test_type} | status=${t.status} | series=${t.series_id} | stage=${t.stage_id} | cat=${t.test_category_id} | exam=${t.exam_id} | active=${t.is_active} | src=${t.source_test_id} | imported=${t.imported_from}`);
  });
} catch(e) { console.error(e.message); } finally { c.release(); process.exit(0); }
