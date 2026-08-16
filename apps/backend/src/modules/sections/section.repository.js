import { BaseRepository } from "../../infrastructure/repository/base.repository.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";

export class SectionRepository extends BaseRepository {
  constructor() {
    super("test_sections");
  }

  async findByTestId(testId) {
    return this.queryRaw(
      `SELECT ts.*,
              (SELECT COUNT(*)::int FROM questions q
               JOIN test_questions tq ON q.id = tq.question_id
               WHERE tq.section_id = ts.id AND q.is_active = true) as question_count
       FROM test_sections ts
       WHERE ts.test_id = $1 OR ts.test_id IS NULL
       ORDER BY ts.display_order, ts.id`,
      [testId]
    );
  }

  async linkToTest(sectionId, testId) {
    await this.executeRaw("UPDATE test_sections SET test_id = $1 WHERE id = $2", [testId, sectionId]);
  }

  async unlinkFromTest(testId) {
    await this.executeRaw("UPDATE test_sections SET test_id = NULL WHERE test_id = $1", [testId]);
  }

  async bulkLinkToTest(sectionIds, testId) {
    if (sectionIds.length > 0) {
      await this.executeRaw(
        "UPDATE test_sections SET test_id = $1 WHERE id = ANY($2::int[])",
        [testId, sectionIds]
      );
    }
  }
}
