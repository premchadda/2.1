const fs = require('fs');
const path = require('path');

const testDir = 'apps/frontend/src/pages/tests';

function findInFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findInFiles(full);
    } else if (entry.name.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');

      // Look for suspicious arrays, objects, numbers, strings
      lines.forEach((line, idx) => {
        const l = line.trim();
        const lineNum = idx + 1;
        // Check for mock, dummy, sample, fallback, fake, hardcoded
        if (/mock|dummy|sample|fallback|fake|stub|hardcoded/i.test(l) && !l.startsWith('//') && !l.includes('import ')) {
          if (!l.includes('mock test') && !l.includes('mock-tests') && !l.includes('Mock Test') && !l.includes('Mock tests')) {
            console.log(`[TESTS-CHECK] ${full}:${lineNum} -> ${l.slice(0, 110)}`);
          }
        }
      });
    }
  }
}

findInFiles(testDir);
