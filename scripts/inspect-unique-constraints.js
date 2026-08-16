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
    const { pool } = await import('../apps/backend/src/infrastructure/database/postgres-helpers.js');
    
    // Find unique constraints for chapters, topics, subtopics
    const res = await pool.query(`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        kcu.column_name 
      FROM 
        information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema 
      WHERE tc.constraint_type = 'UNIQUE' 
        AND tc.table_name IN ('chapters', 'topics', 'subtopics', 'units');
    `);
    
    console.log("UNIQUE CONSTRAINTS:");
    for (const r of res.rows) {
      console.log(`- Table: ${r.table_name}, Constraint: ${r.constraint_name}, Column: ${r.column_name}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
