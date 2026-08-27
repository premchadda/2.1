import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { idsMatch } from "./common.js";

const VALID_ATTEMPT_STATUSES = [
  "not_started",
  "in_progress",
  "paused",
  "completed",
  "submitted",
];
const MAX_INACTIVE_SECONDS = 3600; // 1 hour max pause

export class TestAttemptController {
  constructor(dbHelpers = pool) {
    this.db = dbHelpers;
  }

  async createAttempt(userId, testId, options = {}) {
    const { testSeriesId, source } = options;
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Lock the user to prevent concurrent attempt creations for this user
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
        userId,
      ]);

      const testRes = await client.query(
        "SELECT id, title, slug, description, duration, total_questions, total_marks, negative_marking, difficulty, is_pro, is_active, is_live, status, series_id, stage_id, subject_id, test_category_id, section_id, exam_id, stage_ids, tags, category_path_ids, category_path_names, is_coming_soon, coming_soon_date, languages, cutoff_marks, version, ai_explanation_enabled, instructions, test_type, start_time, end_time, shuffle_questions, shuffle_options, allow_review, max_attempts, attempt_count, imported_from, source_test_id, scheduled_at, published_at, live_at, expired_at, archived_at, state_updated_by, banner_asset_id, promotion_banner_asset_id, created_at, updated_at FROM tests WHERE id = $1",
        [testId],
      );
      if (testRes.rows.length === 0) {
        throw new Error("Test not found");
      }
      const test = testRes.rows[0];

      const existingAttempt = await client.query(
        `
        SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts 
        WHERE user_id = $1 AND test_id = $2 
        AND status IN ('in_progress', 'paused', 'not_started')
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [userId, testId],
      );

      if (existingAttempt.rows.length > 0) {
        throw new Error("Active attempt already exists for this test");
      }

      const attemptNumberRes = await client.query(
        `
        SELECT COUNT(*)::int as num FROM attempts 
        WHERE user_id = $1 AND test_id = $2
      `,
        [userId, testId],
      );
      const attemptNumber = (attemptNumberRes.rows[0]?.num || 0) + 1;

      const insertRes = await client.query(
        `
        INSERT INTO attempts (
          user_id, test_id, series_id, test_title, 
          status, attempt_number, is_reattempt, parent_attempt_id,
          started_at, time_limit_seconds, total_questions, total_marks,
          negative_marking, passing_marks, language, created_at
        ) VALUES ($1, $2, $3, $4, 'not_started', $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, NOW())
        RETURNING *
      `,
        [
          userId,
          testId,
          testSeriesId,
          test.title || test.name,
          attemptNumber,
          options.isReattempt || false,
          options.parentAttemptId || null,
          test.duration_minutes
            ? test.duration_minutes * 60
            : test.time_limit || 3600,
          test.total_questions || 0,
          test.total_marks || 0,
          Number(test.negative_marking ?? test.negative_marks ?? 0) > 0
            ? Number(test.negative_marking ?? test.negative_marks)
            : 0.5,
          test.passing_marks || 0,
          test.language || "en",
        ],
      );

      const attempt = insertRes.rows[0];

      await this.initializeQuestionStates(attempt.id, testId, client);

      await client.query("COMMIT");

      return {
        success: true,
        attemptId: attempt.id,
        attemptNumber: attempt.attempt_number,
        status: attempt.status,
        timeLimit: attempt.time_limit_seconds,
        questionsInitialized: true,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async initializeQuestionStates(attemptId, testId, client = this.db) {
    const questionsRes = await client.query(
      `
      SELECT q.id, tq.order_index, tq.marks, tq.negative_marks
      FROM test_questions tq
      JOIN questions q ON q.id = tq.question_id
      WHERE tq.test_id = $1
      ORDER BY tq.order_index
    `,
      [testId],
    );

    // PERF: batch all per-question inserts into a single multi-row statement
    // instead of one INSERT per question (N+1).
    if (questionsRes.rows.length > 0) {
      const values = [];
      const params = [];
      let i = 1;
      for (const q of questionsRes.rows) {
        values.push(`($${i++}, $${i++}, $${i++}, 'not_visited', NOW())`);
        params.push(attemptId, q.id, q.order_index);
      }
      await client.query(
        `
        INSERT INTO question_attempts (attempt_id, question_id, order_index, status, created_at)
        VALUES ${values.join(", ")}
        ON CONFLICT DO NOTHING
      `,
        params,
      );
    }
  }

  async startAttempt(attemptId, userId) {
    const attempt = await this.getAttempt(attemptId, userId);
    if (!attempt) throw new Error("Attempt not found");

    if (attempt.status !== "not_started") {
      throw new Error("Attempt already started");
    }

    await this.db.query(
      `
      UPDATE attempts SET 
        status = 'in_progress',
        started_at = NOW(),
        last_activity = NOW()
      WHERE id = $1
    `,
      [attemptId],
    );

    return { success: true, status: "in_progress", startedAt: new Date() };
  }

  async saveAnswer(attemptId, userId, data) {
    const {
      questionId,
      selectedOption,
      timeSpent,
      currentSection,
      markedForReview,
    } = data;

    const attempt = await this.validateActiveAttempt(attemptId, userId);

    await this.updateQuestionState(attemptId, questionId, {
      selectedOption,
      timeSpent,
      markedForReview,
      status: selectedOption !== null ? "answered" : "visited",
    });

    await this.db.query(
      `
      UPDATE attempts SET 
        last_activity = NOW(),
        last_question_id = $1
      WHERE id = $2
    `,
      [questionId, attemptId],
    );

    return { success: true, savedAt: new Date() };
  }

  async updateQuestionState(attemptId, questionId, updates) {
    const setClauses = [];
    const values = [];
    let paramIdx = 1;

    if (updates.selectedOption !== undefined) {
      setClauses.push(`selected_option = $${paramIdx++}`);
      values.push(updates.selectedOption);
    }
    if (updates.timeSpent !== undefined) {
      setClauses.push(`time_spent_seconds = $${paramIdx++}`);
      values.push(updates.timeSpent);
    }
    if (updates.markedForReview !== undefined) {
      setClauses.push(`is_marked_for_review = $${paramIdx++}`);
      values.push(updates.markedForReview);
    }
    if (updates.status) {
      setClauses.push(`status = $${paramIdx++}`);
      values.push(updates.status);
    }

    setClauses.push(`last_viewed_at = NOW()`);

    if (setClauses.length === 1) return;

    values.push(attemptId, questionId);

    await this.db.query(
      `
      UPDATE question_attempts SET ${setClauses.join(", ")}
      WHERE attempt_id = $${paramIdx++} AND question_id = $${paramIdx}
    `,
      values,
    );
  }

  async validateActiveAttempt(attemptId, userId) {
    const attempt = await this.getAttempt(attemptId, userId);
    if (!attempt) throw new Error("Attempt not found");

    if (!["in_progress", "paused"].includes(attempt.status)) {
      throw new Error(`Cannot modify attempt with status: ${attempt.status}`);
    }

    const lastActivity = new Date(attempt.last_activity || attempt.started_at);
    const inactiveSeconds = Math.floor((Date.now() - lastActivity) / 1000);

    if (inactiveSeconds > MAX_INACTIVE_SECONDS) {
      await this.db.query(
        `UPDATE attempts SET status = 'paused' WHERE id = $1`,
        [attemptId],
      );
      throw new Error("Session expired due to inactivity");
    }

    return attempt;
  }

  async getAttempt(attemptId, userId) {
    const res = await this.db.query(
      `
      SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE id = $1 AND user_id = $2
    `,
      [attemptId, userId],
    );
    return res.rows[0] || null;
  }

  async submitAttempt(attemptId, userId, finalData = {}) {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");

      // Acquire lock on attempt row to prevent concurrent submissions
      const lockRes = await client.query(
        "SELECT * FROM attempts WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [attemptId, userId],
      );
      if (lockRes.rows.length === 0) {
        throw new Error("Attempt not found");
      }
      const attempt = lockRes.rows[0];

      if (!["in_progress", "paused"].includes(attempt.status)) {
        throw new Error(`Cannot modify attempt with status: ${attempt.status}`);
      }

      const lastActivity = new Date(
        attempt.last_activity || attempt.started_at,
      );
      const inactiveSeconds = Math.floor((Date.now() - lastActivity) / 1000);

      if (inactiveSeconds > MAX_INACTIVE_SECONDS) {
        await client.query(
          `UPDATE attempts SET status = 'paused' WHERE id = $1`,
          [attemptId],
        );
        throw new Error("Session expired due to inactivity");
      }

      const questionStates = await client.query(
        `
        SELECT id, attempt_id, question_id, selected_option, is_marked_for_review, time_spent_seconds, visits_count, last_viewed_at
        FROM question_attempts WHERE attempt_id = $1
      `,
        [attemptId],
      );

      const answered = questionStates.rows.filter(
        (q) => q.selected_option !== null,
      );
      const marked = questionStates.rows.filter((q) => q.is_marked_for_review);

      let correct = 0,
        wrong = 0,
        unattempted = 0,
        totalScore = 0;

      for (const qState of questionStates.rows) {
        const qRes = await client.query(
          "SELECT id, question_text, question_text_hi, options, options_hi, correct_answer, correct_option, explanation, explanation_hi, marks, negative_marks, difficulty, question_type, category, sub_category_id, tags, status, is_active, is_practice, question_number, test_id, series_id, section_id, subject, subject_id, chapter_id, topic_id, topic, quiz_id, study_material_id, image_asset_id, image_url, passage_id, created_by, category_id, external_question_id, language, solution_image_url, source, imported_from, is_deleted, deleted_by, deleted_at, created_at, updated_at FROM questions WHERE id = $1",
          [qState.question_id],
        );
        if (qRes.rows.length === 0) continue;

        const question = qRes.rows[0];
        const rawCorrect =
          question.correct_option ??
          question.correct_answer ??
          question.correctOption;
        const isCorrect =
          qState.selected_option !== null &&
          Number(qState.selected_option) === Number(rawCorrect);
        const qPos = Number(question.marks ?? 2);
        const neg =
          Number(question.negative_marks ?? 0) > 0
            ? Number(question.negative_marks)
            : qPos === 2
              ? 0.5
              : qPos * 0.25;

        if (qState.selected_option === null) {
          unattempted++;
        } else if (isCorrect) {
          correct++;
          totalScore += qPos;
        } else {
          wrong++;
          totalScore -= neg;
        }
      }

      const totalAttempted = correct + wrong;
      const accuracy =
        totalAttempted > 0 ? Math.round((correct / totalAttempted) * 100) : 0;
      const percentage =
        attempt.total_marks > 0
          ? Math.round((totalScore / attempt.total_marks) * 100)
          : 0;

      const passed = totalScore >= (attempt.passing_marks || 0);

      await client.query(
        `
        UPDATE attempts SET 
          status = 'completed',
          submitted_at = NOW(),
          score = $1,
          total_marks = $2,
          percentage = $3,
          accuracy = $4,
          correct_count = $5,
          wrong_count = $6,
          unattempted_count = $7,
          last_activity = NOW()
        WHERE id = $8
      `,
        [
          totalScore,
          attempt.total_marks,
          percentage,
          accuracy,
          correct,
          wrong,
          unattempted,
          attemptId,
        ],
      );

      await client.query("COMMIT");

      return {
        success: true,
        status: "completed",
        score: totalScore,
        percentage,
        accuracy,
        correct,
        wrong,
        unattempted,
        passed,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getQuestionStates(attemptId) {
    const res = await this.db.query(
      `
      SELECT qa.*, q.question, q.correct_option, q.marks, q.negative_marks
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      WHERE qa.attempt_id = $1
      ORDER BY qa.order_index
    `,
      [attemptId],
    );
    return res.rows;
  }

  async getAnalytics(attemptId) {
    const attempt = await this.db.query(
      "SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE id = $1",
      [attemptId],
    );
    if (!attempt.rows[0]) return null;

    const questionStats = await this.db.query(
      `
      SELECT 
        status,
        COUNT(*)::int as count,
        SUM(time_spent_seconds)::int as total_time,
        AVG(time_spent_seconds)::int as avg_time
      FROM question_attempts
      WHERE attempt_id = $1
      GROUP BY status
    `,
      [attemptId],
    );

    const topicStats = await this.db.query(
      `
      SELECT 
        t.name as topic_name,
        s.name as subject_name,
        COUNT(*)::int as attempted,
        SUM(CASE WHEN qa.selected_option = q.correct_option THEN 1 ELSE 0 END)::int as correct
      FROM question_attempts qa
      JOIN questions q ON q.id = qa.question_id
      LEFT JOIN subject_topics t ON t.id = q.topic_id
      LEFT JOIN subjects s ON s.id = q.subject
      WHERE qa.attempt_id = $1 AND qa.selected_option IS NOT NULL
      GROUP BY t.name, s.name
    `,
      [attemptId],
    );

    return {
      questionStats: questionStats.rows,
      topicStats: topicStats.rows.map((t) => ({
        ...t,
        accuracy:
          t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0,
      })),
    };
  }
}

export const testAttemptController = new TestAttemptController(pool);
export default TestAttemptController;
