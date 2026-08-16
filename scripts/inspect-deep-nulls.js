import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
const rootEnvPath = path.join(__dirname, "../.env");

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
});

async function inspectDeep() {
  const client = await pool.connect();
  try {
    console.log("=== DEEP INSPECTION OF REMAINING NULL RELATIONS ===\n");

    // 1. Derivations for questions via test_questions -> tests -> test_series / test_sections
    const qDerive = await client.query(`
      SELECT 
        COUNT(DISTINCT q.id) as total_questions_in_tq,
        
        -- Category derivation (from tests.exam_category_id)
        COUNT(DISTINCT CASE WHEN q.category_id IS NULL AND t.exam_category_id IS NOT NULL THEN q.id END) as category_from_tests,
        
        -- Section derivation (from test_questions.section_id)
        COUNT(DISTINCT CASE WHEN q.section_id IS NULL AND tq.section_id IS NOT NULL THEN q.id END) as section_from_tq,
        
        -- Series derivation (from tests.series_id)
        COUNT(DISTINCT CASE WHEN q.series_id IS NULL AND t.series_id IS NOT NULL THEN q.id END) as series_from_tests,
        
        -- Subject derivation (from test_sections.subject_id)
        COUNT(DISTINCT CASE WHEN q.subject_id IS NULL AND sec.subject_id IS NOT NULL THEN q.id END) as subject_from_test_section,

        -- Test derivation (from test_questions.test_id)
        COUNT(DISTINCT CASE WHEN q.test_id IS NULL AND tq.test_id IS NOT NULL THEN q.id END) as test_id_from_tq
      FROM questions q
      JOIN test_questions tq ON q.id = tq.question_id
      LEFT JOIN tests t ON tq.test_id = t.id
      LEFT JOIN test_sections sec ON tq.section_id = sec.id;
    `);

    console.log("📌 Questions Derivations via Test Structure:", qDerive.rows[0]);

    // 2. Test_sections derivations via parent tests
    const secDerive = await client.query(`
      SELECT 
        COUNT(*) as total_test_sections,
        COUNT(*) FILTER (WHERE category_id IS NULL) as null_category_id,
        COUNT(CASE WHEN sec.category_id IS NULL AND t.exam_category_id IS NOT NULL THEN sec.id END) as derivable_category_from_tests,
        COUNT(*) FILTER (WHERE sec.stage_id IS NULL) as null_stage_id,
        COUNT(CASE WHEN sec.stage_id IS NULL AND t.stage_id IS NOT NULL THEN sec.id END) as derivable_stage_from_tests
      FROM test_sections sec
      LEFT JOIN tests t ON sec.test_id = t.id;
    `);

    console.log("📌 Test Sections Derivations via Tests:", secDerive.rows[0]);

    // 3. Tests derivations via test_series
    const testsDerive = await client.query(`
      SELECT 
        COUNT(*) as total_tests,
        COUNT(*) FILTER (WHERE t.exam_category_id IS NULL) as null_exam_category,
        COUNT(CASE WHEN t.exam_category_id IS NULL AND ts.exam_category_id IS NOT NULL THEN t.id END) as derivable_category_from_series,
        COUNT(*) FILTER (WHERE t.stage_id IS NULL) as null_stage,
        COUNT(CASE WHEN t.stage_id IS NULL AND ts.stage_id IS NOT NULL THEN t.id END) as derivable_stage_from_series
      FROM tests t
      LEFT JOIN test_series ts ON t.series_id = ts.id;
    `);

    console.log("📌 Tests Derivations via Test Series:", testsDerive.rows[0]);

    // 4. Sample questions remaining without subject_id
    const sampleQs = await client.query(`
      SELECT 
        q.id, 
        LEFT(q.question_text, 50) as text_snippet, 
        q.topic_id, 
        q.chapter_id, 
        q.subject_id, 
        q.category_id, 
        q.series_id,
        tq.test_id,
        tq.section_id,
        sec.name as section_name,
        sec.subject_id as section_subject_id
      FROM questions q
      LEFT JOIN test_questions tq ON q.id = tq.question_id
      LEFT JOIN test_sections sec ON tq.section_id = sec.id
      WHERE q.subject_id IS NULL
      LIMIT 10;
    `);

    console.log("\n📌 Sample 10 questions without subject_id:", sampleQs.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

inspectDeep().catch(console.error);
