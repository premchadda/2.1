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
    const checkOrphans = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM questions q LEFT JOIN subjects s ON q.subject_id = s.id WHERE q.subject_id IS NOT NULL AND s.id IS NULL) as orphan_subjects,
        (SELECT COUNT(*) FROM questions q LEFT JOIN subject_chapters c ON q.chapter_id = c.id WHERE q.chapter_id IS NOT NULL AND c.id IS NULL) as orphan_chapters,
        (SELECT COUNT(*) FROM questions q LEFT JOIN subject_topics t ON q.topic_id = t.id WHERE q.topic_id IS NOT NULL AND t.id IS NULL) as orphan_topics,
        (SELECT COUNT(*) FROM questions q LEFT JOIN subject_subtopics st ON q.subtopic_id = st.id WHERE q.subtopic_id IS NOT NULL AND st.id IS NULL) as orphan_subtopics,
        -- Taxonomy internal hierarchy integrity
        (SELECT COUNT(*) FROM subject_units u LEFT JOIN subjects s ON u.subject_id = s.id WHERE u.subject_id IS NOT NULL AND s.id IS NULL) as orphan_units_to_subjects,
        (SELECT COUNT(*) FROM subject_chapters c LEFT JOIN subject_units u ON c.unit_id = u.id WHERE c.unit_id IS NOT NULL AND u.id IS NULL) as orphan_chapters_to_units,
        (SELECT COUNT(*) FROM subject_topics t LEFT JOIN subject_chapters c ON t.chapter_id = c.id WHERE t.chapter_id IS NOT NULL AND c.id IS NULL) as orphan_topics_to_chapters,
        (SELECT COUNT(*) FROM subject_subtopics st LEFT JOIN subject_topics t ON st.topic_id = t.id WHERE st.topic_id IS NOT NULL AND t.id IS NULL) as orphan_subtopics_to_topics;
    `);

    console.log('Taxonomy Orphan Check:');
    console.log(JSON.stringify(checkOrphans.rows[0], null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
