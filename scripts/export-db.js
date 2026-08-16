import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../../apps/backend/.env') });
if (!process.env.DATABASE_URL) dotenv.config();

if (!process.env.DATABASE_URL) {
  fs.writeFileSync(path.join(__dirname, 'export-log.txt'), 'ERROR: DATABASE_URL not set');
  process.exit(1);
}

const logFile = path.join(__dirname, 'export-log.txt');
const log = (msg) => {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
};

// Clear log
fs.writeFileSync(logFile, '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // M42: use default TLS verification. If Supabase self-signed cert causes
  // issues, supply the CA via ssl: { rejectUnauthorized: true, ca: fs.readFileSync(...) }.
});

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeSqlValue(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (Array.isArray(val)) {
    const formattedArr = val.map(v => {
      if (v === null) return 'NULL';
      if (typeof v === 'string') return `"${v.replace(/"/g, '\\"')}"`;
      return v;
    }).join(',');
    return `'{${formattedArr}}'`;
  }
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function exportDb() {
  const client = await pool.connect();
  const startTime = Date.now();

  try {
    log('Connecting to database...');

    const exportBase = path.join(__dirname, 'exports');
    const csvDir = path.join(exportBase, 'csv');
    if (!fs.existsSync(exportBase)) fs.mkdirSync(exportBase, { recursive: true });
    if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });

    const timestamp = new Date().toISOString();
    let sql = '';

    // HEADER
    sql += `-- ============================================================\n`;
    sql += `-- COMPLETE DATABASE EXPORT\n`;
    sql += `-- Generated on: ${timestamp}\n`;
    sql += `-- ============================================================\n\n`;
    sql += `SET statement_timeout = 0;\nSET lock_timeout = 0;\nSET idle_in_transaction_session_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSELECT pg_catalog.set_config('search_path', 'public', false);\nSET check_function_bodies = false;\nSET xmloption = content;\nSET client_min_messages = warning;\nSET row_security = off;\n\n`;

    // EXTENSIONS
    log('Exporting extensions...');
    try {
      const extRes = await client.query(`SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY extname`);
      if (extRes.rows.length > 0) {
        sql += `-- EXTENSIONS\n`;
        for (const ext of extRes.rows) {
          sql += `CREATE EXTENSION IF NOT EXISTS "${ext.extname}";\n`;
        }
        sql += '\n';
        log(`  Found ${extRes.rows.length} extension(s)`);
      }
    } catch (e) { log(`  Extensions error: ${e.message}`); }

    // SEQUENCES
    log('Exporting sequences...');
    try {
      const seqRes = await client.query(`SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename`);
      if (seqRes.rows.length > 0) {
        sql += `-- SEQUENCES\n`;
        for (const seq of seqRes.rows) {
          sql += `CREATE SEQUENCE IF NOT EXISTS public."${seq.sequencename}" START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;\n`;
          if (seq.last_value) {
            sql += `SELECT setval('public."${seq.sequencename}"', ${seq.last_value}, true);\n`;
          }
        }
        sql += '\n';
        log(`  Found ${seqRes.rows.length} sequence(s)`);
      }
    } catch (e) { log(`  Sequences error: ${e.message}`); }

    // TABLES
    const tablesRes = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    log(`Exporting ${tables.length} tables...`);

    sql += `-- ============================================================\n-- TABLES\n-- ============================================================\n\n`;

    let totalRows = 0;
    const tableSummary = [];

    for (const table of tables) {
      log(`  ${table}...`);

      // Column definitions
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position
      `, [table]);

      // Primary keys
      const pkRes = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `, [table]);
      const pks = pkRes.rows.map(r => r.column_name);

      sql += `-- Table: ${table}\n`;
      sql += `CREATE TABLE IF NOT EXISTS public."${table}" (\n`;

      const colDefs = colRes.rows.map(col => {
        let type = col.data_type;
        if (type === 'ARRAY') type = col.udt_name.startsWith('_') ? col.udt_name.substring(1) + '[]' : col.udt_name + '[]';
        if (type === 'user-defined') type = col.udt_name;
        let def = `    "${col.column_name}" ${type}`;
        if (col.character_maximum_length && !type.includes('[]')) def += `(${col.character_maximum_length})`;
        if (col.is_nullable === 'NO') def += ' NOT NULL';
        if (col.column_default && !col.column_default.startsWith('nextval')) def += ` DEFAULT ${col.column_default}`;
        return def;
      });

      if (pks.length > 0) colDefs.push(`    PRIMARY KEY (${pks.map(k => `"${k}"`).join(', ')})`);
      sql += colDefs.join(',\n') + '\n);\n\n';

      // Foreign keys
      try {
        const fkRes = await client.query(`
          SELECT tc.constraint_name, kcu.column_name,
                 ccu.table_name AS foreign_table, ccu.column_name AS foreign_column,
                 rc.delete_rule, rc.update_rule
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
          JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
          WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
        `, [table]);
        for (const fk of fkRes.rows) {
          sql += `ALTER TABLE public."${table}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES public."${fk.foreign_table}" ("${fk.foreign_column}")`;
          if (fk.delete_rule && fk.delete_rule !== 'NO ACTION') sql += ` ON DELETE ${fk.delete_rule}`;
          if (fk.update_rule && fk.update_rule !== 'NO ACTION') sql += ` ON UPDATE ${fk.update_rule}`;
          sql += ';\n';
        }
        if (fkRes.rows.length > 0) sql += '\n';
      } catch (e) { /* skip */ }

      // Fetch data
      const dataRes = await client.query(`SELECT * FROM public."${table}"`);
      const dataColumns = dataRes.fields.map(f => f.name);
      const rowCount = dataRes.rows.length;
      totalRows += rowCount;

      // CSV export
      const csvHeader = dataColumns.join(',');
      const csvRows = dataRes.rows.map(row => dataColumns.map(col => escapeCSV(row[col])).join(','));
      fs.writeFileSync(path.join(csvDir, `${table}.csv`), [csvHeader, ...csvRows].join('\n'));

      // SQL INSERT
      if (rowCount > 0) {
        sql += `-- Data: ${table} (${rowCount} rows)\n`;
        for (const row of dataRes.rows) {
          const values = dataColumns.map(col => escapeSqlValue(row[col]));
          sql += `INSERT INTO public."${table}" ("${dataColumns.join('", "')}") VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
        }
        sql += '\n';
      }

      tableSummary.push({ table, columns: colRes.rows.length, rows: rowCount });
      log(`    -> ${rowCount} rows, ${colRes.rows.length} columns`);
    }

    // INDEXES
    log('Exporting indexes...');
    sql += `-- ============================================================\n-- INDEXES\n-- ============================================================\n\n`;
    let indexCount = 0;
    for (const table of tables) {
      try {
        const idxRes = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`, [table]);
        for (const idx of idxRes.rows) {
          if (idx.indexname.endsWith('_pkey')) continue;
          sql += `${idx.indexdef};\n`;
          indexCount++;
        }
      } catch (e) { /* skip */ }
    }
    sql += '\n';
    log(`  Found ${indexCount} index(es)`);

    // FUNCTIONS
    log('Exporting functions...');
    try {
      const fnRes = await client.query(`
        SELECT n.nspname AS schema_name, p.proname AS function_name, pg_get_functiondef(p.oid) AS function_def
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname IN ('public', 'auth') AND p.prokind IN ('f', 'p')
        ORDER BY n.nspname, p.proname
      `);
      if (fnRes.rows.length > 0) {
        sql += `-- ============================================================\n-- FUNCTIONS\n-- ============================================================\n\n`;
        for (const fn of fnRes.rows) {
          sql += `-- Function: ${fn.schema_name}.${fn.function_name}\n${fn.function_def};\n\n`;
        }
        log(`  Found ${fnRes.rows.length} function(s)`);
      }
    } catch (e) { log(`  Functions error: ${e.message}`); }

    // TRIGGERS
    log('Exporting triggers...');
    try {
      const trgRes = await client.query(`
        SELECT trigger_name, event_manipulation, event_object_table, action_statement, action_timing, action_orientation
        FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name
      `);
      if (trgRes.rows.length > 0) {
        sql += `-- ============================================================\n-- TRIGGERS\n-- ============================================================\n\n`;
        for (const trg of trgRes.rows) {
          sql += `CREATE TRIGGER "${trg.trigger_name}" ${trg.action_timing} ${trg.event_manipulation} ON public."${trg.event_object_table}" FOR EACH ${trg.action_orientation} ${trg.action_statement};\n\n`;
        }
        log(`  Found ${trgRes.rows.length} trigger(s)`);
      }
    } catch (e) { log(`  Triggers error: ${e.message}`); }

    // VIEWS
    log('Exporting views...');
    try {
      const viewRes = await client.query(`SELECT table_name, view_definition FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name`);
      if (viewRes.rows.length > 0) {
        sql += `-- ============================================================\n-- VIEWS\n-- ============================================================\n\n`;
        for (const view of viewRes.rows) {
          sql += `CREATE OR REPLACE VIEW public."${view.table_name}" AS\n${view.view_definition}\n\n`;
        }
        log(`  Found ${viewRes.rows.length} view(s)`);
      }
    } catch (e) { log(`  Views error: ${e.message}`); }

    // RLS POLICIES
    log('Exporting RLS policies...');
    try {
      const polRes = await client.query(`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`);
      if (polRes.rows.length > 0) {
        sql += `-- ============================================================\n-- ROW LEVEL SECURITY POLICIES\n-- ============================================================\n\n`;
        const rlsTables = [...new Set(polRes.rows.map(p => p.tablename))];
        for (const t of rlsTables) sql += `ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY;\n`;
        sql += '\n';
        for (const pol of polRes.rows) {
          sql += `CREATE POLICY "${pol.policyname}" ON public."${pol.tablename}" AS ${pol.permissive} FOR ${pol.cmd}`;
          if (pol.roles && pol.roles.length > 0) sql += ` TO ${pol.roles.join(', ')}`;
          if (pol.qual) sql += ` USING (${pol.qual})`;
          if (pol.with_check) sql += ` WITH CHECK (${pol.with_check})`;
          sql += ';\n\n';
        }
        log(`  Found ${polRes.rows.length} RLS polic(ies)`);
      }
    } catch (e) { log(`  RLS Policies error: ${e.message}`); }

    // WRITE FILE
    const sqlExportPath = path.join(exportBase, 'database_export.sql');
    fs.writeFileSync(sqlExportPath, sql);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (fs.statSync(sqlExportPath).size / 1024 / 1024).toFixed(2);

    log('\n' + '='.repeat(60));
    log('EXPORT COMPLETED SUCCESSFULLY');
    log('='.repeat(60));
    log(`Time: ${elapsed}s`);
    log(`SQL File: ${sqlExportPath} (${fileSize} MB)`);
    log(`CSV Files: ${csvDir} (${tables.length} files)`);
    log(`Tables: ${tables.length}`);
    log(`Total Rows: ${totalRows.toLocaleString()}`);
    log(`Indexes: ${indexCount}`);
    log('='.repeat(60));

    log('\nTable Summary:');
    log('-'.repeat(50));
    for (const t of tableSummary) log(`  ${t.table.padEnd(35)} ${String(t.columns).padStart(5)} cols  ${String(t.rows).padStart(6)} rows`);
    log('-'.repeat(50));

  } catch (error) {
    log(`\nExport failed: ${error.message}`);
    log(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

exportDb();
