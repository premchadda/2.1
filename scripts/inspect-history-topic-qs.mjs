import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function cleanText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const res = await pool.query(`
    SELECT q.id, q.question_number, t.name as topic_name, q.question_text
    FROM questions q
    JOIN subject_topics t ON q.topic_id = t.id
    WHERE q.chapter_id = 12
    LIMIT 20;
  `);

  console.log(`Sample questions in Chapter 12 / Topic 19 ('Topic 1: History'):`);
  for (const r of res.rows) {
    console.log(`[QID ${r.id}] (${r.topic_name}): ${cleanText(r.question_text).slice(0, 90)}`);
  }

  await pool.end();
}
main().catch(console.error);
