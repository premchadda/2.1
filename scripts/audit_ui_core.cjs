const fs = require('fs');
const path = require('path');

const dirs = [
  'apps/frontend/src/pages/tests',
  'apps/frontend/src/pages/study',
  'apps/frontend/src/pages/exams',
  'apps/frontend/src/pages/pyps'
];

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
      results.push(full);
    }
  });
  return results;
}

let allFiles = [];
dirs.forEach(d => { allFiles = allFiles.concat(getFiles(d)); });
console.log('Total files to audit:', allFiles.length);

const mockKeywords = [
  'mock', 'dummy', 'sample', 'placeholder', 'hardcoded', 'lorem',
  'fake', 'MOCK_', 'DUMMY_', 'SAMPLE_', 'FALLBACK_'
];

const dataFindings = [];
const uiFindings = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

    // Data checks
    mockKeywords.forEach(kw => {
      const regex = new RegExp('\\b' + kw + '\\b', 'i');
      if (regex.test(line) && !line.includes('import ') && !line.includes('//') && !line.includes('from ')) {
        dataFindings.push({ file, line: lineNum, text: trimmed.slice(0, 120), kw });
      }
    });

    // Check for hardcoded metrics/scores/arrays of questions
    if (/const\s+(?:questions|sampleQuestions|mockData|testData|dummyData|mockTest|mockOptions)\s*=/i.test(line)) {
      dataFindings.push({ file, line: lineNum, text: trimmed.slice(0, 120), kw: 'Hardcoded questions/test data array' });
    }

    // UI checks
    // 1. Hardcoded widths/heights that break mobile
    if (/\bw-\[(?:[4-9]\d{2}|[1-9]\d{3})px\]/.test(line) || /\bmin-w-\[(?:[4-9]\d{2}|[1-9]\d{3})px\]/.test(line)) {
      uiFindings.push({ file, line: lineNum, text: trimmed.slice(0, 120), type: 'HARDCODED_LARGE_WIDTH' });
    }

    // 2. KaTeX clipping: KaTeX or math rendering without overflow-x-auto or break-words
    if (/katex|math/i.test(line) && !line.includes('import')) {
      // check context
      const ctx = lines.slice(Math.max(0, idx - 5), Math.min(lines.length, idx + 5)).join(' ');
      if (!ctx.includes('overflow-x-auto') && !ctx.includes('break-words')) {
        uiFindings.push({ file, line: lineNum, text: trimmed.slice(0, 120), type: 'POTENTIAL_KATEX_CLIPPING' });
      }
    }

    // 3. Excessive padding/margin
    if (/\b(?:p|m|px|py|pt|pb|pl|pr|gap)-(?:1[4-9]|2\d|3\d|4\d|5\d)\b/.test(line)) {
      uiFindings.push({ file, line: lineNum, text: trimmed.slice(0, 120), type: 'EXCESSIVE_SPACING' });
    }

    // 4. Missing dark mode on prominent containers
    if (/\bbg-white\b/.test(line) && !line.includes('dark:bg-') && !line.includes('dark:bg/')) {
      uiFindings.push({ file, line: lineNum, text: trimmed.slice(0, 120), type: 'MISSING_DARK_MODE_BG' });
    }

    // 5. Accessible buttons / icon buttons without aria-label
    if (/<button\b/.test(line) && !line.includes('aria-label') && (/<[A-Z][a-zA-Z]*Icon\b/.test(line) || /<Fi|<Fa|<Lucide|<Hi|<Bi|<Ri|<Md/.test(line))) {
      uiFindings.push({ file, line: lineNum, text: trimmed.slice(0, 120), type: 'ICON_BUTTON_MISSING_ARIA' });
    }
  });
});

console.log('Data findings count:', dataFindings.length);
console.log('UI findings count:', uiFindings.length);

fs.writeFileSync('scripts/audit_ui_core_output.json', JSON.stringify({ dataFindings, uiFindings }, null, 2));
