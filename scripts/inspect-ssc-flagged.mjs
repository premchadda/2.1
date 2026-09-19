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
  const q = await pool.query(`
    SELECT q.id, q.test_id, q.section, q.subject_id, SUBSTRING(q.question_text FROM 1 FOR 150) as text
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
  console.log("SSC CGL flagged questions:", q.rows);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
