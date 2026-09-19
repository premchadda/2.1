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
  const eng = await pool.query(`
    SELECT id, test_id, subject_id, chapter_id, question_text
    FROM questions
    WHERE subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (
        question_text ILIKE '%active to passive%'
        OR question_text ILIKE '%passive to active%'
        OR question_text ILIKE '%direct speech%'
        OR question_text ILIKE '%indirect speech%'
        OR question_text ILIKE '%antonym of the given word%'
        OR question_text ILIKE '%synonym of the given word%'
        OR question_text ILIKE '%one-word substitution%'
        OR question_text ILIKE '%misspelt word%'
        OR question_text ILIKE '%correctly spelt%'
        OR question_text ILIKE '%cloze test%'
      );
  `);
  console.log("Remaining English in GS:", eng.rows);

  const quant = await pool.query(`
    SELECT id, test_id, subject_id, chapter_id, question_text
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
        OR (question_text ILIKE '%sin%' AND question_text ILIKE '%cos%' AND question_text ILIKE '%tan%')
        OR question_text ILIKE '%hypotenuse%'
        OR question_text ILIKE '%perimeter of a triangle%'
      );
  `);
  console.log("\nRemaining Quant in GS:", quant.rows.length);
  for (const q of quant.rows) {
    console.log(`[ID ${q.id}] Subj ${q.subject_id} / Ch ${q.chapter_id}: ${q.question_text.slice(0, 120)}...`);
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
