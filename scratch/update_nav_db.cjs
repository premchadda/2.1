require('dotenv').config({path: './apps/backend/.env'});
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT id, label, category, \"order\" FROM navigation_config");
    console.log("Total navigation configs in DB:", res.rows.length);
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error("Query failed:", err);
    process.exit(1);
  }
}

run();
