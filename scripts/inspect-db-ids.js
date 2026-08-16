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
    
    // Check subject IDs referenced by units
    const unitsRef = await pool.query("SELECT DISTINCT subject_id FROM units");
    console.log("Subject IDs referenced by active units:", unitsRef.rows.map(r => r.subject_id));
    
    // Check subject IDs and study_material_ids referenced by chapters
    const chRef = await pool.query("SELECT DISTINCT subject_id, study_material_id FROM chapters");
    console.log("Subject and study_material IDs referenced by chapters:");
    chRef.rows.forEach(r => console.log(`  subject_id: ${r.subject_id}, study_material_id: ${r.study_material_id}`));
    
    // Check subject IDs referenced by topics
    const topRef = await pool.query("SELECT DISTINCT subject_id, subject FROM topics");
    console.log("Subject IDs and subject field referenced by topics:");
    topRef.rows.forEach(r => console.log(`  subject_id: ${r.subject_id}, subject: "${r.subject}"`));
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
