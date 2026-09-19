import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function cleanText(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  const res = await pool.query(`
    SELECT q.id, q.question_number, q.question_text
    FROM questions q
    WHERE q.chapter_id = 11
    ORDER BY q.id
    LIMIT 25;
  `);

  console.log(`Total questions in Chapter 11 ('Chapter 1: Current Affairs'): ${res.rows.length}`);
  for (const r of res.rows) {
    console.log(`[QID ${r.id}] ${cleanText(r.question_text).slice(0, 90)}`);
  }

  await pool.end();
}
main().catch(console.error);
