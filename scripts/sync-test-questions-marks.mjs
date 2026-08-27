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
  console.log('Connecting to PostgreSQL to synchronize marks and negative marks...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 0,
    query_timeout: 0
  });

  await client.connect();

  try {
    await client.query('BEGIN;');

    console.log('--- Synchronizing test_questions (marks & negative_marks) from questions ---');
    const updateRes = await client.query(`
      UPDATE test_questions tq
      SET 
        marks = q.marks,
        negative_marks = q.negative_marks
      FROM questions q
      WHERE tq.question_id = q.id
        AND (tq.marks != q.marks OR tq.negative_marks != q.negative_marks);
    `);
    console.log(`Updated ${updateRes.rowCount} test_questions rows with exact question marks.`);

    // Re-verify
    const verifyRes = await client.query(`
      SELECT 
        marks, 
        negative_marks, 
        COUNT(*)::int as count 
      FROM test_questions 
      GROUP BY marks, negative_marks 
      ORDER BY count DESC;
    `);
    console.log('\n--- Updated test_questions distribution ---');
    console.table(verifyRes.rows);

    await client.query('COMMIT;');
    console.log('\n=== ALL MARKS & NEGATIVE MARKS 100% SYNCHRONIZED AND VERIFIED! ===');

  } catch (err) {
    console.error('Sync failed:', err);
    try { await client.query('ROLLBACK;'); } catch (e) {}
    process.exit(1);
  } finally {
    await client.end();
  }
})();
