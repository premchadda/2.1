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

async function runPass3Fixes() {
  console.log(
    "================================================================",
  );
  console.log("🛠️ FINAL PASS: RESOLVING TEST & QUESTION CATEGORY NULLS");
  console.log(
    "================================================================\n",
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN;");

    // 1. Backfill test_series.exam_category_id from title/slug
    console.log("--> 1. Backfilling test_series.exam_category_id...");
    const resTs1 = await client.query(`
      UPDATE test_series 
      SET exam_category_id = 1 
      WHERE exam_category_id IS NULL AND (title ILIKE '%ssc%' OR title ILIKE '%cgl%' OR slug ILIKE '%ssc%');
    `);
    const resTs2 = await client.query(`
      UPDATE test_series 
      SET exam_category_id = 2 
      WHERE exam_category_id IS NULL AND (title ILIKE '%rrb%' OR title ILIKE '%ntpc%' OR title ILIKE '%railway%' OR slug ILIKE '%rrb%');
    `);
    console.log(
      `    ✅ Updated test_series: ${resTs1.rowCount} SSC, ${resTs2.rowCount} Railway.`,
    );

    // 2. Backfill tests.exam_category_id from test_series or title keywords
    console.log("--> 2. Backfilling tests.exam_category_id...");
    const resT1 = await client.query(`
      UPDATE tests t
      SET exam_category_id = ts.exam_category_id
      FROM test_series ts
      WHERE t.series_id = ts.id
        AND t.exam_category_id IS NULL
        AND ts.exam_category_id IS NOT NULL;
    `);
    const resT2 = await client.query(`
      UPDATE tests
      SET exam_category_id = 1
      WHERE exam_category_id IS NULL AND (title ILIKE '%ssc%' OR title ILIKE '%cgl%' OR slug ILIKE '%cgl%');
    `);
    const resT3 = await client.query(`
      UPDATE tests
      SET exam_category_id = 2
      WHERE exam_category_id IS NULL AND (title ILIKE '%rrb%' OR title ILIKE '%ntpc%' OR title ILIKE '%railway%');
    `);
    console.log(
      `    ✅ Updated tests.exam_category_id: ${resT1.rowCount} from series, ${resT2.rowCount} SSC, ${resT3.rowCount} Railway.`,
    );

    // 3. Cascade exam_category_id to test_sections.category_id
    console.log(
      "--> 3. Cascading exam_category_id to test_sections.category_id...",
    );
    const resSec = await client.query(`
      UPDATE test_sections sec
      SET category_id = t.exam_category_id
      FROM tests t
      WHERE sec.test_id = t.id
        AND sec.category_id IS NULL
        AND t.exam_category_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${resSec.rowCount} test_sections.category_id.`);

    // 4. Cascade exam_category_id to questions.category_id via test_questions -> tests -> exam_categories
    console.log("--> 4. Cascading category_id to questions...");
    const resQCat = await client.query(`
      UPDATE questions q
      SET category_id = ec.category_id
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      JOIN exam_categories ec ON t.exam_category_id = ec.id
      WHERE q.id = tq.question_id
        AND q.category_id IS NULL
        AND ec.category_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${resQCat.rowCount} questions.category_id.`);

    // 5. Cascade series_id to questions.series_id via test_questions -> tests
    console.log("--> 5. Cascading series_id to questions...");
    const resQSer = await client.query(`
      UPDATE questions q
      SET series_id = t.series_id
      FROM test_questions tq
      JOIN tests t ON tq.test_id = t.id
      WHERE q.id = tq.question_id
        AND q.series_id IS NULL
        AND t.series_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${resQSer.rowCount} questions.series_id.`);

    await client.query("COMMIT;");
    console.log("\n🎉 Final Pass committed successfully!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Error in final pass fixes:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPass3Fixes().catch(console.error);
