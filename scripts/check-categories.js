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

async function checkExamCatSchema() {
  const client = await pool.connect();
  try {
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'exam_categories' AND table_schema = 'public';
    `);
    console.log("exam_categories columns:", cols.rows);

    const rows = await client.query(`SELECT * FROM exam_categories LIMIT 5;`);
    console.log("exam_categories rows:", rows.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkExamCatSchema().catch(console.error);
