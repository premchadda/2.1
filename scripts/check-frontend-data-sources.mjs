import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pagesDir = path.join(rootDir, 'apps', 'frontend', 'src', 'pages');

function getFiles(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const p = path.join(dir, item);
    if (fs.statSync(p).isDirectory()) {
      files = files.concat(getFiles(p));
    } else if (/\.(jsx|tsx)$/.test(item)) {
      files.push(p);
    }
  }
  return files;
}

const pageFiles = getFiles(pagesDir);
const pageReports = [];

for (const pf of pageFiles) {
  const content = fs.readFileSync(pf, 'utf-8');
  const rel = path.relative(rootDir, pf).replace(/\\/g, '/');

  // Check API endpoints used
  const apiCalls = [...content.matchAll(/api\.(get|post|put|delete)\(['"]([^'"]+)['"]/g)].map(m => m[2]);
  const fetchCalls = [...content.matchAll(/useQuery\(\{[^}]*queryKey:\s*\[['"]([^'"]+)['"]/g)].map(m => m[1]);

  pageReports.push({
    page: rel,
    apiEndpoints: [...new Set(apiCalls)],
    queryKeys: [...new Set(fetchCalls)]
  });
}

console.log('=== FRONTEND PAGES DATA-SOURCE AUDIT ===\n');
for (const pr of pageReports) {
  console.log(`📄 ${pr.page}`);
  if (pr.apiEndpoints.length > 0) {
    console.log(`   🔗 Live API Endpoints: ${pr.apiEndpoints.join(', ')}`);
  }
  if (pr.queryKeys.length > 0) {
    console.log(`   ⚡ Query Keys: ${pr.queryKeys.join(', ')}`);
  }
  if (pr.apiEndpoints.length === 0 && pr.queryKeys.length === 0) {
    console.log(`   ℹ️ No direct API calls (pure UI or sub-component container)`);
  }
  console.log('');
}
