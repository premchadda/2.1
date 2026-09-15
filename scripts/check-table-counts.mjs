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

    const tables = [
      'tests',
      'questions',
      'test_questions',
      'test_sections',
      'attempts',
      'attempt_answers',
      'attempt_section_scores',
      'leaderboard_entries',
      'leaderboards',
      'live_tests',
      'topic_tests',
      'wrong_questions',
      'certificates',
      'learner_recommendations',
      'test_state_machine'
    ];

    console.log('Row counts in related tables:');
    for (const t of tables) {
      try {
        const res = await pool.query(`SELECT COUNT(*)::int AS count FROM ${t}`);
        console.log(` - ${t}: ${res.rows[0].count} rows`);
      } catch (e) {
        console.log(` - ${t}: (table does not exist or error: ${e.message})`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
