import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("Checking question distribution in Test 312 and Test 351:");
  
  const t312 = await pool.query(`
    SELECT q.question_number, q.section, s.name as subj, SUBSTRING(q.question_text FROM 1 FOR 60) as text
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE q.test_id = 312 AND q.question_number IN (1, 15, 30, 31, 50, 70, 71, 85, 100)
    ORDER BY q.question_number;
  `);
  console.log("Test 312 samples:");
  console.table(t312.rows);

  const t351 = await pool.query(`
    SELECT q.question_number, q.section, s.name as subj, SUBSTRING(q.question_text FROM 1 FOR 60) as text
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    WHERE q.test_id = 351 AND q.question_number IN (1, 15, 30, 31, 50, 70, 71, 85, 100)
    ORDER BY q.question_number;
  `);
  console.log("Test 351 samples:");
  console.table(t351.rows);

  await pool.end();
}
main().catch(console.error);
