import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const res = await pool.query(`
    SELECT t.id, t.name, t.slug, t.chapter_id, c.title as chapter_title, c.subject_id, s.name as subject_name,
           COUNT(q.id) as question_count
    FROM subject_topics t
    LEFT JOIN subject_chapters c ON t.chapter_id = c.id
    LEFT JOIN subjects s ON c.subject_id = s.id
    LEFT JOIN questions q ON q.topic_id = t.id
    WHERE t.name ILIKE '%history%' OR t.slug ILIKE '%history%'
    GROUP BY t.id, t.name, t.slug, t.chapter_id, c.title, c.subject_id, s.name
    ORDER BY t.id;
  `);
  console.log("Topics matching 'history':");
  console.table(res.rows);

  const chapters = await pool.query(`
    SELECT c.id, c.title, c.slug, c.subject_id, s.name as subject_name,
           COUNT(q.id) as question_count
    FROM subject_chapters c
    LEFT JOIN subjects s ON c.subject_id = s.id
    LEFT JOIN questions q ON q.chapter_id = c.id
    WHERE c.title ILIKE '%history%' OR c.slug ILIKE '%history%'
    GROUP BY c.id, c.title, c.slug, c.subject_id, s.name
    ORDER BY c.id;
  `);
  console.log("\nChapters matching 'history':");
  console.table(chapters.rows);

  await pool.end();
}

main().catch(console.error);
