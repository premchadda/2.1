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
  const res = await pool.query(`
    SELECT q.id, q.test_id, q.subject_id, q.chapter_id, q.question_text
    FROM questions q
    WHERE q.subject_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
      AND (
        q.question_text ILIKE '%coded as%'
        OR q.question_text ILIKE '%is coded%'
        OR q.question_text ILIKE '%coded by using%'
        OR q.question_text ILIKE '%coded using%'
        OR q.question_text ILIKE '%husband of%'
        OR q.question_text ILIKE '%wife of%'
        OR q.question_text ILIKE '%daughter of%'
        OR q.question_text ILIKE '%son of%'
        OR q.question_text ILIKE '%how%is related to%'
        OR q.question_text ILIKE '%how is%related to%'
        OR q.question_text ILIKE '%pointing to%'
        OR q.question_text ILIKE '%pointing towards%'
        OR q.question_text ILIKE '%seating arrangement%'
        OR q.question_text ILIKE '%sitting around%'
        OR q.question_text ILIKE '%facing north%'
        OR q.question_text ILIKE '%facing south%'
        OR q.question_text ILIKE '%facing the centre%'
        OR q.question_text ILIKE '%venn diagram%'
        OR q.question_text ILIKE '%mirror image%'
        OR q.question_text ILIKE '%water image%'
        OR q.question_text ILIKE '%paper is folded%'
        OR q.question_text ILIKE '%cube%' AND q.question_text ILIKE '%opposite%'
        OR q.question_text ILIKE '%dice%' AND q.question_text ILIKE '%opposite%'
      );
  `);
  console.log(`Found ${res.rows.length} remaining reasoning-like questions in GS.`);
  for (const r of res.rows) {
    console.log(`[ID ${r.id}] (Subject ${r.subject_id} / Ch ${r.chapter_id}): ${r.question_text.slice(0, 100)}...`);
  }
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
