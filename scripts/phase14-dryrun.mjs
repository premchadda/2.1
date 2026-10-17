import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve('apps/backend/.env') });
}

const { importFullTest } = await import('../apps/backend/src/services/import/fullTestImporter.js');
const full = JSON.parse(fs.readFileSync('Phase 14/uploadable-json/p14-ALL-full-tests.json', 'utf8'));
const sec = JSON.parse(fs.readFileSync('Phase 14/uploadable-json/p14-ALL-sectional-tests.json', 'utf8'));
for (const t of [full[0], sec[0]]) {
  const r = await importFullTest(t, { userId: 1, fileName: 'dryrun.json', dryRun: true, strict: false, storageMode: 'database' });
  console.log(`DRYRUN "${t.title.slice(0, 60)}..." sections=${r.sectionsCreated} Q=${r.questionsCreated} skipped=${r.questionsSkipped}`);
  console.log('  warnings: ' + JSON.stringify(r.warnings));
  console.log('  errors: ' + JSON.stringify(r.errors.slice(0, 3)));
}
console.log('DRYRUN DONE (rolled back, nothing written)');
process.exit(0);
