import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, 'apps', 'backend', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

(async () => {
  const dbHelperPath = pathToFileURL(path.join(rootDir, 'apps', 'backend', 'src', 'infrastructure', 'database', 'postgres-helpers.js')).href;
  const { pool } = await import(dbHelperPath);

  console.log('===============================================================');
  console.log('--- 1. SSC CGL TIER I 2026 FULL MOCK TESTS (CONSECUTIVE IDs) ---');
  console.log('===============================================================');
  const mockRes = await pool.query(`
    SELECT id, title, total_questions, duration, series_id
    FROM tests
    WHERE title LIKE 'SSC CGL Tier I 2026 - %Mock Test%'
    ORDER BY id ASC;
  `);
  mockRes.rows.forEach(r => console.log(`  [ID: ${r.id}] "${r.title}" (${r.total_questions} Qs)`));

  console.log('\n===============================================================');
  console.log('--- 2. SSC CGL TIER I 2025 FULL TESTS (CONSECUTIVE IDs) ---');
  console.log('===============================================================');
  const full2025Res = await pool.query(`
    SELECT id, title, total_questions, duration
    FROM tests
    WHERE title LIKE 'SSC CGL Tier I 2025 - Full Test%'
    ORDER BY id ASC;
  `);
  full2025Res.rows.forEach(r => console.log(`  [ID: ${r.id}] "${r.title}"`));

  console.log('\n===============================================================');
  console.log('--- 3. RRB NTPC CBT1 (GRADUATE) FULL TESTS (CONSECUTIVE IDs) ---');
  console.log('===============================================================');
  const rrbGradRes = await pool.query(`
    SELECT id, title, total_questions, duration
    FROM tests
    WHERE title LIKE 'RRB NTPC CBT1 (Graduate) - Full Test%'
    ORDER BY id ASC;
  `);
  rrbGradRes.rows.forEach(r => console.log(`  [ID: ${r.id}] "${r.title}"`));

  console.log('\n===============================================================');
  console.log('--- 4. RRB NTPC CBT1 (UNDERGRADUATE) FULL TESTS (CONSECUTIVE IDs) ---');
  console.log('===============================================================');
  const rrbUgRes = await pool.query(`
    SELECT id, title, total_questions, duration
    FROM tests
    WHERE title LIKE 'RRB NTPC CBT1 (Undergraduate) - Full Test%'
    ORDER BY id ASC;
  `);
  rrbUgRes.rows.forEach(r => console.log(`  [ID: ${r.id}] "${r.title}"`));

  console.log('\n===============================================================');
  console.log('--- 5. SAMPLE PREVIOUS YEAR PAPERS (PYPs) (CONSECUTIVE IDs) ---');
  console.log('===============================================================');
  const pypSampleRes = await pool.query(`
    SELECT id, title, category, sub_category
    FROM tests
    WHERE title LIKE 'SSC CGL 2024 Tier 1 - %Sep 2024 - Shift%'
    ORDER BY id ASC
    LIMIT 10;
  `);
  pypSampleRes.rows.forEach(r => console.log(`  [ID: ${r.id}] "${r.title}"`));

  console.log('\n===============================================================');
  console.log('--- 6. INTEGRITY AUDIT: QUESTION AND SECTION COUNTS ---');
  console.log('===============================================================');
  const counts = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM tests) as total_tests,
      (SELECT MIN(id) FROM tests) as min_id,
      (SELECT MAX(id) FROM tests) as max_id,
      (SELECT COUNT(*) FROM questions WHERE test_id IS NOT NULL) as linked_questions,
      (SELECT COUNT(*) FROM test_questions) as linked_test_questions,
      (SELECT COUNT(*) FROM test_sections WHERE test_id IS NOT NULL) as linked_sections,
      (SELECT COUNT(*) FROM attempts WHERE test_id IS NOT NULL) as linked_attempts;
  `);
  console.log(counts.rows[0]);

  process.exit(0);
})();
