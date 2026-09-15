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

async function checkTestsNulls() {
  const client = await pool.connect();
  try {
    const tests = await client.query(`
      SELECT t.id, t.title, t.exam_category_id, t.series_id, t.stage_id, ts.exam_category_id as series_exam_cat_id
      FROM tests t
      LEFT JOIN test_series ts ON t.series_id = ts.id
      WHERE t.exam_category_id IS NULL OR t.series_id IS NULL OR t.stage_id IS NULL;
    `);
    console.log(
      "Tests with NULL exam_category_id / series_id / stage_id:",
      tests.rows,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

checkTestsNulls().catch(console.error);
