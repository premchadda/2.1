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
    
    const chapters = await pool.query("SELECT id, title, public_id FROM chapters LIMIT 5");
    console.log("CHAPTER PUBLIC IDS:");
    chapters.rows.forEach(r => console.log(`- ${r.title}: ${r.public_id}`));
    
    const topics = await pool.query("SELECT id, name, public_id FROM topics LIMIT 5");
    console.log("\nTOPIC PUBLIC IDS:");
    topics.rows.forEach(r => console.log(`- ${r.name}: ${r.public_id}`));
    
    const subtopics = await pool.query("SELECT id, name, public_id FROM subtopics LIMIT 5");
    console.log("\nSUBTOPIC PUBLIC IDS:");
    subtopics.rows.forEach(r => console.log(`- ${r.name}: ${r.public_id}`));
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
