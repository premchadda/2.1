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
  const ids = [37322, 37329, 37344]; // Q65, Q72, Q87 of test 399
  const res = await pool.query(`
    SELECT id, question_text FROM questions WHERE id = ANY($1::int[]);
  `, [ids]);
  for (const r of res.rows) {
    console.log(`[ID ${r.id}]:`, r.question_text);
  }
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
