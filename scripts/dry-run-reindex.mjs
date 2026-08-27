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
        t.public_id,
        t.title, 
        t.category,
        t.sub_category,
        t.type,
        t.series_id,
        ts.title AS series_title
      FROM tests t
      LEFT JOIN test_series ts ON t.series_id = ts.id
      ORDER BY 
        COALESCE(t.series_id, 999999) ASC,
        t.category ASC NULLS LAST,
        t.sub_category ASC NULLS LAST
    `);

    // Group by series and category, then natural sort titles
    const naturalSort = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    
    // Sort all tests with proper series priority and natural title sort
    const tests = [...result.rows].sort((a, b) => {
      const sA = a.series_id || 999999;
      const sB = b.series_id || 999999;
      if (sA !== sB) return sA - sB;
      
      const catA = a.category || '';
      const catB = b.category || '';
      if (catA !== catB) return catA.localeCompare(catB);

      return naturalSort(a, b);
    });

    console.log(`Total tests to re-index: ${tests.length}`);

    // Proposed IDs starting from 1 to 493
    const mapping = tests.map((t, idx) => ({
      oldId: t.id,
      newId: idx + 1,
      title: t.title,
      series: t.series_title || 'No Series',
      category: t.category
    }));

    fs.writeFileSync(path.join(rootDir, 'scripts', 'proposed_id_mapping.json'), JSON.stringify(mapping, null, 2));

    console.log('\n--- SAMPLE PROPOSED RE-INDEXING (SSC CGL Full Mock Tests) ---');
    const sscMocks = mapping.filter(m => m.title.includes('SSC CGL Tier I 2026 - Full Mock Test') || m.title.includes('SSC CGL Tier I 2026 - Free Mock Test'));
    sscMocks.forEach(m => {
      console.log(`  ${m.title} -> Old ID: ${m.oldId}  ===>  New ID: ${m.newId}`);
    });

    console.log('\n--- SAMPLE PROPOSED RE-INDEXING (SSC CGL 2025 Full Tests) ---');
    const ssc2025 = mapping.filter(m => m.title.includes('SSC CGL Tier I 2025 - Full Test') || m.title.includes('SSC CGL Tier I 2025 - Free Test'));
    ssc2025.forEach(m => {
      console.log(`  ${m.title} -> Old ID: ${m.oldId}  ===>  New ID: ${m.newId}`);
    });

    console.log('\n--- SAMPLE PROPOSED RE-INDEXING (RRB NTPC Graduate Full Tests) ---');
    const rrbGrad = mapping.filter(m => m.title.includes('RRB NTPC CBT1 (Graduate) - Full Test'));
    rrbGrad.forEach(m => {
      console.log(`  ${m.title} -> Old ID: ${m.oldId}  ===>  New ID: ${m.newId}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
