import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../apps/backend/.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const res = await pool.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE indexdef ILIKE '%gin%'");
  console.log("GIN indexes:", res.rows);
  await pool.end();
}

check().catch(console.error);
