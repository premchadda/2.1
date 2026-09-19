import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== CHECKING DUMP BUCKETS IN GS & ENGLISH ===");

  // Check Gandhian Era (Chapter 63)
  const gEra = await pool.query(`
    SELECT q.id, q.question_text
    FROM questions q
    WHERE q.chapter_id = 63
    LIMIT 10;
  `);
  console.log(`Questions in Chapter 63 (Gandhian Era):`);
  for (const r of gEra.rows) {
    console.log(`- ${r.question_text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 100)}`);
  }

  // Check Preamble (Chapter 69)
  const prem = await pool.query(`
    SELECT count(*) as cnt FROM questions WHERE chapter_id = 69;
  `);
  console.log(`\nQuestions in Chapter 69 (Preamble): ${prem.rows[0].cnt}`);
  const premSample = await pool.query(`
    SELECT q.id, q.question_text
    FROM questions q
    WHERE q.chapter_id = 69
    LIMIT 5;
  `);
  for (const r of premSample.rows) {
    console.log(`- ${r.question_text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 100)}`);
  }

  await pool.end();
}
main().catch(console.error);
