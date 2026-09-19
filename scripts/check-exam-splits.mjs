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
  const blockTests = await pool.query(`
    SELECT count(*) FROM (
      SELECT test_id
      FROM questions
      GROUP BY test_id
      HAVING count(CASE WHEN section = 'Quantitative Aptitude' THEN 1 END) = 30
         AND count(CASE WHEN section = 'General Awareness' THEN 1 END) = 40
         AND count(CASE WHEN section = 'General Intelligence & Reasoning' THEN 1 END) = 30
    ) sub;
  `);
  console.log("Tests with exact 30 Quant, 40 GA, 30 GI split:", blockTests.rows[0].count);

  const blockQCount = await pool.query(`
    SELECT count(*) FROM questions WHERE test_id IN (
      SELECT test_id
      FROM questions
      GROUP BY test_id
      HAVING count(CASE WHEN section = 'Quantitative Aptitude' THEN 1 END) = 30
         AND count(CASE WHEN section = 'General Awareness' THEN 1 END) = 40
         AND count(CASE WHEN section = 'General Intelligence & Reasoning' THEN 1 END) = 30
    );
  `);
  console.log("Total questions in those 30/40/30 tests:", blockQCount.rows[0].count);

  // Check how many tests in total have exam_id = 21
  const rrbTotal = await pool.query(`
    SELECT count(distinct t.id) as tests, count(q.id) as questions
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    WHERE t.exam_id = 21;
  `);
  console.log("Total RRB NTPC tests & questions:", rrbTotal.rows[0]);

  // Check how many tests in total have exam_id = 1 (SSC CGL)
  const sscTotal = await pool.query(`
    SELECT count(distinct t.id) as tests, count(q.id) as questions
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    WHERE t.exam_id = 1;
  `);
  console.log("Total SSC CGL tests & questions:", sscTotal.rows[0]);

  // Check section breakdown in SSC CGL
  const sscSections = await pool.query(`
    SELECT q.section, count(*) 
    FROM questions q
    JOIN tests t ON q.test_id = t.id
    WHERE t.exam_id = 1
    GROUP BY q.section;
  `);
  console.log("SSC CGL section breakdown:", sscSections.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
