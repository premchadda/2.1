import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

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
  try {
    const dbHelperPath = pathToFileURL(path.join(rootDir, 'apps', 'backend', 'src', 'infrastructure', 'database', 'postgres-helpers.js')).href;
    const { pool } = await import(dbHelperPath);

    const res = await pool.query(`
      SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as count
      FROM tests;
    `);
    console.log('Tests ID stats:', res.rows[0]);

    const seqRes = await pool.query(`
      SELECT last_value FROM tests_id_seq;
    `);
    console.log('Tests ID sequence last_value:', seqRes.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
