import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const reportPath = path.join(rootDir, 'scripts', 'full_db_missing_data_audit.json');
if (fs.existsSync(reportPath)) {
  const audit = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  const coreTables = [
    'tests', 
    'questions', 
    'test_series', 
    'exams', 
    'exam_categories',
    'test_categories',
    'subjects', 
    'subject_chapters', 
    'subject_topics', 
    'subject_subtopics', 
    'test_sections', 
    'users',
    'attempts'
  ];

  for (const tbl of coreTables) {
    const data = audit.find(a => a.table === tbl);
    if (!data) continue;
    console.log(`\n========================================================`);
    console.log(`TABLE: "${data.table}" (${data.rowCount} rows)`);
    console.log(`========================================================`);
    
    // Group into 100% empty vs partially empty
    const fullEmpty = data.missingFields.filter(f => f.missingPct === 100);
    const partial = data.missingFields.filter(f => f.missingPct > 0 && f.missingPct < 100);

    if (partial.length > 0) {
      console.log('--- Partially Missing Fields (Actionable Data Gaps) ---');
      partial.forEach(p => {
        console.log(`  - ${p.column.padEnd(25)} (${p.type}): ${p.missingCount} missing (${p.missingPct}%)`);
      });
    }

    if (fullEmpty.length > 0) {
      console.log('--- Unused / 100% Empty Columns ---');
      console.log('  ' + fullEmpty.map(f => f.column).join(', '));
    }
  }
}
