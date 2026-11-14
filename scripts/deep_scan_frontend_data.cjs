const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '__tests__' || file === 'tests' || file.endsWith('.test.jsx') || file.endsWith('.test.js')) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (/\.(jsx?|tsx?)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk('apps/frontend/src');

const findings = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative('.', file);
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // 1. MOCK_ array/object declaration
    if (/const\s+([A-Z0-9_]*MOCK[A-Z0-9_]*|mock[A-Za-z0-9_]*|dummy[A-Za-z0-9_]*|sample[A-Za-z0-9_]*)\s*=\s*[{\[]/.test(line)) {
      // ignore if it's mock test (exam terminology) unless it's mockData
      if (!/mockTests?\s*=\s*(?:use|get|fetch)/i.test(line)) {
        findings.push({ file: rel, line: lineNum, category: 'MOCK_DATA_DEFINITION', text: line.trim() });
      }
    }

    // 2. Fallbacks returning static arrays/objects with dummy values
    if (/\|\|\s*\[\s*\{/.test(line)) {
      findings.push({ file: rel, line: lineNum, category: 'INLINE_ARRAY_FALLBACK', text: line.trim() });
    }

    // 3. Fake names / avatars in arrays
    if (/name:\s*["'](?:Rahul|Priya|Amit|Ananya|Sneha|Rohit|Rohan|John Doe|Jane Doe|Alice|Bob)["']/i.test(line)) {
      findings.push({ file: rel, line: lineNum, category: 'FAKE_USER_NAME', text: line.trim() });
    }

    // 4. Hardcoded marketing stats: e.g. "50,000+", "10,000+", "100k+", "98%", "4.9/5", "4.8"
    if (/(?:50,000\+|100,000\+|10,000\+|20,000\+|1,00,000\+|50k\+|100k\+|25k\+|10k\+|98%|99%|4\.[89]\s*(?:\/|stars|★|\/5))/i.test(line)) {
      if (!line.includes('*') && !line.includes('//') && !line.includes('eslint')) {
        findings.push({ file: rel, line: lineNum, category: 'HARDCODED_MARKETING_STAT', text: line.trim() });
      }
    }

    // 5. Hardcoded mock questions or answers
    if (/question:\s*["'][A-Z].*\?["']/i.test(line) && (line.includes('options:') || lines[idx+1]?.includes('options:'))) {
      findings.push({ file: rel, line: lineNum, category: 'HARDCODED_QUESTION', text: line.trim() });
    }
  });
});

console.log('Total findings:', findings.length);
fs.writeFileSync('scratch_deep_scan.json', JSON.stringify(findings, null, 2));
