import "dotenv/config";
import {
  pool,
  dbHelpers,
} from "../src/infrastructure/database/postgres-helpers.js";
import {
  resolveQuestionMarks,
  scoreMcqAnswer,
} from "../src/shared/utils/scoreAttempt.js";

async function regenerateAllResults() {
  console.log(
    "======================================================================",
  );
  console.log(
    "  REGENERATING ALL TEST RESULTS & ATTEMPTS WITH CANONICAL SCORING   ",
  );
  console.log(
    "======================================================================\n",
  );

  try {
    // 1. Fetch all tests for metadata
    const testsRes = await pool.query("SELECT * FROM tests");
    const testMap = new Map(testsRes.rows.map((t) => [Number(t.id), t]));

    // 2. Fetch all attempts (both completed and all)
    const attemptsRes = await pool.query(
      "SELECT * FROM attempts ORDER BY id ASC",
    );
    console.log(
      `Found ${attemptsRes.rows.length} total attempts in database.\n`,
    );

    let regeneratedCount = 0;

    for (const attempt of attemptsRes.rows) {
      const test = testMap.get(Number(attempt.test_id));
      if (!test) {
        console.warn(
          `[Skip] Attempt ${attempt.id}: Test ${attempt.test_id} not found in database.`,
        );
        continue;
      }

      // Fetch questions for this test
      const qRes = await pool.query(
        `
        SELECT q.*, tq.marks as junction_marks, tq.negative_marks as junction_neg_marks,
               tq.order_index, tq.section_id as junction_section_id
        FROM questions q
        JOIN test_questions tq ON q.id = tq.question_id
        WHERE tq.test_id = $1 AND q.is_active = true
        ORDER BY tq.order_index ASC, q.id ASC
      `,
        [attempt.test_id],
      );

      const questions = qRes.rows;
      const totalQuestions =
        questions.length > 0
          ? questions.length
          : Number(attempt.total_questions || test.total_questions || 0);

      const testDefaults = {
        marksPerQuestion: Number(test.marks_per_question || 2),
        negativeMarking: Number(
          test.negative_marking || test.negative_marks || 0.5,
        ),
        totalMarks: Number(test.total_marks || totalQuestions * 2),
      };

      const rawAnswers = Array.isArray(attempt.answers) ? attempt.answers : [];

      let correct = 0;
      let wrong = 0;
      let unattempted = 0;
      let totalScore = 0;
      let totalCalculatedMarks = 0;
      const questionResults = [];

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const { positive, negative } = resolveQuestionMarks(q, testDefaults);
        totalCalculatedMarks += positive;

        // Find user answer
        const ansEntry = rawAnswers.find(
          (a) =>
            (a.questionId !== undefined &&
              Number(a.questionId) === Number(q.id)) ||
            (a.questionIndex !== undefined && Number(a.questionIndex) === idx),
        );

        const selectedOption =
          ansEntry?.selectedOption !== undefined &&
          ansEntry?.selectedOption !== null &&
          ansEntry?.selectedOption !== -1 &&
          ansEntry?.selectedOption !== ""
            ? Number(ansEntry.selectedOption)
            : null;

        const rawCorrect =
          q.correct_option ??
          q.correctOption ??
          q.correct_option_id ??
          q.correctOptionId ??
          q.correct_answer ??
          q.correctAnswer ??
          q.correct ??
          q.answer;

        const correctOption =
          rawCorrect !== undefined && rawCorrect !== null
            ? Number(rawCorrect)
            : null;

        const scored = scoreMcqAnswer({
          selectedOption,
          correctOption,
          positive,
          negative,
        });

        if (scored.isCorrect) {
          correct++;
          totalScore += positive;
        } else if (scored.isWrong) {
          wrong++;
          totalScore -= negative;
        } else {
          unattempted++;
        }

        questionResults.push({
          questionId: q.id,
          questionIndex: idx,
          selectedOption,
          correctOption,
          isCorrect: scored.isCorrect,
          isWrong: scored.isWrong,
          isUnattempted: scored.unattempted === 1,
          scoreDelta: scored.delta,
          marks: positive,
          negativeMarks: negative,
        });
      }

      const attempted = correct + wrong;
      const accuracy =
        attempted > 0 ? Number(((correct / attempted) * 100).toFixed(2)) : 0;
      const totalMarks =
        totalCalculatedMarks > 0
          ? totalCalculatedMarks
          : Number(
              test.total_marks || attempt.total_marks || totalQuestions * 2,
            );

      console.log(
        `[Attempt ${attempt.id}] Test: "${test.title}" (ID ${test.id}) | User ID: ${attempt.user_id}`,
      );
      console.log(
        `   Old: Score=${attempt.score}, Correct=${attempt.correct}, Wrong=${attempt.wrong}, Accuracy=${attempt.accuracy}%`,
      );
      console.log(
        `   New: Score=${totalScore}, Correct=${correct}, Wrong=${wrong}, Unattempted=${unattempted}, Accuracy=${accuracy}%, TotalMarks=${totalMarks}`,
      );

      // Update attempt in DB
      await pool.query(
        `
        UPDATE attempts
        SET
          score = $1,
          total_marks = $2,
          correct = $3,
          wrong = $4,
          incorrect = $4,
          unattempted = $5,
          skipped = $5,
          attempted = $6,
          accuracy = $7,
          total_questions = $8,
          question_results = $9,
          updated_at = NOW()
        WHERE id = $10
      `,
        [
          totalScore,
          totalMarks,
          correct,
          wrong,
          unattempted,
          attempted,
          accuracy,
          totalQuestions,
          JSON.stringify(questionResults),
          attempt.id,
        ],
      );

      regeneratedCount++;
    }

    console.log(
      `\n✓ Successfully re-evaluated and updated ${regeneratedCount} attempts.\n`,
    );

    // 3. Recalculate ranks and percentiles per test
    console.log(
      "Recalculating rank and percentile for all completed attempts...",
    );
    const distinctTestsRes = await pool.query(`
      SELECT DISTINCT test_id
      FROM attempts
      WHERE (is_completed = true OR status = 'completed') AND (is_deleted IS NOT TRUE)
    `);

    for (const row of distinctTestsRes.rows) {
      const testId = row.test_id;
      const rankedRes = await pool.query(
        `
        WITH ranked AS (
          SELECT
            id,
            score,
            RANK() OVER (
              ORDER BY COALESCE(score, 0)::numeric DESC,
                       COALESCE(time_spent, 999999) ASC
            ) as computed_rank,
            COUNT(*) OVER () as total_count
          FROM attempts
          WHERE test_id = $1
            AND (is_completed = true OR status = 'completed')
            AND (is_deleted IS NOT TRUE)
        )
        SELECT id, score, computed_rank, total_count
        FROM ranked
      `,
        [testId],
      );

      for (const rankRow of rankedRes.rows) {
        const total = Number(rankRow.total_count);
        const rank = Number(rankRow.computed_rank);
        const percentile =
          total > 1
            ? Number((((total - rank) / (total - 1)) * 100).toFixed(2))
            : 100;

        await pool.query(
          `
          UPDATE attempts
          SET rank = $1, percentile = $2
          WHERE id = $3
        `,
          [rank, percentile, rankRow.id],
        );
      }
    }

    console.log("✓ All ranks and percentiles updated successfully!\n");
    console.log(
      "======================================================================",
    );
    console.log(
      "                      ALL RESULTS REGENERATED                         ",
    );
    console.log(
      "======================================================================",
    );
  } catch (err) {
    console.error("Fatal error regenerating results:", err);
  } finally {
    await pool.end();
  }
}

regenerateAllResults();
