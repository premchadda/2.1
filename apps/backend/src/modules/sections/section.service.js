import { SectionRepository } from "./section.repository.js";

const repo = new SectionRepository();

export const sectionService = {
  async list(testId = null) {
    if (testId) return repo.findByTestId(testId);
    return repo.findActive();
  },

  async getById(id) {
    return repo.findById(id);
  },

  async create(data) {
    return repo.insert({
      name: data.name,
      categoryId: data.category_id || data.categoryId,
      testId: data.test_id || data.testId,
      description: data.description,
      duration: data.duration || 900,
      passingMarks: data.passing_marks || data.passingMarks || 0,
      displayOrder: data.display_order || data.displayOrder || 0,
      marksPerQuestion: data.marks_per_question ?? 2,
      negativeMarks: data.negative_marks ?? 0.5,
      timeLimit: data.time_limit || data.timeLimit || 900,
      isLocked: data.is_locked || data.isLocked || false,
      instructions: data.instructions || "",
      difficulty: data.difficulty || "medium",
      shuffleQuestions: data.shuffle_questions || data.shuffleQuestions || false,
      shuffleOptions: data.shuffle_options || data.shuffleOptions || false,
      expectedQuestions: data.expected_questions || data.expectedQuestions || 0,
      totalMarks: data.total_marks || data.totalMarks || 0,
      examStage: data.exam_stage || data.examStage || null,
      paper: data.paper || null,
      session: data.session || null,
      sectionCode: data.section_code || data.sectionCode || null,
      isQualifying: data.is_qualifying || data.isQualifying || false,
      isActive: data.is_active !== false,
    });
  },

  async update(id, data) {
    const existing = await repo.findById(id);
    if (!existing) return null;
    return repo.update(id, data);
  },

  async remove(id, userId) {
    const existing = await repo.findById(id);
    if (!existing) return null;
    await repo.unlinkFromTest(id);
    return repo.softDelete(id, userId);
  },

  async restore(id) {
    return repo.db.restoreFromTrash(id);
  },
};
