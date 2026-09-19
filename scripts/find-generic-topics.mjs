import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const genericChapters = await pool.query(`
    SELECT s.id as subject_id, s.name as subject_name,
           c.id as chapter_id, c.title as chapter_title,
           t.id as topic_id, t.name as topic_name,
           COUNT(q.id) as question_count
    FROM subject_topics t
    JOIN subject_chapters c ON t.chapter_id = c.id
    JOIN subjects s ON c.subject_id = s.id
    LEFT JOIN questions q ON q.topic_id = t.id
    WHERE LOWER(t.name) LIKE '%' || LOWER(s.name) || '%'
       OR LOWER(c.title) LIKE '%' || LOWER(s.name) || '%'
       OR t.name ~* '^(topic [0-9]+: )?(history|geography|polity|economy|physics|chemistry|biology|science|current affairs|static gk)$'
    GROUP BY s.id, s.name, c.id, c.title, t.id, t.name
    ORDER BY s.id, c.id, t.id;
  `);

  console.log("Generic catch-all topics named after subjects:");
  console.table(genericChapters.rows);

  await pool.end();
}

main().catch(console.error);
