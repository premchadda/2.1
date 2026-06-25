require('dotenv').config({path: './apps/backend/.env'});
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Starting backfill for test_id = 5...");
    
    // 1. Get all questions with test_id = 5
    const questionsRes = await pool.query(
      "SELECT id, question_number FROM questions WHERE test_id = 5 AND is_active = true ORDER BY question_number"
    );
    console.log(`Found ${questionsRes.rows.length} questions in the database with test_id = 5.`);
    
    if (questionsRes.rows.length === 0) {
      console.log("No questions found to backfill.");
      process.exit(0);
    }
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    // 2. Iterate and insert junction records
    for (const q of questionsRes.rows) {
      const existsRes = await pool.query(
        "SELECT 1 FROM test_questions WHERE test_id = 5 AND question_id = $1",
        [q.id]
      );
      
      if (existsRes.rows.length === 0) {
        await pool.query(
          "INSERT INTO test_questions (test_id, question_id, order_index, created_at) VALUES (5, $1, $2, NOW())",
          [q.id, q.question_number || 0]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log(`Backfill completed! Linked: ${insertedCount}, Already Linked/Skipped: ${skippedCount}`);
    
    // 3. Sync test counts
    // Let's call pool.query to update total_questions and total_marks on test 5
    const countRes = await pool.query("SELECT COUNT(*) FROM test_questions WHERE test_id = 5");
    const count = parseInt(countRes.rows[0].count, 10);
    
    await pool.query(
      "UPDATE tests SET total_questions = $1, total_marks = $1 * 2 WHERE id = 5",
      [count]
    );
    console.log(`Synced test 5 details: total_questions = ${count}, total_marks = ${count * 2}`);
    
    process.exit(0);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exit(1);
  }
}

run();
