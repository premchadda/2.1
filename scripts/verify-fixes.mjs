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
  console.log("=== VERIFYING FIXES ON TEST 312 & TEST 399 ===");

  const res312 = await pool.query(`
    SELECT q.id, q.question_number, q.section, q.subject_id, s.name as subject_name, sc.title as chapter_title,
           SUBSTRING(q.question_text FROM 1 FOR 60) as snippet
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    LEFT JOIN subject_chapters sc ON q.chapter_id = sc.id
    WHERE q.test_id = 312 AND q.question_number IN (1, 2, 3, 17, 20, 21, 27, 28, 35, 53, 60)
    ORDER BY q.question_number;
  `);

  console.log("\nTest 312 Sample Questions After Fix:");
  console.table(res312.rows.map(r => ({
    Q: r.question_number,
    SubjId: r.subject_id,
    Subject: r.subject_name,
    Chapter: r.chapter_title,
    Section: r.section,
    Snippet: r.snippet.replace(/<[^>]*>/g, '').slice(0, 45)
  })));

  const res399 = await pool.query(`
    SELECT q.id, q.question_number, q.section, q.subject_id, s.name as subject_name, sc.title as chapter_title,
           SUBSTRING(q.question_text FROM 1 FOR 60) as snippet
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    LEFT JOIN subject_chapters sc ON q.chapter_id = sc.id
    WHERE q.test_id = 399 AND q.question_number IN (62, 63, 64, 65, 68, 72, 74, 76, 78, 79, 84, 85, 86, 87, 88, 90, 94, 98, 100)
    ORDER BY q.question_number;
  `);

  console.log("\nTest 399 Sample Questions After Fix:");
  console.table(res399.rows.map(r => ({
    Q: r.question_number,
    SubjId: r.subject_id,
    Subject: r.subject_name,
    Chapter: r.chapter_title,
    Section: r.section,
    Snippet: r.snippet.replace(/<[^>]*>/g, '').slice(0, 45)
  })));

  // Final count of subjects across questions
  const finalSubjCounts = await pool.query(`
    SELECT s.name as subject, count(*) as count
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    GROUP BY s.name
    ORDER BY count DESC;
  `);
  console.log("\nFinal Question Distribution Across Subjects:");
  console.table(finalSubjCounts.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
