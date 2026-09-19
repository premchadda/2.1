import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const tests = await pool.query(`
    SELECT t.id, t.title, COUNT(q.id) as q_cnt
    FROM tests t
    JOIN questions q ON q.test_id = t.id
    GROUP BY t.id, t.title
    ORDER BY t.id;
  `);

  console.log(`Total tests: ${tests.rows.length}`);
  
  // Group tests by title pattern
  const categories = {};
  for (const t of tests.rows) {
    let cat = "Other";
    if (t.title.includes("RRB NTPC")) cat = "RRB NTPC";
    else if (t.title.includes("CGL")) cat = "SSC CGL";
    else if (t.title.includes("CHSL")) cat = "SSC CHSL";
    else if (t.title.includes("MTS")) cat = "SSC MTS";
    else if (t.title.includes("CPO")) cat = "SSC CPO";
    else if (t.title.includes("GD")) cat = "SSC GD";
    else if (t.title.includes("Sectional")) cat = "Sectional Tests";
    
    categories[cat] = (categories[cat] || 0) + Number(t.q_cnt);
  }
  console.log("Question count by test series:");
  console.table(categories);

  await pool.end();
}
main().catch(console.error);
