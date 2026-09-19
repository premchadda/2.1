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
  console.log("=== ALL CHAPTERS IN TAXONOMY ===");
  const chapters = await pool.query(`
    SELECT sc.id, sc.title, sc.subject_id, s.name as subject_name
    FROM subject_chapters sc
    LEFT JOIN subjects s ON sc.subject_id = s.id
    ORDER BY sc.subject_id, sc.id;
  `);

  const bySubject = {};
  for (const c of chapters.rows) {
    const sName = c.subject_name || `Unknown (${c.subject_id})`;
    if (!bySubject[sName]) bySubject[sName] = [];
    bySubject[sName].push({ id: c.id, title: c.title });
  }

  for (const [sName, chList] of Object.entries(bySubject)) {
    console.log(`\n--- ${sName} (${chList.length} chapters) ---`);
    for (const ch of chList.slice(0, 10)) {
      console.log(`  [${ch.id}] ${ch.title}`);
    }
    if (chList.length > 10) {
      console.log(`  ... and ${chList.length - 10} more`);
    }
  }

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
