import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const auditPath = path.join(rootDir, 'scripts', 'mock_data_audit.json');
if (fs.existsSync(auditPath)) {
  const data = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));

  console.log('=== HARDCODED / MOCK DATA AUDIT IN CODEBASE ===\n');

  for (const item of data) {
    console.log(`📁 File: ${item.file}`);
    if (item.isMockFile) console.log(`   ⚠️ Identified as dedicated mock file`);
    item.findings.forEach(f => {
      console.log(`   - Line ${f.line}: ${f.snippet}`);
    });
    console.log('');
  }
}
