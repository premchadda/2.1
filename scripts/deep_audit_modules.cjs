const fs = require('fs');
const path = require('path');

const dirs = [
  'apps/frontend/src/pages/tests',
  'apps/frontend/src/pages/study',
  'apps/frontend/src/pages/exams',
  'apps/frontend/src/pages/pyps'
];

function scanDir(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) files = files.concat(scanDir(p));
    else if (f.endsWith('.jsx') || f.endsWith('.js')) files.push(p);
  });
  return files;
}

const allFiles = dirs.flatMap(scanDir);

console.log('Auditing ' + allFiles.length + ' files...');

const reports = [];

allFiles.forEach(filePath => {
  const code = fs.readFileSync(filePath, 'utf8');
  const lines = code.split('\n');

  // 1. Look for hardcoded mock arrays / static test data
  lines.forEach((line, i) => {
    const l = line.trim();
    const lineNum = i + 1;
    if (l.startsWith('//') || l.startsWith('*')) return;

    // Check for hardcoded questions or mock arrays
    if (/(?:const|let|var)\s+(?:mockQuestions|sampleQuestions|demoQuestions|dummyQuestions|defaultQuestions|fallbackQuestions|mockData|dummyData|mockTest|mockTests|sampleTests)\s*=/i.test(l)) {
      reports.push({
        file: filePath,
        line: lineNum,
        type: 'HARDCODED_DATA',
        detail: `Hardcoded question or test data array: "${l.slice(0, 80)}"`
      });
    }

    // Check for inline questions array
    if (/questions\s*:\s*\[\s*\{/i.test(l) && !l.includes('useState') && !l.includes('useEffect')) {
      reports.push({
        file: filePath,
        line: lineNum,
        type: 'HARDCODED_DATA',
        detail: `Inline questions array definition: "${l.slice(0, 80)}"`
      });
    }

    // Check for hardcoded test scores/accuracy/percentile/ranks
    if (/(?:percentile|accuracy|score|rank|topperScore|averageScore)\s*:\s*(?:[0-9]{2,3}|['"][0-9]{2,3}%?['"])/i.test(l) && !l.includes('parseInt') && !l.includes('parseFloat') && !l.includes('Number') && !l.includes('Math.')) {
      if (!l.includes('min:') && !l.includes('max:') && !l.includes('step:')) {
        reports.push({
          file: filePath,
          line: lineNum,
          type: 'HARDCODED_METRIC',
          detail: `Hardcoded score/accuracy/metric: "${l.slice(0, 80)}"`
        });
      }
    }

    // Check for hardcoded test IDs
    if (/(?:testId|test_id|examId|exam_id)\s*[:=]\s*['"](?:test-|\d+|[a-f0-9-]{36})['"]/i.test(l)) {
      reports.push({
        file: filePath,
        line: lineNum,
        type: 'HARDCODED_ID',
        detail: `Hardcoded Test or Exam ID: "${l.slice(0, 80)}"`
      });
    }

    // Check for mock solutions / dummy options
    if (/options\s*:\s*\[\s*['"`](?:Option|A|Option 1|Select)/i.test(l) || /solution\s*:\s*['"`](?:Option|The correct|Answer is)/i.test(l)) {
      reports.push({
        file: filePath,
        line: lineNum,
        type: 'HARDCODED_SOLUTION_OR_OPTION',
        detail: `Mock solution or dummy options: "${l.slice(0, 80)}"`
      });
    }

    // Check for stubbed timers (e.g. initial timer state hardcoded to fixed number instead of test.duration)
    if (/(?:timeRemaining|timeLeft|timer|duration)\s*[:=]\s*(?:3600|7200|5400|1800|1200|600)\b/i.test(l) && !l.includes('test?.duration') && !l.includes('test.duration')) {
      reports.push({
        file: filePath,
        line: lineNum,
        type: 'STUBBED_TIMER',
        detail: `Stubbed or hardcoded timer/duration constant: "${l.slice(0, 80)}"`
      });
    }
  });
});

console.log('Found ' + reports.length + ' data/metric findings');
fs.writeFileSync('scripts/deep_data_findings.json', JSON.stringify(reports, null, 2));
