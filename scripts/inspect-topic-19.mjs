import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const r1 = await pool.query(`SELECT COUNT(*) FROM questions WHERE topic_id = 19;`);
  console.log("Questions in Topic 19 ('Topic 1: History'):", r1.rows[0].count);

  const r2 = await pool.query(`SELECT COUNT(*) FROM questions WHERE chapter_id = 12;`);
  console.log("Questions in Chapter 12 ('Chapter 11: History'):", r2.rows[0].count);

  const r3 = await pool.query(`SELECT id, name, slug FROM subject_topics WHERE id = 19;`);
  console.log("Topic 19 details:", r3.rows[0]);

  const r4 = await pool.query(`SELECT id, title, slug FROM subject_chapters WHERE id = 12;`);
  console.log("Chapter 12 details:", r4.rows[0]);

  await pool.end();
}

main().catch(console.error);
