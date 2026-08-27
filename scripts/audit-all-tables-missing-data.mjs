import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, 'apps', 'backend', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

(async () => {
  console.log('Connecting to PostgreSQL to perform full-database missing data audit...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 0,
    query_timeout: 0
  });

  await client.connect();

  try {
    // 1. Get all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tableNames.length} tables in database.`);

    const auditResults = [];

    for (const tableName of tableNames) {
      // Get count
      let rowCount = 0;
      try {
        const countRes = await client.query(`SELECT COUNT(*)::int as c FROM "${tableName}";`);
        rowCount = countRes.rows[0].c;
      } catch (err) {
        auditResults.push({
          table: tableName,
          rowCount: 0,
          error: err.message,
          missingFields: []
        });
        continue;
      }

      if (rowCount === 0) {
        auditResults.push({
          table: tableName,
          rowCount: 0,
          status: 'EMPTY_TABLE',
          missingFields: []
        });
        continue;
      }

      // Get columns
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      const cols = colsRes.rows;
      const missingFields = [];

      // Construct aggregate query to find NULL or empty counts for each column
      const selectExprs = cols.map(c => {
        const colName = `"${c.column_name}"`;
        if (c.data_type.includes('char') || c.data_type === 'text') {
          return `COUNT(CASE WHEN ${colName} IS NULL OR TRIM(${colName}) = '' THEN 1 END)::int AS "null_${c.column_name}"`;
        } else if (c.data_type === 'ARRAY') {
          return `COUNT(CASE WHEN ${colName} IS NULL OR array_length(${colName}, 1) IS NULL OR array_length(${colName}, 1) = 0 THEN 1 END)::int AS "null_${c.column_name}"`;
        } else if (c.data_type === 'jsonb' || c.data_type === 'json') {
          return `COUNT(CASE WHEN ${colName} IS NULL OR ${colName}::text = '{}' OR ${colName}::text = '[]' OR ${colName}::text = 'null' THEN 1 END)::int AS "null_${c.column_name}"`;
        } else {
          return `COUNT(CASE WHEN ${colName} IS NULL THEN 1 END)::int AS "null_${c.column_name}"`;
        }
      });

      try {
        const nullRes = await client.query(`SELECT ${selectExprs.join(', ')} FROM "${tableName}";`);
        const nullCounts = nullRes.rows[0];

        for (const c of cols) {
          const nullCount = nullCounts[`null_${c.column_name}`] || 0;
          const nullPct = Number(((nullCount / rowCount) * 100).toFixed(1));
          
          if (nullCount > 0) {
            missingFields.push({
              column: c.column_name,
              type: c.data_type,
              nullable: c.is_nullable === 'YES',
              missingCount: nullCount,
              missingPct: nullPct
            });
          }
        }

        auditResults.push({
          table: tableName,
          rowCount,
          status: 'POPULATED',
          columnCount: cols.length,
          missingFields
        });

      } catch (err) {
        auditResults.push({
          table: tableName,
          rowCount,
          error: `Column null query failed: ${err.message}`,
          missingFields: []
        });
      }
    }

    // Save full JSON report
    fs.writeFileSync(
      path.join(rootDir, 'scripts', 'full_db_missing_data_audit.json'),
      JSON.stringify(auditResults, null, 2)
    );
    console.log('Saved detailed audit to scripts/full_db_missing_data_audit.json');

    // Summary statistics
    const emptyTables = auditResults.filter(r => r.rowCount === 0).map(r => r.table);
    const populatedTables = auditResults.filter(r => r.rowCount > 0);

    console.log(`\n======================================================`);
    console.log(`--- FULL DATABASE DATA AUDIT SUMMARY ---`);
    console.log(`======================================================`);
    console.log(`Total Tables: ${tableNames.length}`);
    console.log(`Populated Tables (${populatedTables.length}):`);
    populatedTables.forEach(t => {
      const allNullCols = t.missingFields.filter(f => f.missingPct === 100).length;
      const partialNullCols = t.missingFields.filter(f => f.missingPct > 0 && f.missingPct < 100).length;
      console.log(` - ${t.table.padEnd(28)} | ${String(t.rowCount).padStart(6)} rows | ${t.columnCount} cols | ${allNullCols} cols 100% empty | ${partialNullCols} cols partially empty`);
    });

    console.log(`\nEmpty Tables (${emptyTables.length}):`);
    console.log(emptyTables.join(', '));

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await client.end();
  }
})();
