import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read env file manually
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
        t.slug,
        t.type, 
        t.category,
        t.sub_category,
        ts.id AS series_id,
        ts.title AS series_title,
        t.total_questions,
        t.duration,
        t.is_active,
        t.status
      FROM tests t
      LEFT JOIN test_series ts ON t.series_id = ts.id
      ORDER BY t.id ASC
    `);

    // Natural sort helper function for titles e.g. "Mock Test 1", "Mock Test 2", "Mock Test 10"
    const naturalSort = (a, b) => {
      const titleA = a.title || '';
      const titleB = b.title || '';
      return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
    };

    const sortedTests = [...result.rows].sort(naturalSort);

    // Group by series
    const bySeries = {};
    for (const t of sortedTests) {
      const sKey = t.series_title || 'No Series / Standalone';
      if (!bySeries[sKey]) bySeries[sKey] = [];
      bySeries[sKey].push(t);
    }

    const summary = {
      totalTests: result.rows.length,
      seriesCount: Object.keys(bySeries).length,
      series: {}
    };

    for (const [seriesName, tests] of Object.entries(bySeries)) {
      summary.series[seriesName] = {
        testCount: tests.length,
        tests: tests.map((t, idx) => ({
          order: idx + 1,
          id: t.id,
          title: t.title,
          type: t.type,
          category: t.category,
          subCategory: t.sub_category,
          questions: t.total_questions,
          duration: t.duration,
          status: t.status
        }))
      };
    }

    fs.writeFileSync(path.join(rootDir, 'scripts', 'tests_by_name_order.json'), JSON.stringify(summary, null, 2));
    console.log('Saved to scripts/tests_by_name_order.json');
    console.log(`Total tests: ${result.rows.length} across ${Object.keys(bySeries).length} series categories.`);
    
    // Print each series with its test names and count
    for (const [seriesName, data] of Object.entries(summary.series)) {
      console.log(`\n=== [Series ID/Name] ${seriesName} (${data.testCount} tests) ===`);
      data.tests.slice(0, 10).forEach(t => {
        console.log(`  ${t.order}. [ID: ${t.id}] ${t.title}`);
      });
      if (data.testCount > 10) {
        console.log(`  ... and ${data.testCount - 10} more (e.g. ${data.tests[data.testCount - 1].order}. [ID: ${data.tests[data.testCount - 1].id}] ${data.tests[data.testCount - 1].title})`);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
})();
