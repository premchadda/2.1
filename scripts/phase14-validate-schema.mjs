import fs from 'fs';
import path from 'path';
import { validateJsonSchema } from '../apps/backend/src/services/import/fullTestImporter.js';

const dir = 'Phase 14/uploadable-json';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const res = validateJsonSchema(arr);
  console.log('== ' + f);
  console.log(' missing test fields: ' + JSON.stringify(res.missingFields.test));
  console.log(' missing section fields: ' + JSON.stringify(res.missingFields.section));
  console.log(' missing question fields: ' + JSON.stringify(res.missingFields.question));
  console.log(' extra test (first 5): ' + JSON.stringify((res.extraFields.test||[]).slice(0,5)));
  console.log(' extra section (first 5): ' + JSON.stringify((res.extraFields.section||[]).slice(0,5)));
  console.log(' extra question (first 5): ' + JSON.stringify((res.extraFields.question||[]).slice(0,5)));
}
