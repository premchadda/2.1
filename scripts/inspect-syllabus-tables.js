import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
}

async function main() {
  try {
    const { pool, dbHelpers } = await import('../apps/backend/src/infrastructure/database/postgres-helpers.js');
    
    const tables = ['subjects', 'units', 'chapters', 'topics', 'subtopics'];
    for (const table of tables) {
      const existsRes = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",
        [table]
      );
      const exists = existsRes.rows[0].exists;
      console.log(`Table: ${table} - Exists: ${exists}`);
      if (exists) {
        const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  Count: ${countRes.rows[0].count}`);
        
        const colsRes = await pool.query(
          `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
          [table]
        );
        console.log(`  Columns:`);
        colsRes.rows.forEach(col => {
          console.log(`    - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
        });
      }
      console.log();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
