import { fileURLToPath, pathToFileURL } from 'url';
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
    // 1. Total counts
    const totalRes = await client.query(`
      SELECT 
        COUNT(*)::int AS total_questions,
        COUNT(CASE WHEN is_active = true THEN 1 END)::int AS active_questions,
        COUNT(CASE WHEN is_active = false THEN 1 END)::int AS inactive_questions,
        COUNT(CASE WHEN test_id IS NOT NULL THEN 1 END)::int AS directly_linked_to_test,
        COUNT(CASE WHEN question_text_hi IS NOT NULL AND TRIM(question_text_hi) != '' THEN 1 END)::int AS with_hindi_text
      FROM questions;
    `);

    // 2. Junction table count
    const tqRes = await client.query(`
      SELECT COUNT(*)::int AS test_questions_junction_count FROM test_questions;
    `);

    // 3. Section/Subject breakdown
    const sectionRes = await client.query(`
      SELECT 
        COALESCE(NULLIF(TRIM(section), ''), 'Unassigned') as section_name,
        COUNT(*)::int as count
      FROM questions
      WHERE is_active = true
      GROUP BY section_name
      ORDER BY count DESC;
    `);

    // 4. Difficulty breakdown
    const diffRes = await client.query(`
      SELECT 
        COALESCE(NULLIF(TRIM(difficulty), ''), 'Unspecified') as difficulty_level,
        COUNT(*)::int as count
      FROM questions
      WHERE is_active = true
      GROUP BY difficulty_level
      ORDER BY count DESC;
    `);

    console.log(JSON.stringify({
      totals: totalRes.rows[0],
      junction_count: tqRes.rows[0].test_questions_junction_count,
      by_section: sectionRes.rows,
      by_difficulty: diffRes.rows
    }, null, 2));

  } catch (err) {
    console.error('Error querying questions:', err);
  } finally {
    await client.end();
  }
})();
