import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build' || item === '__tests__') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (/\.(jsx?|tsx?)$/i.test(item)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const frontendFiles = scanDir(path.join(rootDir, 'apps', 'frontend', 'src'));
const backendFiles = scanDir(path.join(rootDir, 'apps', 'backend', 'src'));

console.log('--- SCANNING FRONTEND FOR HARDCODED DATA & FALLBACK OBJECTS ---');

const hardcodedFrontend = [];

for (const fp of frontendFiles) {
  const content = fs.readFileSync(fp, 'utf-8');
  const relPath = path.relative(rootDir, fp).replace(/\\/g, '/');

  // Check for static hardcoded arrays with multiple objects
  const staticArrayMatches = content.match(/const\s+([A-Za-z0-9_]+)\s*=\s*\[\s*\{[\s\S]*?\}\s*\];/g);
  if (staticArrayMatches) {
    staticArrayMatches.forEach(m => {
      const varName = m.match(/const\s+([A-Za-z0-9_]+)/)?.[1];
      if (varName && !varName.startsWith('routes') && !varName.startsWith('nav')) {
        hardcodedFrontend.push({
          file: relPath,
          variable: varName,
          length: m.split('}').length - 1,
          preview: m.substring(0, 150).replace(/\n/g, ' ') + '...'
        });
      }
    });
  }

  // Check for hardcoded fallback values in state / queries
  const fallbackMatches = content.match(/(fallback|mock|dummy|defaultData)\s*[:=]\s*(\[|\{)/gi);
  if (fallbackMatches) {
    hardcodedFrontend.push({
      file: relPath,
      type: 'Fallback / Mock Data Reference',
      matches: fallbackMatches
    });
  }
}

console.log(JSON.stringify(hardcodedFrontend, null, 2));

console.log('\n--- SCANNING BACKEND SEEDERS & MOCK SERVICES ---');
const backendSeeders = scanDir(path.join(rootDir, 'apps', 'backend', 'src', 'infrastructure', 'database', 'seeders'));
const seederList = backendSeeders.map(f => path.relative(rootDir, f).replace(/\\/g, '/'));
console.log('Backend Seeders:', seederList);

