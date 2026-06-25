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

console.log('=== DETAILED ACTIVE CODE FINDINGS ===\n');

['frontend', 'backend', 'admin'].forEach(component => {
  console.log(`==================== ${component.toUpperCase()} ====================`);
  const findings = data[component] || [];
  
  if (findings.length === 0) {
    console.log('No findings.');
    return;
  }

  // Group by file
  const files = {};
  findings.forEach(f => {
    if (!files[f.file]) {
      files[f.file] = [];
    }
    files[f.file].push(f);
  });

  Object.entries(files).forEach(([file, items]) => {
    console.log(`\nFile: ${file} (${items.length} items)`);
    items.forEach(item => {
      console.log(`  Line ${item.lineNum} [${item.label}]: ${item.snippet}`);
    });
  });
  console.log('\n');
});
