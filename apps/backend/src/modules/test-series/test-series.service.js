import { TestSeriesRepository } from "./test-series.repository.js";
import { createSchema } from "../../middleware/validation/inputValidation.js";

const repo = new TestSeriesRepository();

export const testSeriesSchema = createSchema()
  .field("name", { type: "string", required: true, minLength: 2, maxLength: 200 })
  .field("title", { type: "string", required: false, minLength: 2, maxLength: 200 })
  .field("slug", { type: "string", required: false, maxLength: 200 })
  .field("description", { type: "string", required: false, maxLength: 2000 })
  .field("is_pro", { type: "boolean", required: false })
  .field("stages", { type: "array", required: false })
  .field("category", { type: "string", required: false, maxLength: 100 })
  .field("examId", { type: "string", required: false, maxLength: 100 })
  .field("exam_id", { type: "string", required: false, maxLength: 100 })
  .field("price", { type: "integer", required: false, min: 0 })
  .field("difficulty", { type: "string", required: false, maxLength: 50 })
  .field("tags", { type: "array", required: false })
  .field("is_active", { type: "boolean", required: false })
  .field("is_pinned", { type: "boolean", required: false })
  .field("total_tests", { type: "integer", required: false, min: 0 });

export const testSeriesService = {
  async list(query = {}) {
    return repo.findWithTestCounts(query);
  },

  async getById(id) {
    return repo.findByIdentifier(id);
  },

  async create(data, userId) {
    const maxOrder = await repo.getMaxOrder();
    const examId = data.examId || data.exam_id || "";

    const payload = {
      ...data,
      name: data.name || data.title || "",
      exam_id: examId,
      examId: examId,
      stages: Array.isArray(data.stages) ? data.stages : [],
      display_order: maxOrder + 1,
      is_pinned: false,
    };

    const series = await repo.insert(payload);

    if (data.categoryIds?.length > 0) {
      await repo.linkCategories(series.id, data.categoryIds);
    }

    return series;
  },

  async update(id, data) {
    const series = await repo.findByIdentifier(id);
    if (!series) return null;

    const payload = {
      ...data,
      name: data.name || data.title || series.name,
    };

    const updated = await repo.update(series.id, payload);

    if (data.categoryIds !== undefined) {
      await repo.unlinkCategories(series.id);
      if (data.categoryIds.length > 0) {
        await repo.linkCategories(series.id, data.categoryIds);
      }
    }

    return updated;
  },

  async remove(id, userId) {
    const series = await repo.findByIdentifier(id);
    if (!series) return null;

    await repo.unlinkCategories(series.id);
    await repo.flagOrphanedTests(series.id, userId);
    return repo.softDelete(series.id, userId);
  },

  async restore(id) {
    return repo.db.restoreFromTrash(id);
  },
};
