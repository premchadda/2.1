import { BaseRepository } from "../../infrastructure/repository/base.repository.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";

export class TestSeriesRepository extends BaseRepository {
  constructor() {
    super("testSeries");
  }

  async findByIdentifier(identifier) {
    const { TestSeries } = await import("../../data/models/index.js");
    return TestSeries.findByIdentifier(identifier);
  }

  async findWithTestCounts(query = {}) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (query.isActive !== undefined) {
      conditions.push(`ts.is_active = $${idx++}`);
      params.push(query.isActive);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT ts.*,
        (SELECT COUNT(*) FROM tests t WHERE t.series_id = ts.id AND t.is_active = true) as test_count,
        (SELECT COUNT(*) FROM attempts a JOIN tests t ON a.test_id = t.id WHERE t.series_id = ts.id) as attempt_count
      FROM test_series ts
      ${whereClause}
      ORDER BY ts.display_order, ts.id
    `;
    return this.queryRaw(sql, params);
  }

  async linkCategories(seriesId, categoryIds) {
    for (const catId of categoryIds) {
      await this.executeRaw(
        "INSERT INTO test_category_series (test_category_id, test_series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [catId, seriesId]
      );
    }
  }

  async unlinkCategories(seriesId) {
    await this.executeRaw("DELETE FROM test_category_series WHERE test_series_id = $1", [seriesId]);
  }

  async flagOrphanedTests(seriesId, deletedBy) {
    const tests = await this.find("tests", { seriesId, isActive: true });
    for (const test of tests) {
      await this.update("tests", test.id, {
        _orphaned: true,
        _deletedSeriesId: seriesId,
        orphanedAt: new Date().toISOString(),
      });
    }
    return tests.length;
  }

  async getMaxOrder() {
    const row = await this.queryOneRaw("SELECT COALESCE(MAX(display_order), 0) as max_order FROM test_series");
    return row?.max_order || 0;
  }
}
