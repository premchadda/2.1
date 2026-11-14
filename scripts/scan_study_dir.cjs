const fs = require('fs');
const path = require('path');

const studyDir = 'apps/frontend/src/pages/study';

function checkFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const lines = code.split('\n');

  lines.forEach((line, idx) => {
    const l = line.trim();
    const lineNum = idx + 1;
    if (l.startsWith('//') || l.startsWith('*')) return;

    // mock / dummy / fake
    if (/mock|dummy|sample|fake|placeholder|fallback|hardcode/i.test(l) && !l.includes('import ') && !l.includes('from ')) {
      console.log(`[STUDY-DATA] ${path.basename(filePath)}:${lineNum} -> ${l.slice(0, 100)}`);
    }

    // hardcoded widths > 300px
    if (/\bw-\[(?:[4-9]\d{2}|[1-9]\d{3})px\]/.test(l) || /\bmin-w-\[(?:[4-9]\d{2}|[1-9]\d{3})px\]/.test(l)) {
      console.log(`[STUDY-UI-WIDTH] ${path.basename(filePath)}:${lineNum} -> ${l.slice(0, 100)}`);
    }

    // missing dark mode on bg-white
    if (/\bbg-white\b/.test(l) && !l.includes('dark:bg-') && !l.includes('dark:bg/')) {
      const ctx = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join(' ');
      if (!ctx.includes('dark:bg-')) {
        console.log(`[STUDY-UI-DARK] ${path.basename(filePath)}:${lineNum} -> ${l.slice(0, 100)}`);
      }
    }
  });
}

fs.readdirSync(studyDir).forEach(f => {
  const p = path.join(studyDir, f);
  if (f.endsWith('.jsx') || f.endsWith('.js')) {
    checkFile(p);
  }
});
