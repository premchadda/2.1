require('dotenv').config({path: './apps/backend/.env'});
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const totalRes = await pool.query("SELECT count(*) FROM tests");
    console.log("Total tests in DB:", totalRes.rows[0].count);

    const rrbRes = await pool.query("SELECT id, title, slug, series_id, stage_id, type, test_category_id FROM tests WHERE title ILIKE '%RRB%' OR title ILIKE '%NTPC%' OR category ILIKE '%railway%'");
    console.log("Railway/RRB tests in DB:", rrbRes.rows.length);
    console.table(rrbRes.rows);

    process.exit(0);
  } catch (err) {
    console.error("Query failed:", err);
    process.exit(1);
  }
}

run();
