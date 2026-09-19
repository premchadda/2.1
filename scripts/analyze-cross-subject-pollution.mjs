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
  console.log("Analyzing sections in tests...");

  // Check distinct sections across all questions
  const sections = await pool.query(`
    SELECT section, count(*) as count
    FROM questions
    GROUP BY section
    ORDER BY count DESC;
  `);
  console.log("Distinct sections across all questions:", sections.rows);

  // Check how many tests have ALL questions assigned to a single section like 'General Awareness'
  const testSectionDiversity = await pool.query(`
    SELECT 
      test_id,
      count(*) as total_q,
      count(distinct section) as num_sections,
      count(distinct subject_id) as num_subjects,
      string_agg(distinct section, ', ') as sections,
      string_agg(distinct subject_id::text, ', ') as subject_ids
    FROM questions
    GROUP BY test_id
    HAVING count(*) >= 25
    ORDER BY test_id
    LIMIT 30;
  `);
  console.log("Sample test section & subject diversity:", testSectionDiversity.rows.slice(0, 10));

  // Let's check how many questions in the entire database have English patterns, Math patterns, Reasoning patterns
  // but are assigned to GS subject_id (4..13)
  console.log("\nChecking cross-subject anomalies...");

  const englishInGs = await pool.query(`
    SELECT count(*)
    FROM questions
    WHERE subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (
        question_text ILIKE '%active to passive%'
        OR question_text ILIKE '%passive to active%'
        OR question_text ILIKE '%direct speech%'
        OR question_text ILIKE '%indirect speech%'
        OR question_text ILIKE '%antonym of the given word%'
        OR question_text ILIKE '%synonym of the given word%'
        OR question_text ILIKE '%idiom%'
        OR question_text ILIKE '%one-word substitution%'
        OR question_text ILIKE '%misspelt word%'
        OR question_text ILIKE '%correctly spelt%'
        OR question_text ILIKE '%cloze test%'
        OR question_text ILIKE '%fill in the blank with the most appropriate%'
      );
  `);
  console.log("English questions inside GS subjects:", englishInGs.rows[0].count);

  const quantInGs = await pool.query(`
    SELECT count(*)
    FROM questions
    WHERE subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (
        question_text ILIKE '%compound interest%'
        OR question_text ILIKE '%simple interest%'
        OR question_text ILIKE '%cost price%'
        OR question_text ILIKE '%marked price%'
        OR question_text ILIKE '%selling price%'
        OR question_text ILIKE '%pipe%can fill%tank%'
        OR question_text ILIKE '%speed of the boat%'
        OR question_text ILIKE '%train crosses a platform%'
        OR question_text ILIKE '%sin%' AND question_text ILIKE '%cos%' AND question_text ILIKE '%tan%'
        OR question_text ILIKE '%hypotenuse%'
        OR question_text ILIKE '%perimeter of a triangle%'
      );
  `);
  console.log("Quant questions inside GS subjects:", quantInGs.rows[0].count);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
