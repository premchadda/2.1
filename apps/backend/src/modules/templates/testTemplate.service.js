import TestTemplate from "../../data/models/test/TestTemplate.js";

const testTemplateService = {
  async list(query = {}) {
    return TestTemplate.find(query);
  },

  async getById(id) {
    return TestTemplate.findByIdentifier(id);
  },

  async getActive() {
    return TestTemplate.findActive();
  },

  async getSystemTemplates() {
    return TestTemplate.findSystemTemplates();
  },

  async getByExamId(examId) {
    return TestTemplate.findByExamId(examId);
  },

  async getByStageId(stageId) {
    return TestTemplate.findByStageId(stageId);
  },

  async create(data) {
    if (!data.name) throw new Error("Template name is required");
    if (!data.configJson && !data.totalQuestions) {
      throw new Error("Either configJson or totalQuestions is required");
    }
    return TestTemplate.create(data);
  },

  async update(id, data) {
    const existing = await TestTemplate.findByIdentifier(id);
    if (!existing) throw new Error("Template not found");
    return TestTemplate.updateById(existing.id, data);
  },

  async remove(id) {
    const existing = await TestTemplate.findByIdentifier(id);
    if (!existing) throw new Error("Template not found");
    if (existing.isSystem) throw new Error("Cannot delete system templates");
    return TestTemplate.deleteById(existing.id);
  },

  async duplicate(id) {
    const existing = await TestTemplate.findByIdentifier(id);
    if (!existing) throw new Error("Template not found");
    return TestTemplate.create({
      ...existing,
      name: `${existing.name} (Copy)`,
      isSystem: false,
      usageCount: 0,
    });
  },

  async incrementUsage(id) {
    return TestTemplate.incrementUsageCount(id);
  },

  async generateTestFromTemplate(templateId, testData) {
    const template = await TestTemplate.findByIdentifier(templateId);
    if (!template) throw new Error("Template not found");

    const config = template.configJson;
    await TestTemplate.incrementUsageCount(template.id);

    return {
      title: testData.title || `Test from ${template.name}`,
      description: testData.description || template.description,
      examId: testData.examId || template.examId,
      stageId: testData.stageId || template.stageId,
      subjectId: testData.subjectId || template.subjectId,
      duration: config.duration || template.duration,
      totalMarks: config.totalMarks || template.totalMarks,
      negativeMarking: config.negativeMarking ?? 0.5,
      difficulty: config.difficulty || template.difficulty,
      shuffleQuestions: config.shuffleQuestions || false,
      shuffleOptions: config.shuffleOptions || false,
      sections: config.sections || [],
      status: "draft",
    };
  },

  async count(query = {}) {
    return TestTemplate.count(query);
  },
};

export default testTemplateService;
