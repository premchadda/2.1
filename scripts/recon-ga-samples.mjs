import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../apps/backend/.env") });

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
  const subIds = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const out = {};
  for (const sid of subIds) {
    const res = await pool.query(
      `SELECT q.id, q.question_number, q.chapter_id, c.title AS chapter,
              q.topic_id, t.name AS topic, q.subtopic_id, st.name AS subtopic,
              q.question_text, q.options, q.explanation
       FROM questions q
       LEFT JOIN subject_chapters c ON c.id = q.chapter_id
       LEFT JOIN subject_topics t ON t.id = q.topic_id
       LEFT JOIN subject_subtopics st ON st.id = q.subtopic_id
       WHERE q.subject_id = $1 AND q.section = 'General Awareness'
       ORDER BY random() LIMIT 40;`,
      [sid]
    );
    out[sid] = res.rows.map((r) => ({
      id: r.id,
      chapter: r.chapter,
      topic: r.topic,
      subtopic: r.subtopic,
      text: cleanText(r.question_text).slice(0, 260),
      explanation: cleanText(r.explanation).slice(0, 160),
    }));
  }
  const dest = path.join(__dirname, "recon-ga-samples.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 1));
  console.log("Wrote", dest);
  for (const sid of subIds) console.log(`subject ${sid}: ${out[sid].length} samples`);
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});