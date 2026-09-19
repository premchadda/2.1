import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sections = await pool.query(`
    SELECT COALESCE(NULLIF(TRIM(section), ''), '(blank)') AS section, COUNT(*)::int AS count
    FROM questions
    GROUP BY 1 ORDER BY count DESC LIMIT 40;
  `);
  console.log("=== SECTION DISTRIBUTION ===");
  console.table(sections.rows);

  const cross = await pool.query(`
    SELECT COALESCE(NULLIF(TRIM(section), ''), '(blank)') AS section,
           q.subject_id, s.name AS subject, COUNT(*)::int AS count
    FROM questions q
    LEFT JOIN subjects s ON s.id = q.subject_id
    GROUP BY 1, 2, 3 ORDER BY count DESC LIMIT 60;
  `);
  console.log("=== SECTION x SUBJECT (top 60) ===");
  console.table(cross.rows);

  const nulls = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE chapter_id IS NULL)::int AS null_chap,
           COUNT(*) FILTER (WHERE topic_id IS NULL)::int AS null_top,
           COUNT(*) FILTER (WHERE subtopic_id IS NULL)::int AS null_subtop,
           COUNT(*) FILTER (WHERE topic_id IS NOT NULL AND subtopic_id IS NOT NULL)::int AS full_link
    FROM questions;
  `);
  console.log("=== LINK COMPLETENESS ===", nulls.rows[0]);

  const subjMismatch = await pool.query(`
    SELECT q.subject_id, s.name AS current_subject, c.subject_id AS chapter_subject,
           cs.name AS chapter_owner, COUNT(*)::int AS count
    FROM questions q
    JOIN subject_chapters c ON c.id = q.chapter_id
    LEFT JOIN subjects s ON s.id = q.subject_id
    LEFT JOIN subjects cs ON cs.id = c.subject_id
    WHERE q.subject_id IS DISTINCT FROM c.subject_id
    GROUP BY 1,2,3,4 ORDER BY count DESC;
  `);
  console.log("=== SUBJECT vs CHAPTER-OWNER MISMATCH ===");
  console.table(subjMismatch.rows);

  const generic = await pool.query(`
    SELECT q.subject_id, s.name AS subject, q.chapter_id, c.title AS chapter,
           q.topic_id, t.name AS topic, COUNT(*)::int AS count
    FROM questions q
    JOIN subject_chapters c ON c.id = q.chapter_id
    LEFT JOIN subject_topics t ON t.id = q.topic_id
    LEFT JOIN subjects s ON s.id = q.subject_id
    GROUP BY 1,2,3,4,5,6
    HAVING COUNT(*) > 300
    ORDER BY count DESC LIMIT 40;
  `);
  console.log("=== HEAVY (DUMP) BUCKETS > 300 QUESTIONS ===");
  console.table(generic.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});