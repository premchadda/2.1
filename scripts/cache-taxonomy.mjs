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
  // Fetch all chapters
  const chaptersRes = await pool.query(`
    SELECT sc.id, sc.title, sc.subject_id, sc.slug
    FROM subject_chapters sc
    WHERE sc.is_active = true OR sc.is_active IS NULL
    ORDER BY sc.subject_id, sc.id;
  `);

  // Fetch all topics
  const topicsRes = await pool.query(`
    SELECT st.id, st.name, st.chapter_id, st.subject_id, st.parent_topic_id, st.slug
    FROM subject_topics st
    WHERE st.is_active = true OR st.is_active IS NULL
    ORDER BY st.chapter_id, st.id;
  `);

  const taxonomy = {
    chapters: chaptersRes.rows,
    topics: topicsRes.rows,
  };

  fs.writeFileSync(
    path.join(__dirname, "taxonomy-cache.json"),
    JSON.stringify(taxonomy, null, 2)
  );

  console.log(`Saved ${chaptersRes.rows.length} chapters and ${topicsRes.rows.length} topics to scripts/taxonomy-cache.json`);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
