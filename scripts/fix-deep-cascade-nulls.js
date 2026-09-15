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
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
});

async function runDeepFixes() {
  console.log(
    "================================================================",
  );
  console.log("🛠️ DEEP HIERARCHICAL CASCADE BACKFILL FOR NULL RELATIONS");
  console.log(
    "================================================================\n",
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN;");

    // 1. Backfill questions.category_id from exam_categories.category_id via parent tests
    console.log(
      "--> 1. Backfilling questions.category_id from parent tests.exam_category_id -> exam_categories.category_id...",
    );
    const res1 = await client.query(`
      UPDATE questions q
      SET category_id = ec.category_id
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      JOIN exam_categories ec ON t.exam_category_id = ec.id
      WHERE q.id = tq.question_id
        AND q.category_id IS NULL
        AND ec.category_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${res1.rowCount} questions with category_id.`);

    // 2. Backfill questions.series_id from parent tests.series_id via test_questions
    console.log(
      "--> 2. Backfilling questions.series_id from parent tests.series_id...",
    );
    const res2 = await client.query(`
      UPDATE questions q
      SET series_id = t.series_id
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE q.id = tq.question_id
        AND q.series_id IS NULL
        AND t.series_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${res2.rowCount} questions with series_id.`);

    // 3. Backfill questions.section_id from test_questions.section_id
    console.log(
      "--> 3. Backfilling questions.section_id from test_questions.section_id...",
    );
    const res3 = await client.query(`
      UPDATE questions q
      SET section_id = tq.section_id
      FROM test_questions tq
      WHERE q.id = tq.question_id
        AND q.section_id IS NULL
        AND tq.section_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${res3.rowCount} questions with section_id.`);

    // 4. Backfill questions.subject_id from test_sections.subject_id via test_questions
    console.log(
      "--> 4. Backfilling questions.subject_id from test_sections.subject_id...",
    );
    const res4 = await client.query(`
      UPDATE questions q
      SET subject_id = sec.subject_id
      FROM test_questions tq
      JOIN test_sections sec ON tq.section_id = sec.id
      WHERE q.id = tq.question_id
        AND q.subject_id IS NULL
        AND sec.subject_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${res4.rowCount} questions with subject_id.`);

    // 5. Backfill test_sections.stage_id from parent tests.stage_id
    console.log(
      "--> 5. Backfilling test_sections.stage_id from parent tests.stage_id...",
    );
    const res5 = await client.query(`
      UPDATE test_sections sec
      SET stage_id = t.stage_id
      FROM tests t
      WHERE sec.test_id = t.id
        AND sec.stage_id IS NULL
        AND t.stage_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${res5.rowCount} test_sections with stage_id.`);

    // 6. Backfill attempts.series_id from parent tests.series_id
    console.log(
      "--> 6. Backfilling attempts.series_id from parent tests.series_id...",
    );
    const res6 = await client.query(`
      UPDATE attempts a
      SET series_id = t.series_id
      FROM tests t
      WHERE a.test_id = t.id
        AND a.series_id IS NULL
        AND t.series_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${res6.rowCount} attempts with series_id.`);

    await client.query("COMMIT;");
    console.log("\n🎉 Deep hierarchical cascade fixes committed successfully!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Error in deep cascade fixes:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runDeepFixes().catch(console.error);
