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

const suspicious = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative('.', file);

  // Check 1: Variable declarations named mock/dummy/sample/fake
  const varMatches = content.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]*(?:mock|dummy|sample|fake)[A-Za-z0-9_]*)\s*=/gi);
  for (const m of varMatches) {
    suspicious.push({ file: rel, type: 'MOCK_VARIABLE', name: m[1] });
  }

  // Check 2: hardcoded testimonials / reviews
  if (/testimonials?\s*=\s*\[/i.test(content) || /const\s+REVIEWS\s*=/i.test(content)) {
    suspicious.push({ file: rel, type: 'HARDCODED_TESTIMONIALS' });
  }

  // Check 3: hardcoded stat counters
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Look for fake social proof / stats in landing/about/pass pages
    if (/([0-9]+[kKmM\+]+\s*(?:students|aspirants|questions|tests|users|success|selections|ratings?)|[0-9]{2,3}(?:[,.][0-9]{3})+\+?)/i.test(line)) {
      if (!line.includes('//') && !line.includes('console.')) {
        suspicious.push({ file: rel, line: idx + 1, type: 'HARDCODED_STAT', text: line.trim().slice(0, 100) });
      }
    }
    // Look for mock/dummy fallbacks
    if (/\|\|\s*([A-Za-z0-9_]*(?:mock|dummy|sample)[A-Za-z0-9_]*)/i.test(line)) {
      suspicious.push({ file: rel, line: idx + 1, type: 'MOCK_FALLBACK', text: line.trim().slice(0, 100) });
    }
    if (/catch.*(?:mock|dummy|sample)/i.test(line)) {
      suspicious.push({ file: rel, line: idx + 1, type: 'CATCH_MOCK', text: line.trim().slice(0, 100) });
    }
  });
}

console.log('Total suspicious items found:', suspicious.length);
fs.writeFileSync('scratch_suspicious.json', JSON.stringify(suspicious, null, 2));
