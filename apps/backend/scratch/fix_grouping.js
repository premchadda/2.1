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

// Combine all groups into a single array of findings
let allFindings = [];
Object.values(data).forEach(arr => {
  allFindings = allFindings.concat(arr);
});

// Re-group with backslash/forwardslash normalize
const grouped = {
  frontend: [],
  backend: [],
  admin: [],
  packages: [],
  others: []
};

allFindings.forEach(finding => {
  const normFile = finding.file.replace(/\\/g, '/');
  if (normFile.startsWith('apps/frontend')) {
    grouped.frontend.push(finding);
  } else if (normFile.startsWith('apps/backend')) {
    grouped.backend.push(finding);
  } else if (normFile.startsWith('apps/admin-panel')) {
    grouped.admin.push(finding);
  } else if (normFile.startsWith('packages')) {
    grouped.packages.push(finding);
  } else {
    grouped.others.push(finding);
  }
});

// Save corrected grouping
fs.writeFileSync(scanFilePath, JSON.stringify(grouped, null, 2));

console.log('=== CORRECTED SCAN SUMMARY ===\n');

for (const [component, findings] of Object.entries(grouped)) {
  console.log(`Component: ${component.toUpperCase()} (${findings.length} items)`);
  
  const files = {};
  findings.forEach(f => {
    if (!files[f.file]) {
      files[f.file] = [];
    }
    files[f.file].push(f);
  });

  const fileList = Object.keys(files);
  console.log(`Unique Files with items: ${fileList.length}`);
  
  const sortedFiles = fileList.map(file => ({
    file,
    count: files[file].length,
    labels: [...new Set(files[file].map(x => x.label))]
  })).sort((a, b) => b.count - a.count);

  console.log('Top files with items:');
  sortedFiles.slice(0, 12).forEach(sf => {
    console.log(`  - ${sf.file} (${sf.count} items) -> [${sf.labels.join(', ')}]`);
  });
  console.log('\n----------------------------------------\n');
}
