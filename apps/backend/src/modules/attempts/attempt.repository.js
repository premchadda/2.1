import { BaseRepository } from "../../infrastructure/repository/base.repository.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { qb, snakeToCamel } from "../../infrastructure/database/qb.js";

export class AttemptRepository extends BaseRepository {
  constructor() {
    super("attempts");
  }

  // PILOT: demonstrate the qb query-builder alongside dbHelpers. Behavior is
  // unchanged (returns camelCase row); the other methods still use dbHelpers.
  async findActiveByUserAndTest(userId, testId) {
    const row = await qb("attempts")
      .where({ user_id: userId, test_id: testId, is_completed: false })
      .orderBy("id", "ASC")
      .limit(1)
      .first();
    return snakeToCamel(row);
  }

  async findCompletedByUserAndTest(userId, testId) {
    return this.find({ userId, testId, isCompleted: true });
  }

  async getLatestByUserAndTest(userId, testId) {
    const rows = await this.queryRaw(
      `SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_completed = true
       ORDER BY submitted_at DESC LIMIT 1`,
      [userId, testId]
    );
    return rows[0] || null;
  }

  async saveAnswers(attemptId, answers, client = null) {
    const exec = (sql, params) => (client ? client.query(sql, params) : this.executeRaw(sql, params));
    await exec("DELETE FROM attempt_answers WHERE attempt_id = $1", [attemptId]);
    if (!answers || answers.length === 0) return;

    // PERF FIX (H12): batch all answers into a single multi-row INSERT instead
    // of one round-trip per answer (previously ~100 queries for a 100-question
    // test). Each row contributes 8 parameters.
    const COLS_PER_ROW = 8;
    const params = [];
    const groups = answers.map((ans, idx) => {
      const b = idx * COLS_PER_ROW;
      const selectedOptionId = ans.selectedOptionId ?? ans.selectedOption ?? ans.selected_option_id ?? ans.selected_option ?? null;
      const timeSpentVal = ans.timeSpent ?? ans.time_spent ?? 0;
      params.push(
        attemptId,
        ans.questionId,
        selectedOptionId,
        ans.isCorrect ?? ans.is_correct ?? null,
        timeSpentVal,
        ans.visits ?? 0,
        ans.markedForReview ?? ans.is_marked_for_review ?? false,
        ans.isUnattempted ?? ans.is_unattempted ?? false,
      );
      // selected_option reuses $selectedOptionId; time_spent_seconds reuses $timeSpent.
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, NOW())`;
    });

    await exec(
      `INSERT INTO attempt_answers
        (attempt_id, question_id, selected_option_id, selected_option,
         is_correct, time_spent, time_spent_seconds,
         visits_count, is_marked_for_review, is_unattempted, created_at)
       VALUES ${groups.join(", ")}`,
      params
    );
  }

  async saveSectionScores(attemptId, sectionScores, client = null) {
    const exec = (sql, params) => (client ? client.query(sql, params) : this.executeRaw(sql, params));
    await exec("DELETE FROM attempt_section_scores WHERE attempt_id = $1", [attemptId]);
    const entries = Object.entries(sectionScores || {});
    if (entries.length === 0) return;

    // PERF FIX (H12): single multi-row INSERT instead of one query per section.
    const COLS_PER_ROW = 8;
    const params = [];
    const groups = entries.map(([sectionId, data], idx) => {
      const b = idx * COLS_PER_ROW;
      params.push(
        attemptId,
        sectionId,
        data.score || 0,
        data.totalMarks || 0,
        data.correct || 0,
        data.wrong || 0,
        data.unattempted || 0,
        data.timeSpent || 0,
      );
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
    });

    await exec(
      `INSERT INTO attempt_section_scores (attempt_id, section_id, score, total_marks, correct, wrong, unattempted, time_spent_seconds)
       VALUES ${groups.join(", ")}`,
      params
    );
  }

  async getAnswers(attemptId) {
    return this.queryRaw(
      "SELECT id, attempt_id, question_id, selected_option_id, selected_option, is_correct, is_unattempted, is_marked_for_review, time_spent, time_spent_seconds, visits_count, section, metadata, created_at, updated_at FROM attempt_answers WHERE attempt_id = $1 ORDER BY id",
      [attemptId]
    );
  }

  async getSectionScores(attemptId) {
    return this.queryRaw(
      "SELECT id, attempt_id, section_id, correct, incorrect, wrong, skipped, unattempted, score, marks, negative_marks, total_marks, time_spent_seconds, is_active, created_at, updated_at FROM attempt_section_scores WHERE attempt_id = $1 ORDER BY id",
      [attemptId]
    );
  }

  async getCompletedAttempts(testId = null) {
    let sql = "SELECT id, user_id, test_id, series_id, status, score, total_marks, time_taken, is_completed, is_reattempt, is_active, started_at, submitted_at, completed_at, last_activity, last_question_id, marked_for_review, question_results, solutions, section_scores, section_times, section_timers, percentile, rank, attempted, incorrect, skipped, created_at, updated_at FROM attempts WHERE is_completed = true";
    const params = [];
    if (testId) {
      sql += " AND test_id = $1";
      params.push(testId);
    }
    sql += " ORDER BY submitted_at DESC";
    return this.queryRaw(sql, params);
  }

  async countByUserAndTest(userId, testId) {
    const row = await this.queryOneRaw(
      "SELECT COUNT(*) as cnt FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_completed = true",
      [userId, testId]
    );
    return parseInt(row?.cnt || 0);
  }

  async logEvent(attemptId, eventType, eventData = {}) {
    await this.executeRaw(
      `INSERT INTO attempt_events (attempt_id, event_type, event_data, event_timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [attemptId, eventType, JSON.stringify(eventData)]
    );
  }

  async getAttemptCount() {
    const row = await this.queryOneRaw("SELECT COUNT(*) as cnt FROM attempts");
    return parseInt(row?.cnt || 0);
  }
}
