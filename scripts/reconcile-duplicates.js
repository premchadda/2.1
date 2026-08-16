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

const duplicates = [
  { name: "Congruence", dupId: 655, primId: 461 },
  { name: "Profit and Loss", dupId: 225, primId: 6 },
  { name: "Discriminant", dupId: 648, primId: 464 },
  { name: "Similarity", dupId: 656, primId: 462 },
  { name: "Divisibility", dupId: 575, primId: 459 }
];

async function main() {
  const execute = process.argv.includes("--execute");
  console.log(`=== TOPIC & SUBTOPIC RECONCILIATION (${execute ? "EXECUTE MODE" : "DRY RUN MODE"}) ===\n`);
  
  try {
    const { pool } = await import('../apps/backend/src/infrastructure/database/postgres-helpers.js');
    
    for (const item of duplicates) {
      console.log(`\nReconciling duplicate topic "${item.name}" (Duplicate ID: ${item.dupId} -> Primary ID: ${item.primId})...`);
      
      // 1. Reconcile subtopics under this duplicate topic
      const subtopics = await pool.query("SELECT id, name, slug FROM subtopics WHERE topic_id = $1", [item.dupId]);
      
      for (const sub of subtopics.rows) {
        // Check if same subtopic name/slug exists under primary topic
        const existingSub = await pool.query(
          "SELECT id FROM subtopics WHERE topic_id = $1 AND (slug = $2 OR LOWER(name) = $3)",
          [item.primId, sub.slug, sub.name.toLowerCase()]
        );
        
        if (existingSub.rows.length > 0) {
          const primSubId = existingSub.rows[0].id;
          console.log(`  - Subtopic "${sub.name}" already exists under primary topic (ID: ${primSubId}). Re-routing references...`);
          
          if (execute) {
            // Update referencing tables for subtopic_id
            await pool.query("UPDATE questions SET subtopic_id = $1 WHERE subtopic_id = $2", [primSubId, sub.id]);
            await pool.query("UPDATE concepts SET subtopic_id = $1 WHERE subtopic_id = $2", [primSubId, sub.id]);
            await pool.query("UPDATE topic_resources SET subtopic_id = $1 WHERE subtopic_id = $2", [primSubId, sub.id]);
            
            // Delete duplicate subtopic
            await pool.query("DELETE FROM subtopics WHERE id = $1", [sub.id]);
            console.log(`    Successfully merged subtopic ID ${sub.id} into ${primSubId}.`);
          } else {
            console.log(`    [DRY RUN] Would UPDATE questions, concepts, topic_resources to subtopic_id ${primSubId} and DELETE subtopic ID ${sub.id}`);
          }
        } else {
          console.log(`  - Subtopic "${sub.name}" does not exist under primary topic. Re-parenting to primary topic...`);
          
          if (execute) {
            await pool.query("UPDATE subtopics SET topic_id = $1 WHERE id = $2", [item.primId, sub.id]);
            console.log(`    Successfully updated subtopic topic_id to ${item.primId}.`);
          } else {
            console.log(`    [DRY RUN] Would UPDATE subtopic topic_id to ${item.primId}`);
          }
        }
      }
      
      // 2. Re-route references for topic_id in other tables
      const topicFks = [
        { table: "topics", col: "parent_topic_id" },
        { table: "topic_resources", col: "topic_id" },
        { table: "study_materials", col: "topic_id" },
        { table: "subject_videos", col: "topic_id" },
        { table: "subject_pdfs", col: "topic_id" },
        { table: "topic_tests", col: "topic_id" },
        { table: "questions", col: "topic_id" },
        { table: "user_topic_stats", col: "topic_id" },
        { table: "passages", col: "topic_id" },
        { table: "practice_sessions", col: "topic_id" }
      ];
      
      for (const fk of topicFks) {
        // Count matching rows
        const countRes = await pool.query(`SELECT COUNT(*) FROM ${fk.table} WHERE ${fk.col} = $1`, [item.dupId]);
        const count = parseInt(countRes.rows[0].count);
        if (count > 0) {
          console.log(`  - Found ${count} rows in table "${fk.table}" (${fk.col}) referencing duplicate topic ID ${item.dupId}`);
          
          if (execute) {
            await pool.query(`UPDATE ${fk.table} SET ${fk.col} = $1 WHERE ${fk.col} = $2`, [item.primId, item.dupId]);
            console.log(`    Successfully updated ${count} rows in "${fk.table}".`);
          } else {
            console.log(`    [DRY RUN] Would UPDATE ${count} rows in "${fk.table}" to ${item.primId}`);
          }
        }
      }
      
      // 3. Delete duplicate topic row itself
      console.log(`  - Deleting duplicate topic ID ${item.dupId} from topics table...`);
      if (execute) {
        await pool.query("DELETE FROM topics WHERE id = $1", [item.dupId]);
        console.log(`    Successfully deleted duplicate topic ID ${item.dupId}.`);
      } else {
        console.log(`    [DRY RUN] Would DELETE topic ID ${item.dupId}`);
      }
    }
    
    console.log("\nReconciliation completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
