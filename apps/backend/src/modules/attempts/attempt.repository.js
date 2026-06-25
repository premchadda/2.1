import { BaseRepository } from "../../infrastructure/repository/base.repository.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";

export class AttemptRepository extends BaseRepository {
  constructor() {
    super("attempts");
  }

  async findActiveByUserAndTest(userId, testId) {
    return this.findOne({ userId, testId, isCompleted: false });
  }

  async findCompletedByUserAndTest(userId, testId) {
    return this.find({ userId, testId, isCompleted: true });
  }

  async getLatestByUserAndTest(userId, testId) {
    const rows = await this.queryRaw(
      `SELECT * FROM attempts WHERE user_id = $1 AND test_id = $2 AND is_completed = true
       ORDER BY submitted_at DESC LIMIT 1`,
      [userId, testId]
    );
    return rows[0] || null;
  }

  async saveAnswers(attemptId, answers) {
    await this.executeRaw("DELETE FROM attempt_answers WHERE attempt_id = $1", [attemptId]);
    for (const ans of answers) {
      const selectedOptionId = ans.selectedOptionId ?? ans.selectedOption ?? ans.selected_option_id ?? ans.selected_option ?? null;
      const timeSpentVal = ans.timeSpent ?? ans.time_spent ?? 0;
      await this.executeRaw(
        `INSERT INTO attempt_answers
          (attempt_id, question_id, selected_option_id, selected_option,
           is_correct, time_spent, time_spent_seconds,
           visits_count, is_marked_for_review, is_unattempted, created_at)
         VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, $8, NOW())`,
        [
          attemptId,
          ans.questionId,
          selectedOptionId,
          ans.isCorrect ?? ans.is_correct ?? null,
          timeSpentVal,
          ans.visits ?? 0,
          ans.markedForReview ?? ans.is_marked_for_review ?? false,
          ans.isUnattempted ?? ans.is_unattempted ?? false,
        ]
      );
    }
  }

  async saveSectionScores(attemptId, sectionScores) {
    await this.executeRaw("DELETE FROM attempt_section_scores WHERE attempt_id = $1", [attemptId]);
    for (const [sectionId, data] of Object.entries(sectionScores)) {
      await this.executeRaw(
        `INSERT INTO attempt_section_scores (attempt_id, section_id, score, total_marks, correct, wrong, unattempted, time_spent_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          attemptId,
          sectionId,
          data.score || 0,
          data.totalMarks || 0,
          data.correct || 0,
          data.wrong || 0,
          data.unattempted || 0,
          data.timeSpent || 0,
        ]
      );
    }
  }

  async getAnswers(attemptId) {
    return this.queryRaw(
      "SELECT * FROM attempt_answers WHERE attempt_id = $1 ORDER BY id",
      [attemptId]
    );
  }

  async getSectionScores(attemptId) {
    return this.queryRaw(
      "SELECT * FROM attempt_section_scores WHERE attempt_id = $1 ORDER BY id",
      [attemptId]
    );
  }

  async getCompletedAttempts(testId = null) {
    let sql = "SELECT * FROM attempts WHERE is_completed = true";
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
