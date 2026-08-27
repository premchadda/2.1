/**
 * Live Mock Infrastructure Service
 *
 * Manages live mock tests:
 * - Real-time test sessions
 * - Timer management
 * - Anti-cheat measures
 * - Live leaderboard
 * - Results publication
 */

import { pool } from "../../infrastructure/database/postgres-helpers.js";

const liveMockService = {
  /**
   * Create a live mock test session.
   */
  async createSession(data) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO live_tests (
          test_id, start_time, end_time, result_time,
          is_active, registration_open, max_participants,
          chat_enabled, is_all_india_mock, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          true, $5, $6,
          $7, $8, NOW(), NOW()
        ) RETURNING *`,
        [
          data.testId,
          data.startTime,
          data.endTime,
          data.resultTime || null,
          data.registrationOpen !== false,
          data.maxParticipants || 10000,
          data.chatEnabled !== false,
          data.isAllIndiaMock || false,
        ],
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  },

  /**
   * Get upcoming live tests.
   */
  /**
   * Get upcoming and ongoing live tests.
   */
  async getUpcoming(limit = 20) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        SELECT lt.*, t.title, t.total_questions, t.duration,
               ts.title as series_name,
               CASE 
                 WHEN lt.start_time <= NOW() AND (lt.end_time IS NULL OR lt.end_time >= NOW()) THEN 'live'
                 WHEN lt.start_time > NOW() THEN 'upcoming'
                 ELSE 'ended'
               END as live_status
        FROM live_tests lt
        JOIN tests t ON t.id = lt.test_id
        LEFT JOIN test_series ts ON ts.id = t.series_id
        WHERE lt.is_active = true
          AND (lt.end_time IS NULL OR lt.end_time >= NOW() - INTERVAL '2 hours')
        ORDER BY 
          CASE WHEN lt.start_time <= NOW() AND (lt.end_time IS NULL OR lt.end_time >= NOW()) THEN 0 ELSE 1 END,
          lt.start_time ASC
        LIMIT $1
      `,
        [limit],
      );

      return result.rows;
    } finally {
      client.release();
    }
  },

  /**
   * Get active live test.
   */
  async getActive() {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT lt.*, t.title, t.total_questions, t.duration
        FROM live_tests lt
        JOIN tests t ON t.id = lt.test_id
        WHERE lt.is_active = true
          AND lt.start_time <= NOW()
          AND (lt.end_time IS NULL OR lt.end_time > NOW())
        ORDER BY lt.start_time DESC
        LIMIT 1
      `);

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  },

  /**
   * Get live test details.
   */
  async getById(id) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const cleanId = String(id || "").trim();
      const rawUuid = cleanId.startsWith("tst_") ? cleanId.slice(4) : cleanId;
      const isInteger = /^\d+$/.test(cleanId);

      const result = await client.query(
        `
        SELECT lt.*, t.id as test_id, t.title, t.total_questions, t.duration, t.instructions,
               t.public_id, t.slug, t.start_time as test_start_time, t.end_time as test_end_time,
               t.scheduled_at as test_scheduled_at, ts.title as series_name
        FROM tests t
        LEFT JOIN live_tests lt ON lt.test_id = t.id
        LEFT JOIN test_series ts ON ts.id = t.series_id
        WHERE t.public_id = $1 
           OR t.public_id = $2
           OR t.slug = $1
           OR (t.public_id_uuid IS NOT NULL AND t.public_id_uuid::text = $2)
           OR ($3::boolean = true AND (t.id = $4::integer OR (lt.id IS NOT NULL AND lt.id = $4::integer)))
        ORDER BY lt.id DESC NULLS LAST
        LIMIT 1
      `,
        [cleanId, rawUuid, isInteger, isInteger ? parseInt(cleanId, 10) : 0],
      );

      if (result.rows[0]) {
        const row = result.rows[0];
        return {
          ...row,
          test_id: row.test_id,
          start_time:
            row.start_time || row.test_start_time || row.test_scheduled_at,
          end_time: row.end_time || row.test_end_time,
          max_participants: row.max_participants || 50000,
        };
      }

      return null;
    } finally {
      client.release();
    }
  },

  /**
   * Register user for live test.
   */
  async register(userId, liveTestId) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const session = await this.getById(liveTestId);
      if (!session) throw new Error("Live test not found");

      // Check if already registered for this test
      const existing = await client.query(
        `SELECT id FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_active = true`,
        [userId, session.test_id],
      );

      if (existing.rows.length > 0) {
        return { action: "already_registered", attemptId: existing.rows[0].id };
      }

      // Check capacity
      const participantCount = await client.query(
        `SELECT COUNT(*) as count FROM attempts WHERE test_id = $1 AND is_active = true`,
        [session.test_id],
      );

      if (participantCount.rows[0].count >= session.max_participants) {
        throw new Error("Live test is full");
      }

      // Create attempt
      const result = await client.query(
        `INSERT INTO attempts (
          user_id, test_id, status, is_active, started_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'not_started', true, NOW(), NOW(), NOW()
        ) RETURNING id`,
        [userId, session.test_id],
      );

      return { action: "registered", attemptId: result.rows[0].id };
    } finally {
      client.release();
    }
  },

  /**
   * Start live test attempt.
   */
  async startAttempt(userId, liveTestId) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const session = await this.getById(liveTestId);
      if (!session) throw new Error("Live test not found");

      // Check if test has started
      if (new Date(session.start_time) > new Date()) {
        throw new Error("Live test has not started yet");
      }

      // Get or create attempt
      let attempt = await client.query(
        `SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_active = true`,
        [userId, session.test_id],
      );

      if (attempt.rows.length === 0) {
        // Auto-register and start
        const regResult = await this.register(userId, liveTestId);
        attempt = await client.query(
          `SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE id = $1`,
          [regResult.attemptId],
        );
      }

      // Update status to in_progress
      await client.query(
        `UPDATE attempts SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [attempt.rows[0].id],
      );

      // Get questions
      const questions = await client.query(
        `
        SELECT q.id, q.question_text, q.options, q.marks, q.negative_marks,
               q.difficulty, q.question_type
        FROM test_questions tq
        JOIN questions q ON q.id = tq.question_id
        WHERE tq.test_id = $1
        ORDER BY tq.question_number
      `,
        [session.test_id],
      );

      return {
        attemptId: attempt.rows[0].id,
        questions: questions.rows,
        duration: session.duration,
        startTime: session.start_time,
        endTime: session.end_time,
      };
    } finally {
      client.release();
    }
  },

  /**
   * Get live leaderboard.
   */
  /**
   * Save in-progress answer during live test.
   */
  async saveAnswer(userId, liveTestId, data) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const session = await this.getById(liveTestId);
      const targetTestId = session ? session.test_id : liveTestId;

      // Find in-progress attempt
      const attempt = await client.query(
        `SELECT id, answers FROM attempts 
         WHERE user_id = $1 AND test_id = $2 AND is_active = true 
         ORDER BY id DESC LIMIT 1`,
        [userId, targetTestId],
      );

      if (attempt.rows.length === 0) {
        return { success: false, message: "No active attempt found" };
      }

      let currentAnswers = {};
      try {
        if (
          typeof attempt.rows[0].answers === "object" &&
          attempt.rows[0].answers !== null
        ) {
          currentAnswers = attempt.rows[0].answers;
        } else if (typeof attempt.rows[0].answers === "string") {
          currentAnswers = JSON.parse(attempt.rows[0].answers);
        }
      } catch {
        currentAnswers = {};
      }

      if (data.questionId !== undefined) {
        currentAnswers[data.questionId] =
          data.selectedOption !== undefined ? data.selectedOption : data.answer;
      } else if (data.answers && typeof data.answers === "object") {
        Object.assign(currentAnswers, data.answers);
      }

      await client.query(
        `UPDATE attempts SET answers = $1, last_activity = NOW(), updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(currentAnswers), attempt.rows[0].id],
      );

      return { success: true, message: "Answer saved" };
    } finally {
      client.release();
    }
  },

  /**
   * Get live leaderboard.
   */
  async getLeaderboard(liveTestId) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const session = await this.getById(liveTestId);
      const targetTestId = session ? session.test_id : liveTestId;

      const result = await client.query(
        `
        SELECT
          a.user_id,
          u.name as user_name,
          u.avatar_url,
          a.score,
          a.total_marks,
          CASE WHEN a.total_marks > 0
            THEN ROUND(a.score / a.total_marks * 100, 2)
            ELSE 0
          END as percentage,
          a.correct,
          a.wrong,
          a.time_spent,
          RANK() OVER (ORDER BY a.score DESC, a.time_spent ASC) as rank
        FROM attempts a
        JOIN users u ON u.id = a.user_id
        WHERE (a.test_id = $1 OR a.test_id = $2)
          AND a.is_active = true
          AND a.status = 'completed'
        ORDER BY a.score DESC, a.time_spent ASC
        LIMIT 100
      `,
        [targetTestId, liveTestId],
      );

      return result.rows;
    } finally {
      client.release();
    }
  },

  /**
   * Submit live test attempt.
   */
  async submitAttempt(userId, liveTestId, answers = {}) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const session = await this.getById(liveTestId);
      if (!session) throw new Error("Live test not found");

      // Get attempt
      const attempt = await client.query(
        `SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_active = true`,
        [userId, session.test_id],
      );

      if (attempt.rows.length === 0) {
        throw new Error("No active attempt found");
      }

      // Get correct answers
      const questions = await client.query(
        `SELECT q.id, q.correct_option, q.marks, q.negative_marks
         FROM test_questions tq
         JOIN questions q ON q.id = tq.question_id
         WHERE tq.test_id = $1`,
        [session.test_id],
      );

      // Calculate score
      let score = 0;
      let correct = 0;
      let wrong = 0;
      let skipped = 0;

      for (const question of questions.rows) {
        const userAnswer = answers ? answers[question.id] : undefined;
        if (userAnswer === undefined || userAnswer === null) {
          skipped++;
        } else if (Number(userAnswer) === Number(question.correct_option)) {
          score += Number(question.marks || 1);
          correct++;
        } else {
          score -= Number(question.negative_marks ?? 0.5);
          wrong++;
        }
      }

      const totalMarks = questions.rows.reduce(
        (sum, q) => sum + Number(q.marks || 1),
        0,
      );

      // Update attempt
      await client.query(
        `UPDATE attempts SET
          status = 'completed',
          score = $1,
          total_marks = $2,
          correct = $3,
          wrong = $4,
          unattempted = $5,
          time_spent = EXTRACT(EPOCH FROM (NOW() - started_at)),
          completed_at = NOW(),
          submitted_at = NOW(),
          updated_at = NOW()
         WHERE id = $6`,
        [
          Number(score.toFixed(2)),
          totalMarks,
          correct,
          wrong,
          skipped,
          attempt.rows[0].id,
        ],
      );

      await client.query("COMMIT");

      return {
        attemptId: attempt.rows[0].id,
        score: Number(score.toFixed(2)),
        correct,
        wrong,
        skipped,
        totalMarks,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get live test results.
   */
  async getResults(userId, liveTestId) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const session = await this.getById(liveTestId);
      const targetTestId = session ? session.test_id : liveTestId;

      const result = await client.query(
        `
        SELECT
          a.*,
          t.title as test_title,
          lt.result_time,
          RANK() OVER (ORDER BY a.score DESC, a.time_spent ASC) as rank,
          COUNT(*) OVER () as total_participants
        FROM attempts a
        JOIN tests t ON t.id = a.test_id
        LEFT JOIN live_tests lt ON lt.test_id = a.test_id
        WHERE a.user_id = $1
          AND (a.test_id = $2 OR lt.id = $3)
          AND a.is_active = true
        ORDER BY a.id DESC
        LIMIT 1
      `,
        [userId, targetTestId, liveTestId],
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  },
};

export default liveMockService;
