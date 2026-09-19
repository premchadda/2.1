import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("=== CHECKING MISCLASSIFICATION IN BOTH EXAMS ===");

  // Let's check sample SSC CGL tests
  const sscTests = await pool.query(`
    SELECT t.id, t.title, count(q.id) as q_cnt, string_agg(distinct q.section, ' | ') as sections
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    WHERE t.exam_id = 1
    GROUP BY t.id, t.title
    LIMIT 10;
  `);
  console.log("SSC tests sample:", sscTests.rows);

  // Check reasoning patterns in SSC CGL where subject_id is GS (4..13)
  const sscReasoningInGs = await pool.query(`
    SELECT count(*)
    FROM questions q
    JOIN tests t ON q.test_id = t.id
    WHERE t.exam_id = 1
      AND q.subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (
        q.question_text ILIKE '%Statements:%Conclusions:%'
        OR q.question_text ILIKE '%coded as%'
        OR q.question_text ILIKE '%code language%'
        OR q.question_text ILIKE '%sitting in a straight line%'
        OR q.question_text ILIKE '%sitting around a circular%'
        OR q.question_text ILIKE '%Pointing to%'
        OR q.question_text ILIKE '%replace the question mark (?) in the following series%'
        OR q.question_text ILIKE '%related to the third%in the same way%'
      );
  `);
  console.log("Reasoning patterns in GS questions of SSC CGL:", sscReasoningInGs.rows[0].count);

  // Check reasoning patterns in RRB NTPC where subject_id is GS (4..13)
  const rrbReasoningInGs = await pool.query(`
    SELECT count(*)
    FROM questions q
    JOIN tests t ON q.test_id = t.id
    WHERE t.exam_id = 21
      AND q.subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (
        q.question_text ILIKE '%Statements:%Conclusions:%'
        OR q.question_text ILIKE '%coded as%'
        OR q.question_text ILIKE '%code language%'
        OR q.question_text ILIKE '%sitting in a straight line%'
        OR q.question_text ILIKE '%sitting around a circular%'
        OR q.question_text ILIKE '%Pointing to%'
        OR q.question_text ILIKE '%replace the question mark (?) in the following series%'
        OR q.question_text ILIKE '%related to the third%in the same way%'
      );
  `);
  console.log("Reasoning patterns in GS questions of RRB NTPC:", rrbReasoningInGs.rows[0].count);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
