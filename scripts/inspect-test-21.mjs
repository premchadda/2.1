import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const res = await pool.query(`
    SELECT q.question_number, q.section, qs.name as subj_name, qc.title as chap_title,
           SUBSTRING(q.question_text FROM 1 FOR 80) as snippet
    FROM questions q
    LEFT JOIN subjects qs ON q.subject_id = qs.id
    LEFT JOIN subject_chapters qc ON q.chapter_id = qc.id
    WHERE q.test_id = 21
    ORDER BY q.question_number;
  `);
  console.table(res.rows);
  await pool.end();
}
main().catch(console.error);
