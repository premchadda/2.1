import { TestRepository } from "./test.repository.js";
import { createSchema } from "../../middleware/validation/inputValidation.js";
import { testStateMachine } from "../../services/core/testStateMachine.js";

const repo = new TestRepository();

export const testSchema = createSchema()
  .field("title", { type: "string", required: true, minLength: 2, maxLength: 200 })
  .field("slug", { type: "string", required: false, maxLength: 250 })
  .field("description", { type: "string", required: false, maxLength: 2000 })
  .field("duration", { type: "integer", required: false, min: 1 })
  .field("total_marks", { type: "integer", required: false, min: 0 })
  .field("totalMarks", { type: "integer", required: false, min: 0 })
  .field("total_questions", { type: "integer", required: false, min: 0 })
  .field("totalQuestions", { type: "integer", required: false, min: 0 })
  .field("negative_marking", { type: "number", required: false })
  .field("negativeMarking", { type: "number", required: false })
  .field("passing_marks", { type: "integer", required: false, min: 0 })
  .field("is_pro", { type: "boolean", required: false })
  .field("isPro", { type: "boolean", required: false })
  .field("is_coming_soon", { type: "boolean", required: false })
  .field("isComingSoon", { type: "boolean", required: false })
  .field("is_live", { type: "boolean", required: false })
  .field("isLive", { type: "boolean", required: false })
  .field("series_id", { type: "id", required: false })
  .field("seriesId", { type: "id", required: false })
  .field("test_series_id", { type: "id", required: false })
  .field("testSeriesId", { type: "id", required: false })
  .field("stage_id", { type: "id", required: false })
  .field("stageId", { type: "id", required: false })
  .field("test_category_id", { type: "id", required: false })
  .field("testCategoryId", { type: "id", required: false })
  .field("exam_id", { type: "string", required: false, maxLength: 255 })
  .field("examId", { type: "string", required: false, maxLength: 255 })
  .field("category", { type: "string", required: false, maxLength: 255 })
  .field("type", { type: "string", required: false, maxLength: 255 })
  .field("difficulty", { type: "string", required: false, maxLength: 50 })
  .field("tags", { type: "array", required: false })
  .field("stageIds", { type: "array", required: false })
  .field("stage_ids", { type: "array", required: false })
  .field("sectionIds", { type: "array", required: false })
  .field("section_ids", { type: "array", required: false })
  .field("banner_asset_id", { type: "id", required: false })
  .field("bannerAssetId", { type: "id", required: false })
  .field("promotion_banner_asset_id", { type: "id", required: false })
  .field("promotionBannerAssetId", { type: "id", required: false })
  .field("status", { type: "string", required: false, maxLength: 50 });

export const testService = {
  async list(query = {}) {
    return repo.findWithDetails(query);
  },

  async getById(id) {
    return repo.findByIdentifier(id);
  },

  async create(data) {
    const payload = normalizePayload(data);
    const test = await repo.insert(payload);

    if (data.sectionIds?.length > 0) {
      await repo.linkSections(test.id, data.sectionIds);
    }
    return test;
  },

  async update(id, data) {
    const test = await repo.findByIdentifier(id);
    if (!test) return null;

    const payload = normalizePayload(data);
    const updated = await repo.update(test.id, payload);

    if (data.sectionIds !== undefined) {
      await repo.unlinkSections(test.id);
      if (data.sectionIds.length > 0) {
        await repo.linkSections(test.id, data.sectionIds);
      }
    }
    return updated;
  },

  async remove(id, userId) {
    const test = await repo.findByIdentifier(id);
    if (!test) return null;

    await repo.flagOrphanedQuestions(test.id, userId);
    await repo.unlinkQuestions(test.id);
    await repo.flagOrphanedAttempts(test.id);
    return repo.softDelete(test.id, userId);
  },

  async duplicate(id) {
    const test = await repo.findByIdentifier(id);
    if (!test) return null;

    const clone = {
      ...test,
      title: `${test.title} (Copy)`,
      slug: `${test.slug}-copy-${Date.now()}`,
      isActive: false,
      status: "draft",
    };
    delete clone.id;
    delete clone._id;
    delete clone.created_at;
    delete clone.updated_at;

    return repo.insert(clone);
  },

  async transitionState(id, to, userId = null) {
    const test = await repo.findByIdentifier(id);
    if (!test) return { error: "Test not found" };

    const from = test.status || 'draft'
    if (!testStateMachine.canTransition(from, to)) {
      return { error: `Cannot transition from '${from}' to '${to}'` }
    }

    const questions = ['published', 'live', 'scheduled'].includes(to) ? await repo.getQuestions(test.id) : []
    const guardError = testStateMachine.validateTransition(test, to, questions)
    if (guardError) return { error: guardError }

    const timestamp = new Date().toISOString()
    const timestampField = `${to}_at`
    const updateData = {
      status: to,
      stateUpdatedBy: userId,
      [timestampField]: timestamp,
    }

    const updated = await repo.update(test.id, updateData)
    await repo.syncStats(test.id)
    return updated
  },

  async publish(id, userId = null) {
    return this.transitionState(id, 'published', userId)
  },

  async restore(id) {
    return repo.db.restoreFromTrash(id);
  },

  async getQuestions(testId) {
    return repo.getQuestions(testId);
  },

  async getLeaderboard(testId) {
    return repo.getLeaderboard(testId);
  },
};

function normalizePayload(data) {
  const seriesId = data.testSeriesId ?? data.test_series_id ?? data.seriesId ?? data.series_id;
  return {
    ...data,
    slug: data.slug || `${(data.title || "test").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Date.now()}`,
    seriesId,
    series_id: seriesId,
    status: data.status || "draft",
  };
}
