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
    
    const subjects = await pool.query("SELECT id, name, slug, parent_id, subject_group, is_active FROM subjects");
    console.log("ALL SUBJECTS IN DB:");
    subjects.rows.forEach(r => console.log(`- ID: ${r.id}, Name: "${r.name}", Slug: "${r.slug}", ParentID: ${r.parent_id}, Group: ${r.subject_group}, Active: ${r.is_active}`));
    
    const units = await pool.query("SELECT id, name, slug, subject_id, is_active FROM units");
    console.log("\nALL UNITS IN DB:");
    units.rows.forEach(r => console.log(`- ID: ${r.id}, Name: "${r.name}", Slug: "${r.slug}", SubjectID: ${r.subject_id}, Active: ${r.is_active}`));
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
