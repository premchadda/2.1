import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("Inspecting the 95 Surds/Median questions:");
  const r1 = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.question_text
    FROM questions q
    JOIN subject_topics t ON q.topic_id = t.id
    WHERE q.chapter_id = 283 AND t.chapter_id = 553
    LIMIT 3;
  `);
  for (const q of r1.rows) {
    console.log(`QID ${q.id} (Test ${q.test_id} #${q.question_number}): ${q.question_text.replace(/<[^>]*>/g, ' ').slice(0, 100)}`);
  }

  console.log("\nInspecting the 26 Embedded Figures / Number Series questions:");
  const r2 = await pool.query(`
    SELECT q.id, q.test_id, q.question_number, q.question_text
    FROM questions q
    JOIN subject_topics t ON q.topic_id = t.id
    WHERE q.chapter_id = 585 AND t.chapter_id = 76
    LIMIT 3;
  `);
  for (const q of r2.rows) {
    console.log(`QID ${q.id} (Test ${q.test_id} #${q.question_number}): ${q.question_text.replace(/<[^>]*>/g, ' ').slice(0, 100)}`);
  }

  await pool.end();
}
main().catch(console.error);
