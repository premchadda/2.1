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
    
    console.log("=== DB DUPLICATE FINDER ===\n");
    
    // List duplicate topics
    const dupTopics = await pool.query(`
      SELECT chapter_id, parent_topic_id, name, COUNT(*) 
      FROM topics 
      GROUP BY chapter_id, parent_topic_id, name 
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Found ${dupTopics.rows.length} duplicate topic combinations:`);
    for (const row of dupTopics.rows) {
      console.log(`- Name: "${row.name}", ChapterID: ${row.chapter_id}, ParentTopicID: ${row.parent_topic_id} (Count: ${row.count})`);
      
      // Let's query all rows matching this duplicate
      const details = await pool.query(
        `SELECT id, name, slug, chapter_id, parent_topic_id, public_id, created_at 
         FROM topics 
         WHERE name = $1 AND 
               (chapter_id = $2 OR (chapter_id IS NULL AND $2 IS NULL)) AND 
               (parent_topic_id = $3 OR (parent_topic_id IS NULL AND $3 IS NULL))`,
        [row.name, row.chapter_id, row.parent_topic_id]
      );
      
      details.rows.forEach(r => {
        console.log(`    * ID: ${r.id}, Slug: "${r.slug}", PublicID: "${r.public_id}", CreatedAt: ${r.created_at}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
