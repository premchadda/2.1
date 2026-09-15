import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "e:/Tech/Testprep/Trstprep V2.1/apps/backend/.env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function main() {
  try {
    console.log("=== TEST_CATEGORY_SERIES ROWS ===");
    const tcs = await pool.query(`
      SELECT tcs.*, tc.name as cat_name, tc.parent_id, tc.slug 
      FROM test_category_series tcs
      LEFT JOIN test_categories tc ON tcs.test_category_id = tc.id
      ORDER BY tcs.test_series_id, tcs.test_category_id;
    `);
    console.table(tcs.rows);

    console.log("\n=== CHECK LEVEL 1 FOR PYPS (parent_id = 6) ===");
    const l1 = await pool.query(`
      SELECT id, name, slug, parent_id, level 
      FROM test_categories 
      WHERE parent_id = 6 AND (is_deleted = false OR is_deleted IS NULL);
    `);
    console.table(l1.rows);

    console.log("\n=== CHECK LEVEL 2 FOR YEAR BASED (parent_id = 7) ===");
    const l2 = await pool.query(`
      SELECT id, name, slug, parent_id, level,
             (SELECT COUNT(*) FROM tests t WHERE t.test_category_id = tc.id AND (t.is_deleted = false OR t.is_deleted IS NULL)) as test_count
      FROM test_categories tc
      WHERE parent_id = 7 AND (is_deleted = false OR is_deleted IS NULL)
      ORDER BY name DESC;
    `);
    console.table(l2.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
