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
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'questions'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in questions table:');
    cols.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

    // Check if subjects, chapters, topics, subtopics tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('subjects', 'chapters', 'topics', 'subtopics', 'units');
    `);
    console.log('\nTaxonomy tables found:');
    tables.rows.forEach(r => console.log(` - ${r.table_name}`));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
