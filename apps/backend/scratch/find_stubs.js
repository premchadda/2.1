import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

const ignoreDirs = ['node_modules', '.git', '.turbo', 'dist', 'build', 'supabase_data', 'scratch'];
const targetExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.sql'];

const searchPatterns = [
  { term: 'comingsoon', label: 'Coming Soon Reference' },
  { term: 'coming_soon', label: 'Coming Soon Reference' },
  { term: 'todo', label: 'TODO comment', caseSensitive: false },
  { term: 'fixme', label: 'FIXME comment', caseSensitive: false },
  { term: 'hardcoded', label: 'Hardcoded Reference', caseSensitive: false },
  { term: 'mockdata', label: 'Mock Data Reference', caseSensitive: false },
  { term: 'dummy', label: 'Dummy value/id', caseSensitive: false },
  { term: 'unreal', label: 'Unreal/fake data', caseSensitive: false },
  { term: 'math.random()', label: 'Math.random() (potential fake data)', caseSensitive: false }
];

function scanDirectory(dir) {
  let results = [];
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(rootDir, fullPath);

    if (fs.statSync(fullPath).isDirectory()) {
      if (ignoreDirs.some(ignored => file === ignored || relativePath.includes(ignored))) {
        continue;
      }
      results = results.concat(scanDirectory(fullPath));
    } else {
      const ext = path.extname(file);
      if (targetExtensions.includes(ext)) {
        results = results.concat(searchFile(fullPath, relativePath));
      }
    }
  }
  return results;
}

function searchFile(filePath, relativePath) {
  const fileResults = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    searchPatterns.forEach(pattern => {
      let matches = false;
      if (pattern.caseSensitive === false) {
        matches = line.toLowerCase().includes(pattern.term.toLowerCase());
      } else {
        matches = line.includes(pattern.term);
      }

      if (matches) {
        // Exclude self-references and common false positives (like vite config, tests if appropriate)
        if (relativePath.includes('find_stubs.js') || relativePath.includes('package-lock.json')) {
          return;
        }
        fileResults.push({
          file: relativePath,
          lineNum: index + 1,
          label: pattern.label,
          snippet: line.trim()
        });
      }
    });
  });

  return fileResults;
}

console.log('Scanning project files for stubs and incomplete logics...');
const allFindings = scanDirectory(rootDir);
console.log(`Found ${allFindings.length} potential stubs or hardcoded items.`);

// Group by component
const grouped = {
  frontend: [],
  backend: [],
  admin: [],
  packages: [],
  others: []
};

allFindings.forEach(finding => {
  if (finding.file.startsWith('apps/frontend')) {
    grouped.frontend.push(finding);
  } else if (finding.file.startsWith('apps/backend')) {
    grouped.backend.push(finding);
  } else if (finding.file.startsWith('apps/admin-panel')) {
    grouped.admin.push(finding);
  } else if (finding.file.startsWith('packages')) {
    grouped.packages.push(finding);
  } else {
    grouped.others.push(finding);
  }
});

fs.writeFileSync(
  path.join(__dirname, 'scan_results.json'),
  JSON.stringify(grouped, null, 2)
);
console.log('Results written to scratch/scan_results.json');
