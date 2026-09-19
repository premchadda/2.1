import dotenv from 'dotenv';
dotenv.config({ path: 'apps/backend/.env' });
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== STEP 1: CREATING COMPLETE BACKUP TABLE ===");

  // Drop table if exists from previous attempt
  await pool.query(`DROP TABLE IF EXISTS questions_classification_backup_20260918_v2;`);

  // Create backup table
  await pool.query(`
    CREATE TABLE questions_classification_backup_20260918_v2 AS
    SELECT 
      id, test_id, question_number,
      subject_id, chapter_id, topic_id, subtopic_id,
      section, subject, chapter, topic
    FROM questions;
  `);

  const count = await pool.query(`SELECT COUNT(*) FROM questions_classification_backup_20260918_v2;`);
  console.log(`Backup table created successfully with ${count.rows[0].count} rows.`);

  await pool.end();
}
main().catch(console.error);
