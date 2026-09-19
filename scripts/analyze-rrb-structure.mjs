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
  console.log("Analyzing RRB NTPC tests...");

  const rrbTests = await pool.query(`
    SELECT t.id, t.title, count(q.id) as q_cnt,
      count(CASE WHEN q.section = 'General Awareness' THEN 1 END) as ga_cnt,
      count(CASE WHEN q.section = 'Quantitative Aptitude' THEN 1 END) as quant_cnt,
      count(CASE WHEN q.section = 'General Intelligence & Reasoning' THEN 1 END) as gi_cnt,
      count(CASE WHEN q.section NOT IN ('General Awareness', 'Quantitative Aptitude', 'General Intelligence & Reasoning') THEN 1 END) as other_cnt
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    WHERE t.exam_id = 21
    GROUP BY t.id, t.title
    ORDER BY t.id
    LIMIT 20;
  `);
  console.log("RRB Tests section distribution:", rrbTests.rows);

  // Let's inspect Test 360: first 10 questions and their text and current section
  const q360 = await pool.query(`
    SELECT question_number, section, subject_id, SUBSTRING(question_text FROM 1 FOR 90) as snippet
    FROM questions
    WHERE test_id = 360
    ORDER BY question_number
    LIMIT 20;
  `);
  console.log("\nTest 360 first 20 questions:", q360.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
