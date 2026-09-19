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
  console.log("Checking all tests and their section composition...");

  // Tests with >= 50 questions that only have 1 section
  const singleSectionTests = await pool.query(`
    SELECT t.id, t.title, t.total_questions, q.section, count(*) as actual_q
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    GROUP BY t.id, t.title, t.total_questions, q.section
    HAVING count(*) >= 40
    ORDER BY t.id;
  `);
  console.log("Tests with >= 40 questions in a single section:", singleSectionTests.rows.length);
  console.log("Details:", singleSectionTests.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
