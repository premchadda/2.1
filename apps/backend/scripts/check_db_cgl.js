import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const client = await pool.connect();
  try {
    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'exams'",
    );
    console.log(
      "Exams columns:",
      cols.rows.map((r) => r.column_name),
    );
    const res = await client.query("SELECT * FROM exams LIMIT 3");
    console.log("Exams sample:", res.rows);
    const testCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'tests'",
    );
    console.log(
      "Tests columns:",
      testCols.rows.map((r) => r.column_name),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch((e) => {
  console.error("Connection check error:", e);
  process.exit(1);
});
