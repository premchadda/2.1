import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const reportPath = path.join(rootDir, 'scripts', 'full_db_missing_data_audit.json');
if (fs.existsSync(reportPath)) {
  const audit = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const testsData = audit.find(a => a.table === 'tests');
  console.log(JSON.stringify(testsData, null, 2));
}
