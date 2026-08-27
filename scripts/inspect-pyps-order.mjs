import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const mappingPath = path.join(rootDir, 'scripts', 'proposed_id_mapping.json');
if (fs.existsSync(mappingPath)) {
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  
  // Filter for PYP tests
  const pypTests = mapping.filter(m => 
    m.category === 'PYPs' || 
    m.title.toLowerCase().includes('shift') || 
    m.title.toLowerCase().includes('previous year') ||
    /\b(2016|2018|2019|2020|2021|2022|2023|2024|2025)\b/.test(m.title)
  );

  console.log(`Found ${pypTests.length} PYP/Shift tests in proposed mapping.`);
  
  // Group by series and exam year
  const pypGroups = {};
  for (const t of pypTests) {
    let group = t.series;
    if (!pypGroups[group]) pypGroups[group] = [];
    pypGroups[group].push(t);
  }

  for (const [groupName, tests] of Object.entries(pypGroups)) {
    console.log(`\n=== Series: ${groupName} (${tests.length} PYP tests) ===`);
    tests.slice(0, 15).forEach(t => {
      console.log(`  Old ID: ${t.oldId} -> New ID: ${t.newId} | "${t.title}"`);
    });
    if (tests.length > 15) {
      console.log(`  ... and ${tests.length - 15} more (e.g. Old ID: ${tests[tests.length-1].oldId} -> New ID: ${tests[tests.length-1].newId} | "${tests[tests.length-1].title}")`);
    }
  }
}
