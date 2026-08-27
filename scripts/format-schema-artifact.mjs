import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dictPath = path.join(rootDir, 'scripts', 'full_db_schema_dictionary.json');
const targetPath = 'C:\\Users\\mahic\\.gemini\\antigravity-ide\\brain\\fa8f598f-c3cd-4deb-be1d-62d2dd309356\\database_schema_dictionary.md';

if (fs.existsSync(dictPath)) {
  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

  let md = '# Trstprep V2.1 — Complete Database Schema Dictionary (162 Tables)\n\n';
  md += `Generated from live PostgreSQL database on ${new Date().toISOString()}.\n\n`;
  md += `**Total Tables**: ${dict.length} | **Populated**: ${dict.filter(t => t.rowCount > 0).length} | **Empty**: ${dict.filter(t => t.rowCount === 0).length}\n\n`;
  md += '---\n\n';

  // Group by populated vs empty
  const populated = dict.filter(t => t.rowCount > 0).sort((a, b) => b.rowCount - a.rowCount);
  const empty = dict.filter(t => t.rowCount === 0).sort((a, b) => a.table.localeCompare(b.table));

  md += '## 1. Active Populated Tables (' + populated.length + ' Tables)\n\n';
  for (const t of populated) {
    md += `### \`${t.table}\` (${t.rowCount.toLocaleString()} rows, ${t.columns.length} columns)\n\n`;
    md += '| # | Column Name | Data Type | Nullable | Default |\n';
    md += '|---|---|---|:---:|---|\n';
    t.columns.forEach((c, idx) => {
      md += `| ${idx + 1} | **\`${c.name}\`** | \`${c.type}\` | ${c.nullable ? 'YES' : 'NO'} | ${c.default ? '`' + c.default.replace(/\|/g, '\\|') + '`' : '—'} |\n`;
    });
    md += '\n';
  }

  md += '---\n\n';
  md += '## 2. Empty / Unused Tables (' + empty.length + ' Tables)\n\n';
  for (const t of empty) {
    md += `### \`${t.table}\` (0 rows, ${t.columns.length} columns)\n\n`;
    md += '| # | Column Name | Data Type | Nullable | Default |\n';
    md += '|---|---|---|:---:|---|\n';
    t.columns.forEach((c, idx) => {
      md += `| ${idx + 1} | **\`${c.name}\`** | \`${c.type}\` | ${c.nullable ? 'YES' : 'NO'} | ${c.default ? '`' + c.default.replace(/\|/g, '\\|') + '`' : '—'} |\n`;
    });
    md += '\n';
  }

  fs.writeFileSync(targetPath, md, 'utf-8');
  console.log(`Generated database_schema_dictionary.md successfully (${md.length} bytes).`);
}
