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

function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function run() {
  console.log("Checking SSC CGL (exam_id = 1) questions...");

  // Sample check on SSC CGL full tests (e.g. 100 question mock tests)
  const fullSscTests = await pool.query(`
    SELECT t.id, t.title, count(q.id) as q_cnt
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    WHERE t.exam_id = 1
    GROUP BY t.id, t.title
    HAVING count(q.id) = 100
    LIMIT 5;
  `);
  console.log("Sample 100-q SSC CGL tests:", fullSscTests.rows);

  if (fullSscTests.rows.length > 0) {
    const tid = fullSscTests.rows[0].id;
    console.log(`\nInspecting questions in SSC test ${tid}: ${fullSscTests.rows[0].title}`);
    const qInSsc = await pool.query(`
      SELECT question_number, section, subject_id, SUBSTRING(question_text FROM 1 FOR 90) as snippet
      FROM questions
      WHERE test_id = $1
      ORDER BY question_number
      LIMIT 30;
    `, [tid]);
    console.log(qInSsc.rows);
  }

  // Check sectional tests in SSC CGL
  const sectionalSsc = await pool.query(`
    SELECT t.id, t.title, count(q.id) as q_cnt, q.section, q.subject_id
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    WHERE t.exam_id = 1
    GROUP BY t.id, t.title, q.section, q.subject_id
    LIMIT 10;
  `);
  console.log("\nSample sectional SSC tests:", sectionalSsc.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
