import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scanFilePath = path.join(__dirname, 'scan_results.json');

if (!fs.existsSync(scanFilePath)) {
  console.error('scan_results.json not found!');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(scanFilePath, 'utf8'));

console.log('=== SCAN SUMMARY ===\n');

for (const [component, findings] of Object.entries(data)) {
  console.log(`Component: ${component.toUpperCase()} (${findings.length} items)`);
  
  // Group by file
  const files = {};
  findings.forEach(f => {
    if (!files[f.file]) {
      files[f.file] = [];
    }
    files[f.file].push(f);
  });

  const fileList = Object.keys(files);
  console.log(`Unique Files with items: ${fileList.length}`);
  
  // Print top 10 files with most items
  const sortedFiles = fileList.map(file => ({
    file,
    count: files[file].length,
    labels: [...new Set(files[file].map(x => x.label))],
    snippets: files[file].slice(0, 3).map(x => `Line ${x.lineNum}: ${x.snippet}`)
  })).sort((a, b) => b.count - a.count);

  console.log('Top 8 files with most items:');
  sortedFiles.slice(0, 8).forEach(sf => {
    console.log(`  - ${sf.file} (${sf.count} occurrences)`);
    console.log(`    Types: ${sf.labels.join(', ')}`);
    console.log('    Samples:');
    sf.snippets.forEach(s => console.log(`      ${s}`));
  });
  console.log('\n----------------------------------------\n');
}
