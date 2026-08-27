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
    const exams = await client.query(`SELECT id, title, slug, category_id, description FROM exams ORDER BY id;`);
    console.log('--- EXAMS TABLE ---');
    console.log(JSON.stringify(exams.rows, null, 2));

    const series = await client.query(`SELECT id, title, slug, tags, colour_hex FROM test_series ORDER BY id;`);
    console.log('\n--- TEST_SERIES TABLE ---');
    console.log(JSON.stringify(series.rows, null, 2));

    const subjects = await client.query(`SELECT id, name, slug FROM subjects ORDER BY id;`);
    console.log('\n--- SUBJECTS TABLE ---');
    console.log(JSON.stringify(subjects.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
