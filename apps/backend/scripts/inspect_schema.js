import { getReadPool } from "../config/database-replicas.js";

async function run() {
  const pool = getReadPool();
  const qCols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'questions' ORDER BY ordinal_position",
  );
  console.log("--- questions columns ---");
  console.table(qCols.rows);
  const optCols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'options' ORDER BY ordinal_position",
  );
  console.log("--- options columns ---");
  console.table(optCols.rows);
  const sampleQ = await pool.query(
    "SELECT id, exam_id, test_id, question_number, section, SUBSTRING(question_text, 1, 60) as text_preview, correct_option FROM questions WHERE exam_id = 1 LIMIT 2",
  );
  console.log("--- Sample questions ---");
  console.table(sampleQ.rows);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
