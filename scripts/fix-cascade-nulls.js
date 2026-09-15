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

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL environment variable is not defined.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false },
});

async function runFixes() {
  console.log(
    "================================================================",
  );
  console.log("🛠️ TRSTPREP DATABASE CASCADE & RELATIVE NULL FIXES (PASS 2)");
  console.log(
    "================================================================\n",
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN;");

    // Recursive backfill for subject_topics hierarchy
    console.log(
      "--> 1. Recursively backfilling subject_topics.chapter_id from parent_topic_id...",
    );
    let updatedTopics = 0;
    let iterations = 0;
    while (iterations < 5) {
      iterations++;
      const res = await client.query(`
        UPDATE subject_topics st
        SET chapter_id = pt.chapter_id
        FROM subject_topics pt
        WHERE st.parent_topic_id = pt.id
          AND st.chapter_id IS NULL 
          AND pt.chapter_id IS NOT NULL;
      `);
      if (res.rowCount === 0) break;
      updatedTopics += res.rowCount;
    }
    console.log(
      `    ✅ Updated ${updatedTopics} additional rows in subject_topics.`,
    );

    // Backfill questions whose topic got a chapter_id in pass 2
    console.log(
      "--> 2. Backfilling remaining questions.chapter_id and subject_id from updated topics...",
    );
    const resQ1 = await client.query(`
      UPDATE questions q
      SET chapter_id = st.chapter_id
      FROM subject_topics st
      WHERE q.topic_id = st.id
        AND q.chapter_id IS NULL 
        AND st.chapter_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${resQ1.rowCount} questions with chapter_id.`);

    const resQ2 = await client.query(`
      UPDATE questions q
      SET subject_id = sc.subject_id
      FROM subject_chapters sc
      WHERE q.chapter_id = sc.id
        AND q.subject_id IS NULL 
        AND sc.subject_id IS NOT NULL;
    `);
    console.log(`    ✅ Updated ${resQ2.rowCount} questions with subject_id.`);

    await client.query("COMMIT;");
    console.log("\n🎉 Pass 2 complete!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Error applying pass 2 fixes:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runFixes().catch((err) => {
  console.error("Fatal error running pass 2 fixes:", err);
  process.exit(1);
});
