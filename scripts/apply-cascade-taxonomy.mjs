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
  console.log('Connecting to PostgreSQL to apply Cascade FK Taxonomy migration...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 0,
    query_timeout: 0
  });

  await client.connect();

  try {
    const sqlPath = path.join(rootDir, 'apps', 'backend', 'src', 'infrastructure', 'database', 'migrations', '129_cascade_taxonomy_foreign_keys.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('--- 1. Executing Migration 129 inside transaction ---');
    await client.query('BEGIN;');
    await client.query(sql);
    await client.query('COMMIT;');
    console.log('Migration 129 executed successfully.');

    console.log('--- 2. Verifying Updated Foreign Key Constraints ---');
    const verifyQuery = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        tc.constraint_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_name IN ('questions', 'subjects', 'subject_units', 'subject_chapters', 'subject_topics', 'subject_subtopics')
        AND kcu.column_name IN ('subject_id', 'unit_id', 'chapter_id', 'topic_id', 'subtopic_id', 'section_id', 'series_id')
      ORDER BY tc.table_name, kcu.column_name;
    `;
    const res = await client.query(verifyQuery);
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('\n=== CASCADE FK SYSTEM INSTALLED AND VERIFIED! ===');
  } catch (err) {
    console.error('Migration failed:', err);
    try { await client.query('ROLLBACK;'); } catch (e) {}
    process.exit(1);
  } finally {
    await client.end();
  }
})();
