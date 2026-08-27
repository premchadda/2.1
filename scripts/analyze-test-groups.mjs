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
  try {
    const dbHelperPath = pathToFileURL(path.join(rootDir, 'apps', 'backend', 'src', 'infrastructure', 'database', 'postgres-helpers.js')).href;
    const { pool } = await import(dbHelperPath);
    const result = await pool.query(`
      SELECT 
        t.id, 
        t.title, 
        t.category,
        t.sub_category,
        ts.title AS series_title,
        t.total_questions,
        t.duration
      FROM tests t
      LEFT JOIN test_series ts ON t.series_id = ts.id
      WHERE t.is_active = true
      ORDER BY t.id ASC
    `);

    // Natural sort helper
    const naturalSort = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    const tests = result.rows.sort(naturalSort);

    // Group tests by pattern / prefix
    const groups = {};
    for (const t of tests) {
      // Extract prefix like "CGL Tier I - English - Sectional Test", "SSC CGL 2026 - Tier 1 - Full Mock Test", etc.
      let groupName = t.title.replace(/\s+\d+(\b|$)/g, '').replace(/\s*-\s*Shift\s*\d+/i, ' - Shift X').trim();
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(t);
    }

    console.log(`\n=== TEST NAME GROUPS & NUMERICAL ORDER (${tests.length} Total Active Tests) ===\n`);
    for (const [groupName, groupTests] of Object.entries(groups)) {
      console.log(`\n📂 Group: "${groupName}" (${groupTests.length} tests)`);
      groupTests.forEach((t, idx) => {
        console.log(`   ${idx + 1}. [ID: ${t.id}] "${t.title}" (${t.total_questions} Qs, ${t.duration}m)`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
