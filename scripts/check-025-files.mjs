import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const files = [
  'apps/frontend/src/pages/tests/TestInterface.jsx',
  'apps/frontend/src/pages/tests/TestResult.jsx',
  'apps/backend/src/shared/utils/scoreAttempt.js',
  'apps/backend/src/modules/tests/test.routes.js',
  'apps/backend/src/modules/attempts/attempt.service.js',
  'apps/backend/src/services/core/TestAttemptController.js',
  'apps/admin-panel/src/features/admin/assessments-quizzes/PracticeQuestionsManager.jsx'
];

for (const f of files) {
  const p = path.join(rootDir, f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf-8').split('\n');
  console.log(`\n=== File: ${f} ===`);
  lines.forEach((l, idx) => {
    if (l.includes('0.25') || l.includes('DEFAULT_NEGATIVE') || l.includes('negativeMarks') || l.includes('negative_marks')) {
      console.log(`  Line ${idx + 1}: ${l.trim()}`);
    }
  });
}
