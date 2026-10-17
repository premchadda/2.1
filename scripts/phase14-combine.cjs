/** Combine per-level Phase-14 files into two upload files. */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'Phase 14', 'uploadable-json');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

const full = [
  ...read('p14-10th-full-tests.json'),
  ...read('p14-12th-full-tests.json'),
  ...read('p14-grad-full-tests.json'),
];
const sectional = [
  ...read('p14-10th-sectional-tests.json'),
  ...read('p14-12th-sectional-tests.json'),
  ...read('p14-grad-sectional-tests.json'),
];

fs.writeFileSync(path.join(DIR, 'p14-ALL-full-tests.json'), JSON.stringify(full, null, 2));
fs.writeFileSync(path.join(DIR, 'p14-ALL-sectional-tests.json'), JSON.stringify(sectional, null, 2));

// integrity
for (const [name, arr, per] of [['full', full, 100], ['sectional', sectional, 25]]) {
  const slugs = arr.map(t => t.slug);
  const qids = arr.flatMap(t => t.sections.flatMap(s => s.questions.map(q => q.id)));
  const badQ = arr.filter(t => t.totalQuestions !== per).length;
  console.log(`${name}: tests=${arr.length} Q=${qids.length} uniqSlugs=${new Set(slugs).size} uniqQids=${new Set(qids).size} wrongSize=${badQ}`);
}
console.log('DONE');
