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
    
    // Find all tables & columns referencing topics.id
    const fkRes = await pool.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS referenced_table_name,
        ccu.column_name AS referenced_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'topics';
    `);
    
    console.log("FOREIGN KEY REFERENCES TO topics:");
    for (const r of fkRes.rows) {
      console.log(`- Table: ${r.table_name}, Column: ${r.column_name} references ${r.referenced_table_name}(${r.referenced_column_name})`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
