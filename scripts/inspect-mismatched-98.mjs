import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const res = await pool.query(`
    SELECT q.id, q.chapter_id, qc.title as q_chap, q.topic_id, t.name as q_top, t.chapter_id as top_real_chap, tc.title as top_real_chap_title,
           q.subtopic_id, st.name as subtop_name, st.topic_id as subtop_real_top
    FROM questions q
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    JOIN subject_topics t ON q.topic_id = t.id
    JOIN subject_chapters tc ON t.chapter_id = tc.id
    LEFT JOIN subject_subtopics st ON q.subtopic_id = st.id
    WHERE q.chapter_id != t.chapter_id
    LIMIT 20;
  `);

  console.log(`Topic-Chapter mismatch sample:`);
  console.table(res.rows);

  await pool.end();
}

main().catch(console.error);
