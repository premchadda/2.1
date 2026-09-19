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
  const testId = 399;
  const res = await pool.query(`
    SELECT id, question_number, section, subject_id, chapter_id, topic_id,
           question_text, options
    FROM questions
    WHERE test_id = $1
    ORDER BY question_number;
  `, [testId]);

  console.log(`=== FULL AUDIT OF TEST ${testId} (${res.rows.length} questions) ===\n`);

  for (const q of res.rows) {
    const text = cleanText(q.question_text);
    console.log(`Q${q.question_number} [id: ${q.id}] Current Section: "${q.section}" | Subject: ${q.subject_id} | Ch: ${q.chapter_id}`);
    console.log(`  Text: ${text.slice(0, 120)}...`);
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
