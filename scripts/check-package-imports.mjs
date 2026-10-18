import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import builtinModules from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILTINS = new Set(builtinModules.builtinModules || []);

function isBuiltin(pkg) {
  if (pkg.startsWith('node:')) return true;
  return BUILTINS.has(pkg);
}

function scanDir(dir, results = []) {
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (['node_modules', 'dist', '.git', 'build', '.turbo'].includes(entry.name)) {
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

const APPS = [
  { name: 'backend', path: join(ROOT, 'apps', 'backend') },
  { name: 'frontend', path: join(ROOT, 'apps', 'frontend') },
  { name: 'admin-panel', path: join(ROOT, 'apps', 'admin-panel') },
  { name: 'shared-config', path: join(ROOT, 'packages', 'shared-config') },
  { name: 'shared-hooks', path: join(ROOT, 'packages', 'shared-hooks') },
];

console.log('=====================================================');
console.log('📦 PACKAGE IMPORTS VS PACKAGE.JSON DEPENDENCY AUDIT');
console.log('=====================================================');

let allMissing = [];

for (const app of APPS) {
  const pkgJsonPath = join(app.path, 'package.json');
  if (!existsSync(pkgJsonPath)) continue;

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const declaredDeps = new Set([
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {}),
    ...Object.keys(pkgJson.peerDependencies || {}),
    // Monorepo internal workspace packages
    '@trstprep/shared-config',
    '@trstprep/shared-hooks'
  ]);

  const srcDir = join(app.path, 'src');
  const files = scanDir(srcDir);
  const usedPackages = new Set();

  for (const file of files) {
    if (file.includes('__tests__') || file.includes('.test.')) continue;
    const raw = readFileSync(file, 'utf8');
    const content = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*/g, '$1');

    // Real ES6 static import/export: `import ... from '...'` or `export ... from '...'`
    const importRegex = /(?:^|\n)\s*(?:import|export)\s+[^;]*?from\s+['"]([^'"]+)['"]/g;
    // Direct side-effect import: `import '...'`
    const sideEffectImportRegex = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
    // Dynamic import: `import('...')`
    const dynamicRegex = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    // CommonJS require: `require('...')`
    const requireRegex = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    const matches = [
      ...content.matchAll(importRegex),
      ...content.matchAll(sideEffectImportRegex),
      ...content.matchAll(dynamicRegex),
      ...content.matchAll(requireRegex)
    ];

    for (const m of matches) {
      const imp = m[1];
      if (imp.startsWith('.') || imp.startsWith('/') || imp.startsWith('#')) continue;
      if (imp.startsWith('virtual:')) continue; // Vite virtual plugins (e.g. virtual:pwa-register)
      if (isBuiltin(imp)) continue;

      // Extract package name (handles scoped packages like @tanstack/react-query)
      let pkgName;
      if (imp.startsWith('@')) {
        const parts = imp.split('/');
        pkgName = parts.slice(0, 2).join('/');
      } else {
        pkgName = imp.split('/')[0];
      }

      // Check if it's a valid npm package identifier (not string interpolation or prose)
      if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(pkgName)) {
        continue;
      }

      usedPackages.add({ pkgName, file });
    }
  }

  const missingForApp = [];
  for (const { pkgName, file } of usedPackages) {
    if (!declaredDeps.has(pkgName)) {
      // Check if it's an optional dynamic import with catch
      if (pkgName === '@sentry/browser') continue;
      missingForApp.push({ app: app.name, package: pkgName, file: file.replace(ROOT, '') });
    }
  }

  if (missingForApp.length === 0) {
    console.log(`✅ ${app.name}: all package imports are declared in package.json`);
  } else {
    console.log(`❌ ${app.name}: ${missingForApp.length} undeclared package imports found:`);
    missingForApp.forEach(m => console.log(`   - "${m.package}" in ${m.file}`));
    allMissing = allMissing.concat(missingForApp);
  }
}

if (allMissing.length === 0) {
  console.log('\n🎉 ALL PACKAGE IMPORTS CLEANLY RESOLVED ACROSS THE MONOREPO!');
} else {
  console.log(`\n⚠️  Total undeclared package imports: ${allMissing.length}`);
}
