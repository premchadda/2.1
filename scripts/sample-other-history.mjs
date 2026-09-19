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
    SELECT q.id, q.question_number, q.section, q.question_text
    FROM questions q
    WHERE q.chapter_id = 12
    ORDER BY q.id
    OFFSET 50
    LIMIT 30;
  `);

  for (const r of res.rows) {
    console.log(`[QID ${r.id}] ${cleanText(r.question_text).slice(0, 100)}`);
  }

  await pool.end();
}
main().catch(console.error);
