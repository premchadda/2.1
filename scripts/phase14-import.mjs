// Deterministic Phase-14 import: sequential, single-process, per-test transactions.
// Usage: node scripts/phase14-import.mjs <file> <start> <end>
// Imports tests[start..end) from the JSON array. Prints per-test results + summary.
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve('apps/backend/.env') });
}

const { importFullTest } = await import('../apps/backend/src/services/import/fullTestImporter.js');

const [file, startArg, endArg] = process.argv.slice(2);
const tests = JSON.parse(fs.readFileSync(file, 'utf8'));
const start = parseInt(startArg ?? '0', 10);
const end = parseInt(endArg ?? String(tests.length), 10);
console.log(`Importing ${file} indices ${start}..${end - 1} (${end - start} tests)`);

let ok = 0;
const failed = [];
const t0 = Date.now();
for (let i = start; i < end; i++) {
  const t = tests[i];
  const s = Date.now();
  try {
    const r = await importFullTest(t, { userId: 1, fileName: `phase14-${i}.json`, skipDuplicates: true, dryRun: false, strict: false, storageMode: 'database' });
    ok++;
    console.log(`ok [${i}] id=${r.testId} sec=${r.sectionsCreated} q=${r.questionsCreated} skip=${r.questionsSkipped} warn=${r.warnings.length} err=${r.errors.length} (${((Date.now() - s) / 1000).toFixed(1)}s)`);
    if (r.errors.length) console.log('   first errors: ' + JSON.stringify(r.errors.slice(0, 2)));
  } catch (e) {
    failed.push(i);
    console.log(`FAIL [${i}] "${t.title}" :: ${e.message}`);
  }
}
console.log(`CHUNK DONE ok=${ok} failed=${failed.length} [${failed.join(',')}] total=${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(failed.length ? 1 : 0);
