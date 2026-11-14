import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env
const envPath = path.resolve(__dirname, "../apps/backend/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MASTER_JSON_PATH = path.resolve(
  __dirname,
  "../output/cgl_2026_tier1/ssc_cgl_2026_tier1_master_question_bank.json",
);

async function uploadToTrstprep(dryRun = false) {
  console.log(
    `=== Ingesting SSC CGL 2026 Question Bank (DryRun: ${dryRun}) ===`,
  );

  if (!fs.existsSync(MASTER_JSON_PATH)) {
    console.error(`Master question bank not found at: ${MASTER_JSON_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(MASTER_JSON_PATH, "utf-8");
  const masterBank = JSON.parse(rawData);

  const client = await pool.connect();
  try {
    console.log(
      `Connected to database. Shifts to process: ${masterBank.shifts.length}`,
    );

    // Exam ID for SSC CGL in Trstprep is typically 1
    const examId = 1;

    let totalTestsInserted = 0;
    let totalQuestionsInserted = 0;

    for (const shift of masterBank.shifts) {
      const shiftTitle = shift.shift_name;
      console.log(
        `\nProcessing ${shiftTitle} (${shift.questions.length} questions)...`,
      );

      if (dryRun) {
        console.log(
          `[DRY RUN] Would create test: "${shiftTitle}" with 4 sections and 100 questions`,
        );
        continue;
      }

      await client.query("BEGIN");

      // 1. Check if test already exists
      const existingTestRes = await client.query(
        `SELECT id FROM tests WHERE exam_id = $1 AND title = $2 LIMIT 1`,
        [examId, shiftTitle],
      );

      let testId;
      if (existingTestRes.rows.length > 0) {
        testId = existingTestRes.rows[0].id;
        console.log(
          `  Existing test found: ID ${testId}. Updating questions...`,
        );
      } else {
        const insertTestRes = await client.query(
          `
          INSERT INTO tests (
            exam_id, title, description, duration_minutes, total_marks, total_questions, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          RETURNING id;
        `,
          [
            examId,
            shiftTitle,
            `Official SSC CGL 2026 Tier-1 Computer Based Examination - Shift held on ${shift.exam_date} (Shift ${shift.shift_number}).`,
            shift.duration_minutes || 60,
            shift.total_marks || 200,
            shift.total_questions || 100,
            true,
          ],
        );
        testId = insertTestRes.rows[0].id;
        console.log(`  Created Test ID: ${testId}`);
      }
      totalTestsInserted++;

      // 2. Map or create test sections
      const sectionIdMap = {};
      for (const sec of shift.sections) {
        const secRes = await client.query(
          `
          SELECT id FROM test_sections WHERE test_id = $1 AND name = $2 LIMIT 1
        `,
          [testId, sec.section_name],
        );

        let secId;
        if (secRes.rows.length > 0) {
          secId = secRes.rows[0].id;
        } else {
          const insertSec = await client.query(
            `
            INSERT INTO test_sections (test_id, name, total_questions, marks_per_question, negative_marks)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id;
          `,
            [testId, sec.section_name, sec.total_questions, 2.0, 0.5],
          );
          secId = insertSec.rows[0].id;
        }
        sectionIdMap[sec.section_code] = secId;
      }

      // 3. Insert Questions and link in test_questions
      for (const q of shift.questions) {
        const secId = sectionIdMap[q.section_code] || null;

        // Prepare question options JSON
        const optionsJson = JSON.stringify(
          q.options.map((o) => ({
            id: o.id,
            text: o.text,
            is_correct: o.is_correct,
          })),
        );

        // Question statement text: include OCR text + image reference
        const fullQuestionText =
          q.question_text ||
          `[SSC CGL 2026 Tier-1 Question ${q.question_number}]`;

        const qInsert = await client.query(
          `
          INSERT INTO questions (
            test_id, section_id, question_text, question_type, options, correct_answer, explanation, marks, negative_marks, difficulty, tags, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING id;
        `,
          [
            testId,
            secId,
            fullQuestionText,
            "mcq",
            optionsJson,
            q.correct_option,
            q.solution?.explanation ||
              `Correct Answer: Option ${q.correct_option}`,
            q.marks || 2.0,
            q.negative_marks || 0.5,
            "medium",
            [
              "SSC CGL",
              "Tier-1",
              "2026",
              `Shift-${shift.shift_number}`,
              q.section_code,
            ],
          ],
        );

        const qId = qInsert.rows[0].id;

        // Check test_questions junction
        await client.query(
          `
          INSERT INTO test_questions (test_id, question_id, section_id, order_index, marks, negative_marks)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING;
        `,
          [testId, qId, secId, q.question_number, 2.0, 0.5],
        );

        totalQuestionsInserted++;
      }

      await client.query("COMMIT");
      console.log(
        `  Successfully committed Shift ${shift.shift_index} (100 questions) to database.`,
      );
    }

    console.log(`\n================ INGESTION COMPLETE ================`);
    console.log(`Total Shifts (Tests) Inserted: ${totalTestsInserted}`);
    console.log(`Total Questions Ingested: ${totalQuestionsInserted}`);
    console.log(`====================================================`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ingestion failed with error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

const isDryRun = process.argv.includes("--dry-run");
uploadToTrstprep(isDryRun);
