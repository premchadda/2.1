import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== TOP 20 HEAVIEST CHAPTERS ACROSS ALL SUBJECTS ===");

  const heavy = await pool.query(`
    SELECT s.name as subject_name, sc.id as chapter_id, sc.title as chapter_title, COUNT(q.id) as question_count
    FROM questions q
    JOIN subject_chapters sc ON q.chapter_id = sc.id
    JOIN subjects s ON q.subject_id = s.id
    GROUP BY s.name, sc.id, sc.title
    ORDER BY question_count DESC
    LIMIT 25;
  `);

  console.table(heavy.rows);
  await pool.end();
}
main().catch(console.error);
