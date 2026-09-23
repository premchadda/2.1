import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const subjectCounts = await pool.query(`
    SELECT 
      s.id AS subject_id, 
      s.name AS subject_name, 
      COUNT(q.id)::int AS real_question_count,
      ROUND((COUNT(q.id)::decimal / (SELECT COUNT(*) FROM questions) * 100), 2) AS percentage
    FROM subjects s
    LEFT JOIN questions q ON q.subject_id = s.id
    GROUP BY s.id, s.name
    ORDER BY real_question_count DESC
  `);

  const nullSubj = await pool.query(`
    SELECT COUNT(*)::int AS null_count FROM questions WHERE subject_id IS NULL
  `);

  const total = await pool.query(`
    SELECT COUNT(*)::int AS total FROM questions
  `);

  console.log('=== REAL QUESTIONS PER SUBJECT IN LIVE DATABASE (BEFORE ANY CHANGE) ===');
  console.table(subjectCounts.rows);
  console.log('Questions with NULL subject_id:', nullSubj.rows[0].null_count);
  console.log('Total Questions in DB:', total.rows[0].total);

  await pool.end();
}

main();
