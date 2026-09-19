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
  console.log("Connected to DB...");

  // 1. Tables check
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('questions', 'subjects', 'chapters', 'topics', 'subtopics', 'subject_topics', 'exams')
    ORDER BY table_name;
  `);
  console.log("Existing taxonomy tables:", tables.rows.map((r) => r.table_name));

  // 2. Questions columns
  const cols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'questions'
    ORDER BY ordinal_position;
  `);
  console.log("Questions columns:", cols.rows.map((r) => `${r.column_name} (${r.data_type})`).join(", "));

  // 3. Questions count
  const countRes = await pool.query("SELECT COUNT(*) FROM questions;");
  console.log("Total questions in questions table:", countRes.rows[0].count);

  // 4. Distribution by subject / topic columns in questions
  const hasSubjectId = cols.rows.some((c) => c.column_name === "subject_id");
  const hasSubject = cols.rows.some((c) => c.column_name === "subject");
  const hasChapterId = cols.rows.some((c) => c.column_name === "chapter_id");
  const hasChapter = cols.rows.some((c) => c.column_name === "chapter");
  const hasTopicId = cols.rows.some((c) => c.column_name === "topic_id");
  const hasTopic = cols.rows.some((c) => c.column_name === "topic");
  const hasSubtopicId = cols.rows.some((c) => c.column_name === "subtopic_id");
  const hasSubtopic = cols.rows.some((c) => c.column_name === "subtopic");

  console.log("Taxonomy columns present:", {
    hasSubjectId, hasSubject,
    hasChapterId, hasChapter,
    hasTopicId, hasTopic,
    hasSubtopicId, hasSubtopic,
  });

  // 5. Distinct subjects
  if (hasSubjectId || hasSubject) {
    const subjRes = await pool.query(`
      SELECT 
        ${hasSubject ? "subject," : ""} 
        ${hasSubjectId ? "subject_id," : ""} 
        COUNT(*) as q_count 
      FROM questions 
      GROUP BY ${[hasSubject ? "subject" : null, hasSubjectId ? "subject_id" : null].filter(Boolean).join(", ")}
      ORDER BY q_count DESC
      LIMIT 30;
    `);
    console.log("Top subjects in questions:", subjRes.rows);
  }

  // 6. Check subjects table
  const subjTable = await pool.query(`
    SELECT id, name, slug FROM subjects LIMIT 30;
  `);
  console.log("Subjects table sample:", subjTable.rows);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
