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
    
    // Let's query one unit, its chapters, their topics, and their subtopics to see a real example
    const unit = await pool.query("SELECT * FROM units LIMIT 1");
    if (unit.rows.length > 0) {
      const u = unit.rows[0];
      console.log(`UNIT: ${u.name} (id: ${u.id}, subject_id: ${u.subject_id})`);
      
      const chapters = await pool.query("SELECT * FROM chapters WHERE unit_id = $1 LIMIT 2", [u.id]);
      for (const ch of chapters.rows) {
        console.log(`  CHAPTER: ${ch.title} (id: ${ch.id}, subject_id: ${ch.subject_id})`);
        
        const topics = await pool.query("SELECT * FROM topics WHERE chapter_id = $1 LIMIT 3", [ch.id]);
        for (const top of topics.rows) {
          console.log(`    TOPIC: ${top.name} (id: ${top.id}, parent_topic_id: ${top.parent_topic_id})`);
          
          const childTopics = await pool.query("SELECT * FROM topics WHERE parent_topic_id = $1", [top.id]);
          for (const ctop of childTopics.rows) {
            console.log(`      CHILD TOPIC: ${ctop.name} (id: ${ctop.id})`);
          }
          
          const subtopics = await pool.query("SELECT * FROM subtopics WHERE topic_id = $1 LIMIT 3", [top.id]);
          for (const sub of subtopics.rows) {
            console.log(`      SUBTOPIC: ${sub.name} (id: ${sub.id})`);
          }
        }
      }
    } else {
      console.log("No units found");
    }
    
    // Also, let's see some topics where subject_id is null
    const nullTopics = await pool.query("SELECT id, name, subject, chapter_id, parent_topic_id FROM topics WHERE subject_id IS NULL LIMIT 10");
    console.log("\nSAMPLE TOPICS WITH NULL subject_id:");
    nullTopics.rows.forEach(t => {
      console.log(`- ID: ${t.id}, Name: "${t.name}", Subject: "${t.subject}", ChapterID: ${t.chapter_id}, ParentTopicID: ${t.parent_topic_id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
