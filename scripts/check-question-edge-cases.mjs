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
    // 1. Check the 1 question with <4 options
    const lt4 = await client.query(`
      SELECT q.id, q.test_id, t.title as test_title, q.question_number, q.question_text, q.options, q.correct_option
      FROM questions q
      JOIN tests t ON q.test_id = t.id
      WHERE array_length(q.options, 1) < 4;
    `);
    console.log('Question with < 4 options:', JSON.stringify(lt4.rows, null, 2));

    // 2. Check the 6 questions with >4 options
    const gt4 = await client.query(`
      SELECT q.id, q.test_id, t.title as test_title, q.question_number, array_length(q.options, 1) as opt_count, q.correct_option
      FROM questions q
      JOIN tests t ON q.test_id = t.id
      WHERE array_length(q.options, 1) > 4;
    `);
    console.log('Questions with > 4 options:', JSON.stringify(gt4.rows, null, 2));

    // 3. Check the 5 questions missing English explanation
    const noEngExp = await client.query(`
      SELECT q.id, q.test_id, t.title as test_title, q.question_number
      FROM questions q
      JOIN tests t ON q.test_id = t.id
      WHERE q.explanation IS NULL OR TRIM(q.explanation) = '';
    `);
    console.log('Questions missing English explanation:', JSON.stringify(noEngExp.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
