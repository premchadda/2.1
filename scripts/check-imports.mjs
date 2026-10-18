import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '.mjs', '.css', '.svg', '.png', '.jpg'];
const INDEX_FILES = ['index.js', 'index.jsx', 'index.ts', 'index.tsx', 'index.mjs'];

function resolveImport(importPath, currentDir) {
  // Only check relative imports
  if (!importPath.startsWith('.')) return true;

  const targetPath = resolve(currentDir, importPath);

  // Check direct file with various extensions
  for (const ext of EXTENSIONS) {
    if (existsSync(targetPath + ext) && statSync(targetPath + ext).isFile()) {
      return true;
    }
  }

  // Check if directory with index
  if (existsSync(targetPath) && statSync(targetPath).isDirectory()) {
    for (const idx of INDEX_FILES) {
      if (existsSync(join(targetPath, idx))) {
        return true;
      }
    }
  }

  return false;
}

function scanDir(dir, results = []) {
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'build') {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, results);
    } else if (/\.(js|jsx|ts|tsx|mjs)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

const targets = [
  join(ROOT, 'apps', 'backend', 'src'),
  join(ROOT, 'apps', 'frontend', 'src'),
  join(ROOT, 'apps', 'admin-panel', 'src'),
  join(ROOT, 'packages', 'shared-config', 'src'),
  join(ROOT, 'packages', 'shared-hooks', 'src')
];

let totalFiles = 0;
let brokenImports = [];

for (const target of targets) {
  const files = scanDir(target);
  totalFiles += files.length;

  for (const file of files) {
    const rawContent = readFileSync(file, 'utf8');
    const currentDir = dirname(file);

    // Strip comments to avoid false positives on docstring examples
    const content = rawContent
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*/g, '$1');

    // Regex for import ... from '...'
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    // Regex for dynamic import('...')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    // Regex for require('...')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    const matches = [
      ...content.matchAll(importRegex),
      ...content.matchAll(dynamicImportRegex),
      ...content.matchAll(requireRegex)
    ];

    for (const m of matches) {
      const imp = m[1];
      if (imp.startsWith('.')) {
        const ok = resolveImport(imp, currentDir);
        if (!ok) {
          brokenImports.push({
            file: file.replace(ROOT, ''),
            import: imp
          });
        }
      }
    }
  }
}

console.log(`Scanned ${totalFiles} source files across backend, frontend, admin, and shared packages.`);
if (brokenImports.length === 0) {
  console.log('✅ 0 broken/unresolved local imports found! All relative imports resolve cleanly to real files on disk.');
} else {
  console.log(`❌ Found ${brokenImports.length} broken imports:`);
  console.log(JSON.stringify(brokenImports, null, 2));
}
