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
  const ids = [46347, 46021, 46446, 39122, 3327, 3282];
  const res = await pool.query(`
    SELECT id, test_id, question_number, section, source, imported_from, 
           subject_id, chapter_id, topic_id, subtopic_id, created_at
    FROM questions
    WHERE id = ANY($1::int[])
  `, [ids]);
  console.log("Sample misclassified questions metadata:", res.rows);

  // Check test details for these test_ids
  const testIds = [...new Set(res.rows.map(r => r.test_id).filter(Boolean))];
  console.log("Associated test_ids:", testIds);
  if (testIds.length > 0) {
    const tests = await pool.query(`
      SELECT id, title, exam_id, total_questions, created_at
      FROM tests WHERE id = ANY($1::int[])
    `, [testIds]);
    console.log("Associated tests:", tests.rows);

    // Let's inspect all questions in one of these tests, e.g. test_id of question 3282 or 46347
    const sampleTestId = res.rows[0].test_id;
    if (sampleTestId) {
      const allQInTest = await pool.query(`
        SELECT id, question_number, section, subject_id, chapter_id, topic_id, 
               SUBSTRING(question_text FROM 1 FOR 80) as snippet
        FROM questions
        WHERE test_id = $1
        ORDER BY question_number, id
        LIMIT 30;
      `, [sampleTestId]);
      console.log(`\nQuestions in test_id ${sampleTestId}:`, allQInTest.rows);
    }
  }

  // Also check how many total tests and questions have test_id
  const testDistribution = await pool.query(`
    SELECT count(distinct test_id) as num_tests, count(*) as num_questions
    FROM questions;
  `);
  console.log("Total tests with questions:", testDistribution.rows[0]);

  // How were questions assigned chapter_id and topic_id?
  const chNull = await pool.query(`
    SELECT 
      count(*) as total,
      count(chapter_id) as with_ch,
      count(distinct chapter_id) as dist_ch,
      count(distinct topic_id) as dist_top
    FROM questions;
  `);
  console.log("Chapter/Topic distinct counts:", chNull.rows[0]);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
