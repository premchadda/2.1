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
  console.log("=== CHAPTERS & TOPICS PER SUBJECT ===");

  const subjs = await pool.query("SELECT id, name, slug FROM subjects ORDER BY id;");
  for (const s of subjs.rows) {
    const chs = await pool.query(`
      SELECT id, title, order_index
      FROM subject_chapters
      WHERE subject_id = $1 OR (subject_id IS NULL AND study_material_id = $1)
      ORDER BY order_index, id;
    `, [s.id]);
    console.log(`\nSubject ${s.id}: ${s.name} (${chs.rows.length} chapters)`);
    if (chs.rows.length > 0) {
      console.log("  Sample chapters:", chs.rows.slice(0, 8).map(c => `[${c.id}] ${c.title}`).join(" | "));
    }
  }

  // Check subtopics table
  try {
    const subtopCount = await pool.query("SELECT count(*) FROM subtopics;");
    console.log("\nTotal subtopics in 'subtopics' table:", subtopCount.rows[0].count);
    const subtopSample = await pool.query("SELECT * FROM subtopics LIMIT 5;");
    console.log("Sample subtopics:", subtopSample.rows);
  } catch (e) {
    console.log("Subtopics table error:", e.message);
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
