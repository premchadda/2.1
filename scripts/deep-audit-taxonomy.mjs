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

async function run() {
  console.log("=== TAXONOMY STRUCTURE ===");
  
  // 1. Check all subjects
  const subjects = await pool.query("SELECT id, name, slug FROM subjects ORDER BY id;");
  console.log("Subjects in 'subjects':", subjects.rows);

  // 2. Check subject_chapters
  const chaptersCount = await pool.query("SELECT count(*) FROM subject_chapters;");
  console.log("Total subject_chapters:", chaptersCount.rows[0].count);
  const sampleChapters = await pool.query(`
    SELECT sc.id, sc.title, sc.subject_id, sc.study_material_id, s.name as subject_name
    FROM subject_chapters sc
    LEFT JOIN subjects s ON sc.subject_id = s.id
    LIMIT 15;
  `);
  console.log("Sample subject_chapters:", sampleChapters.rows);

  // Check study_materials
  try {
    const sm = await pool.query('SELECT id, title, slug FROM study_materials ORDER BY id;');
    console.log('study_materials:', sm.rows);
  } catch (e) {
    console.log('No study_materials table or error:', e.message);
  }

  const smCheck = await pool.query('SELECT count(*), study_material_id, subject_id FROM subject_chapters GROUP BY study_material_id, subject_id ORDER BY count DESC LIMIT 20;');
  console.log('subject_chapters grouping (study_material_id, subject_id):', smCheck.rows);

  // 4. Check questions columns: subject_id, chapter_id, topic_id, subtopic_id, section, test_id
  const qStats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(subject_id) as with_subject_id,
      COUNT(chapter_id) as with_chapter_id,
      COUNT(topic_id) as with_topic_id,
      COUNT(subtopic_id) as with_subtopic_id,
      COUNT(section) as with_section,
      COUNT(test_id) as with_test_id
    FROM questions;
  `);
  console.log("Questions field presence:", qStats.rows[0]);

  // 5. Subject ID distribution in questions
  const subjectDist = await pool.query(`
    SELECT q.subject_id, s.name, count(*) as cnt
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    GROUP BY q.subject_id, s.name
    ORDER BY cnt DESC;
  `);
  console.log("Subject distribution in questions:", subjectDist.rows);

  // (deferred until subject_topics columns are confirmed)

  // 7. Check if there are questions where section says reasoning but subject_id is GS
  const sectionMismatch = await pool.query(`
    SELECT q.id, q.subject_id, s.name as subject_name, q.section, count(*) OVER () as total_mismatch
    FROM questions q
    LEFT JOIN subjects s ON q.subject_id = s.id
    WHERE (LOWER(q.section) LIKE '%reasoning%' OR LOWER(q.section) LIKE '%intelligence%')
      AND q.subject_id NOT IN (1)
    LIMIT 10;
  `);
  console.log("Section says reasoning but subject_id != 1:", sectionMismatch.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
