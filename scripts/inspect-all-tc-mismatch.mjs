import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const r = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, 
           q.subject_id, s.name as subj_name,
           q.chapter_id, qc.title as q_chap, 
           q.topic_id, t.name as q_top, 
           t.chapter_id as top_chap_id, tc.title as top_chap,
           SUBSTRING(q.question_text FROM 1 FOR 80) as snippet
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    JOIN subject_chapters qc ON q.chapter_id = qc.id
    JOIN subject_topics t ON q.topic_id = t.id
    JOIN subject_chapters tc ON t.chapter_id = tc.id
    WHERE q.chapter_id != t.chapter_id
    LIMIT 20;
  `);
  console.table(r.rows);
  await pool.end();
}
main().catch(console.error);
