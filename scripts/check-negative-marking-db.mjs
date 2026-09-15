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
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log('--- 1. QUESTIONS TABLE: MARKS & NEGATIVE MARKS DISTRIBUTION ---');
    const qMarks = await client.query(`
      SELECT 
        marks, 
        negative_marks, 
        COUNT(*)::int as count 
      FROM questions 
      GROUP BY marks, negative_marks 
      ORDER BY count DESC;
    `);
    console.table(qMarks.rows);

    console.log('\n--- 2. TEST_QUESTIONS TABLE: NEGATIVE MARKS DISTRIBUTION ---');
    const tqMarks = await client.query(`
      SELECT 
        marks, 
        negative_marks, 
        COUNT(*)::int as count 
      FROM test_questions 
      GROUP BY marks, negative_marks 
      ORDER BY count DESC;
    `);
    console.table(tqMarks.rows);

    console.log('\n--- 3. NEGATIVE MARKS BY EXAM CATEGORY / SECTION ---');
    const secMarks = await client.query(`
      SELECT 
        section,
        marks,
        negative_marks,
        COUNT(*)::int as count
      FROM questions
      GROUP BY section, marks, negative_marks
      ORDER BY section, count DESC;
    `);
    console.table(secMarks.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
