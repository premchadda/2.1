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
console.log(`Scanning ${frontendFiles.length} frontend files for hardcoded cards and non-DB UI lists...`);

const cardFindings = [];

for (const fp of frontendFiles) {
  const content = fs.readFileSync(fp, 'utf-8');
  const rel = path.relative(rootDir, fp).replace(/\\/g, '/');

  // Find array declarations with objects that have title, name, card, heading, desc, icon, badge, price
  const arrayRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*\[\s*\{[\s\S]*?\}\s*\];/g;
  let match;
  while ((match = arrayRegex.exec(content)) !== null) {
    const varName = match[1];
    const fullDecl = match[0];
    
    // Ignore route definitions, standard nav configs, column definitions
    if (
      /columns|headers|tabs|filter|routes|schema|actions/i.test(varName) ||
      /label:\s*["']All/i.test(fullDecl) && fullDecl.length < 100
    ) {
      continue;
    }

    // Count items
    const itemCount = (fullDecl.match(/\{\s*[A-Za-z0-9_]+:/g) || []).length;
    if (itemCount >= 2) {
      cardFindings.push({
        file: rel,
        variableName: varName,
        itemCount,
        snippet: fullDecl.substring(0, 200).replace(/\s+/g, ' ') + '...'
      });
    }
  }

  // Also check for hardcoded JSX list rendering (e.g. 3-4 repeated hardcoded card divs)
  const cardPatterns = [
    /<div[^>]*className="[^"]*card[^"]*"[\s\S]*?<h[1-6]>[^<{]+<\/h[1-6]>/g,
    /\{\s*\[\s*\{[^}]+\},\s*\{[^}]+\}\s*\]\.map/g
  ];

  cardPatterns.forEach(cp => {
    const m = content.match(cp);
    if (m) {
      cardFindings.push({
        file: rel,
        type: 'Inline Static Array .map() or Hardcoded Card Pattern',
        count: m.length,
        snippet: m[0].substring(0, 150).replace(/\s+/g, ' ') + '...'
      });
    }
  });
}

fs.writeFileSync(
  path.join(rootDir, 'scripts', 'all_cards_mock_audit.json'),
  JSON.stringify(cardFindings, null, 2)
);

console.log(`Found ${cardFindings.length} hardcoded card / static list instances across frontend.`);
