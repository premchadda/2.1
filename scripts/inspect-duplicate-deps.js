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
    
    const duplicates = [
      { dupId: 655, primId: 461, name: "Congruence" },
      { dupId: 225, primId: 6, name: "Profit and Loss" },
      { dupId: 648, primId: 464, name: "Discriminant" },
      { dupId: 656, primId: 462, name: "Similarity" },
      { dupId: 575, primId: 459, name: "Divisibility" }
    ];
    
    for (const item of duplicates) {
      console.log(`\nChecking dependencies for "${item.name}" (Duplicate ID: ${item.dupId}):`);
      
      // Check subtopics
      const subRes = await pool.query("SELECT COUNT(*) FROM subtopics WHERE topic_id = $1", [item.dupId]);
      const subCount = parseInt(subRes.rows[0].count);
      console.log(`  - Subtopics referencing duplicate ID: ${subCount}`);
      
      // Check topics with parent_topic_id pointing to this duplicate
      const parentRes = await pool.query("SELECT COUNT(*) FROM topics WHERE parent_topic_id = $1", [item.dupId]);
      const parentCount = parseInt(parentRes.rows[0].count);
      console.log(`  - Topics referencing this as parent_topic_id: ${parentCount}`);
      
      // Check if there are questions or other tables in database referencing topic_id
      // Let's query information_schema.constraint_column_usage to see what tables reference topics(id)
      // and check count in those tables.
    }
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
