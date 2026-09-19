import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== BUILDING COMPREHENSIVE TAXONOMY MAP ===");

  const subjects = await pool.query(`SELECT id, name, slug FROM subjects ORDER BY id;`);
  const chapters = await pool.query(`
    SELECT id, subject_id, title, slug, order_index 
    FROM subject_chapters 
    WHERE (is_deleted IS NOT TRUE) AND is_active = true 
    ORDER BY subject_id, order_index, id;
  `);
  const topics = await pool.query(`
    SELECT id, chapter_id, subject_id, name, slug, order_index 
    FROM subject_topics 
    WHERE (is_deleted IS NOT TRUE) AND is_active = true 
    ORDER BY chapter_id, order_index, id;
  `);
  const subtopics = await pool.query(`
    SELECT id, topic_id, name, slug, order_index 
    FROM subject_subtopics 
    WHERE (is_deleted IS NOT TRUE) AND is_active = true 
    ORDER BY topic_id, order_index, id;
  `);

  console.log(`Loaded: ${subjects.rows.length} subjects, ${chapters.rows.length} chapters, ${topics.rows.length} topics, ${subtopics.rows.length} subtopics.`);

  const taxonomy = {
    subjects: subjects.rows,
    chapters: chapters.rows,
    topics: topics.rows,
    subtopics: subtopics.rows
  };

  fs.writeFileSync(path.join(__dirname, "full-taxonomy.json"), JSON.stringify(taxonomy, null, 2));
  console.log("Saved to scripts/full-taxonomy.json");

  await pool.end();
}

main().catch(console.error);
