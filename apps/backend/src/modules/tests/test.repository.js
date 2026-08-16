import { BaseRepository } from "../../infrastructure/repository/base.repository.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";

export class TestRepository extends BaseRepository {
  constructor() {
    super("tests");
  }

  async findByIdentifier(identifier) {
    const { Test } = await import("../../data/models/index.js");
    return Test.findByIdentifier(identifier);
  }

  async findPublished() {
    return this.find({ isActive: true, status: "published" });
  }

  async findBySeries(seriesId) {
    return this.find({ seriesId, isActive: true });
  }

  async findOrphaned() {
    return this.find({ _orphaned: true, isActive: true });
  }

  async findWithDetails(query = {}) {
    const conditions = ["t.is_active = true"];
    const params = [];
    let idx = 1;

    if (query.seriesId) {
      conditions.push(`t.series_id = $${idx++}`);
      params.push(query.seriesId);
    }
    if (query.status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(query.status);
    }

    const sql = `
      SELECT t.*,
        ts.title as series_name,
        ts.slug as series_slug,
        (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id) as linked_question_count,
        (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id AND a.is_completed = true) as attempt_count
      FROM tests t
      LEFT JOIN test_series ts ON t.series_id = ts.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.created_at DESC
    `;
    return this.queryRaw(sql, params);
  }

  async getQuestions(testId) {
    return this.queryRaw(
      `SELECT q.*, tq.marks as junction_marks, tq.negative_marks as junction_neg_marks,
              tq.order_index, tq.section_id
       FROM questions q
       JOIN test_questions tq ON q.id = tq.question_id
       WHERE tq.test_id = $1 AND q.is_active = true
       ORDER BY tq.order_index`,
      [testId]
    );
  }

  async linkQuestions(testId, questionIds, sectionId = null) {
    if (questionIds.length === 0) return;
    const orderIndices = questionIds.map((_, i) => i);
    await this.executeRaw(
      `INSERT INTO test_questions (test_id, question_id, section_id, order_index, created_at)
       SELECT $1, qid, $2, idx, NOW()
       FROM unnest($3::int[], $4::int[]) AS t(qid, idx)
       ON CONFLICT DO NOTHING`,
      [testId, sectionId, questionIds, orderIndices]
    );
  }

  async unlinkQuestions(testId) {
    await this.executeRaw("DELETE FROM test_questions WHERE test_id = $1", [testId]);
  }

  async linkSections(testId, sectionIds) {
    if (sectionIds.length > 0) {
      await this.executeRaw(
        "UPDATE test_sections SET test_id = $1 WHERE id = ANY($2::int[])",
        [testId, sectionIds]
      );
    }
  }

  async unlinkSections(testId) {
    await this.executeRaw("UPDATE test_sections SET test_id = NULL WHERE test_id = $1", [testId]);
  }

  async flagOrphanedAttempts(testId) {
    await this.executeRaw(
      "UPDATE attempts SET series_id = NULL WHERE test_id = $1 AND is_completed = false",
      [testId]
    );
  }

  async flagOrphanedQuestions(testId, deletedBy) {
    const questions = await this.queryRaw(
      "SELECT q.id FROM questions q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1 AND q.is_active = true",
      [testId]
    );
    for (const q of questions) {
      await this.update("questions", q.id, {
        _orphaned: true,
        _deletedTestId: testId,
        orphanedAt: new Date().toISOString(),
      });
    }
    return questions.length;
  }

  async syncStats(testId) {
    const stats = await this.queryOneRaw(
      `SELECT COUNT(*) as q_count, COALESCE(SUM(COALESCE(marks, 0)), 0) as total_marks
       FROM questions q
       JOIN test_questions tq ON q.id = tq.question_id
       WHERE tq.test_id = $1 AND q.is_active = true`,
      [testId]
    );
    await this.executeRaw(
      "UPDATE tests SET total_questions = $1, total_marks = $2 WHERE id = $3",
      [parseInt(stats.q_count), parseFloat(stats.total_marks || 0), testId]
    );
  }

  async getLeaderboard(testId) {
    return this.queryRaw(
      `SELECT a.user_id, u.name, u.avatar,
              MAX(a.score) as best_score,
              MIN(a.time_spent) as best_time,
              COUNT(*) as attempt_count
       FROM attempts a
       JOIN users u ON a.user_id = u.id
       WHERE a.test_id = $1 AND a.is_completed = true
       GROUP BY a.user_id, u.name, u.avatar
       ORDER BY best_score DESC, best_time ASC`,
      [testId]
    );
  }
}
