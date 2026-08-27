import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const mockPatterns = [
  /mock/i,
  /dummy/i,
  /placeholder/i,
  /fake/i,
  /hardcoded/i,
  /sample/i,
  /fallback/i
];

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build' || item === '.turbo' || item === 'graphify-out') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else if (/\.(jsx?|tsx?|json)$/i.test(item)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const frontendFiles = scanDir(path.join(rootDir, 'apps', 'frontend', 'src'));
const backendFiles = scanDir(path.join(rootDir, 'apps', 'backend', 'src'));
const allFiles = [...frontendFiles, ...backendFiles];

const findings = [];

for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

  // Check filename
  const fileName = path.basename(filePath);
  const isMockFile = /mock|dummy|fake|sample|seed/i.test(fileName) && !/node_modules/i.test(fileName);

  const fileFindings = [];

  lines.forEach((line, idx) => {
    // Look for hardcoded mock arrays / objects
    if (
      /const\s+(MOCK_|mock|dummy|SAMPLE_|sample|FAKE_|fake|HARDCODED_)/i.test(line) ||
      /export\s+const\s+(MOCK_|mock|dummy|SAMPLE_|sample|FAKE_|fake)/i.test(line) ||
      /fallback.*=\s*\[/i.test(line) ||
      /\[\s*{\s*id:\s*['"]?1['"]?,\s*name:/i.test(line) ||
      /return\s+(mock|dummy|fallbackData|sampleData)/i.test(line)
    ) {
      fileFindings.push({
        line: idx + 1,
        snippet: line.trim().substring(0, 120)
      });
    }
  });

  if (isMockFile || fileFindings.length > 0) {
    findings.push({
      file: relPath,
      isMockFile,
      findings: fileFindings
    });
  }
}

fs.writeFileSync(
  path.join(rootDir, 'scripts', 'mock_data_audit.json'),
  JSON.stringify(findings, null, 2)
);

console.log(`Scan completed. Found ${findings.length} files containing mock/dummy/hardcoded data patterns.`);
