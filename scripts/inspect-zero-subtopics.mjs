import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const zeroSubs = await pool.query(`
    SELECT t.id, t.name, t.chapter_id, c.title as chapter_title, s.name as subject_name
    FROM subject_topics t
    LEFT JOIN subject_chapters c ON t.chapter_id = c.id
    LEFT JOIN subjects s ON c.subject_id = s.id
    LEFT JOIN subject_subtopics st ON st.topic_id = t.id
    WHERE st.id IS NULL
    ORDER BY t.id;
  `);
  console.log("Topics with 0 subtopics (17 total):");
  console.table(zeroSubs.rows);
  await pool.end();
}
main().catch(console.error);
