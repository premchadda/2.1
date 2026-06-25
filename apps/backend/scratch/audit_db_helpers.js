import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { pool } from '../src/infrastructure/database/postgres-helpers.js';

// Get the actual list of tables from postgres
async function getPostgresTables() {
  const res = await pool.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public';
  `);
  return new Set(res.rows.map(r => r.tablename));
}

// Recursively find all js files
function getFiles(dir) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      files = files.concat(getFiles(filePath));
    } else if (filePath.endsWith('.js')) {
      files.push(filePath);
    }
  }
  return files;
}

async function main() {
  let pgTables;
  try {
    pgTables = await getPostgresTables();
  } catch (error) {
    console.error('Failed to get database tables:', error);
    process.exit(1);
  }

  // Import tableMap dynamically (or we can just inspect the class/instance)
  const { dbHelpers } = await import('../src/infrastructure/database/postgres-helpers.js');
  const tableMap = dbHelpers.tableMap;

  const srcDir = path.resolve('src');
  const files = getFiles(srcDir);

  // Regex to match dbHelpers calls, e.g. dbHelpers.find('entity' or dbHelpers.findOne("entity"
  // Also global.dbHelpers.find('entity'
  const regex = /(?:global\.)?dbHelpers\.(?:find|findOne|insertOne|updateOne|updateMany|delete|deleteOne|deleteMany|count)\s*\(\s*['"]([^'"]+)['"]/g;

  const warnings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const entity = match[1];
      const mappedTable = tableMap[entity] || entity;

      if (!pgTables.has(mappedTable)) {
        warnings.push({
          file: path.relative(process.cwd(), file),
          line: content.substring(0, match.index).split('\n').length,
          entity,
          mappedTable,
        });
      }
    }
  }

  console.log('--- DB Helpers Audit Results ---');
  if (warnings.length === 0) {
    console.log('No issues found! All dbHelpers entity names resolve to valid database tables.');
  } else {
    console.log(`Found ${warnings.length} warning(s):`);
    for (const w of warnings) {
      console.log(`[WARNING] File: ${w.file}:${w.line}`);
      console.log(`          Entity: "${w.entity}" -> Mapped table: "${w.mappedTable}" (DOES NOT EXIST in database)`);
      console.log('--------------------------------------------------');
    }
  }

  await pool.end();
}

main();
