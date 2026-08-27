/**
 * Test Builder Service
 *
 * Provides comprehensive test creation and management:
 * - Create tests from templates
 * - Create tests from scratch
 * - Add/remove questions to tests
 * - Configure sections and timing
 * - Preview test before publishing
 * - Clone existing tests
 */

import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import Test from "../../data/models/test/Test.js";
import TestTemplate from "../../data/models/test/TestTemplate.js";

const testBuilderService = {
  /**
   * Create a new test from scratch.
   */
  async create(data) {
    const validation = this.validate(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    const slug = data.slug || this.generateSlug(data.title);

    const testData = {
      title: data.title,
      slug,
      description: data.description || null,
      duration: data.duration || 60,
      totalMarks: data.totalMarks || data.total_marks || 0,
      totalQuestions: data.totalQuestions || data.total_questions || 0,
      negativeMarking: data.negativeMarking ?? data.negative_marking ?? 0.5,
      passingMarks: data.passingMarks ?? data.passing_marks ?? 0,
      difficulty: data.difficulty || "Medium",
      isPro: data.isPro !== undefined ? data.isPro : true,
      isActive: data.isActive !== undefined ? data.isActive : true,
      status: "draft",
      category: data.category || null,
      subcategory: data.subcategory || null,
      tags: data.tags || [],
      languages: data.languages || ["en"],
      stageIds: data.stageIds || data.stage_ids || [],
      seriesId: data.seriesId || data.series_id || null,
      stageId: data.stageId || data.stage_id || null,
      subjectId: data.subjectId || data.subject_id || null,
      testCategoryId: data.testCategoryId || data.test_category_id || null,
      examId: data.examId || data.exam_id || null,
      instructions: data.instructions || null,
      testType: data.testType || data.test_type || null,
      shuffleQuestions:
        data.shuffleQuestions || data.shuffle_questions || false,
      shuffleOptions: data.shuffleOptions || data.shuffle_options || false,
      allowReview: data.allowReview !== undefined ? data.allowReview : true,
      maxAttempts: data.maxAttempts || data.max_attempts || 0,
      aiExplanationEnabled:
        data.aiExplanationEnabled ?? data.ai_explanation_enabled ?? true,
    };

    const test = await Test.create(testData);

    // Create sections if provided
    if (data.sections && Array.isArray(data.sections)) {
      for (const section of data.sections) {
        await this.createSection(test.id, section);
      }
    }

    // Link questions if provided
    if (data.questionIds && Array.isArray(data.questionIds)) {
      await this.linkQuestions(test.id, data.questionIds);
    }

    return this.getById(test.id);
  },

  /**
   * Create a test from a template.
   */
  async createFromTemplate(templateId, data = {}) {
    const template = await TestTemplate.findByIdentifier(templateId);
    if (!template) throw new Error("Template not found");

    const config = template.configJson || {};

    const testData = {
      title: data.title || `Test from ${template.name}`,
      description: data.description || template.description,
      duration: config.duration || template.duration || 60,
      totalMarks: config.totalMarks || template.totalMarks || 0,
      negativeMarking: config.negativeMarking ?? 0.5,
      difficulty: config.difficulty || template.difficulty || "Medium",
      category: data.category || null,
      tags: data.tags || [],
      seriesId: data.seriesId || data.series_id || null,
      stageId: data.stageId || data.stage_id || template.stageId || null,
      subjectId:
        data.subjectId || data.subject_id || template.subjectId || null,
      examId: data.examId || data.exam_id || template.examId || null,
      shuffleQuestions: config.shuffleQuestions || false,
      shuffleOptions: config.shuffleOptions || false,
      sections: config.sections || [],
    };

    // Increment template usage
    await TestTemplate.incrementUsageCount(template.id);

    return this.create(testData);
  },

  /**
   * List tests with optional filters.
   * @param {object} query - { status, difficulty, seriesId, limit, offset }
   */
  async list(query = {}) {
    const { Test } = await import("../../data/models/test/Test.js").catch(
      () => ({}),
    );
    // Fall back to dbHelpers.find if Test model isn't available
    if (!Test || typeof Test.find !== "function") {
      const filter = {};
      if (query.status) filter.status = query.status;
      if (query.difficulty) filter.difficulty = query.difficulty;
      if (query.seriesId) filter.seriesId = query.seriesId;
      const limit = Math.min(200, Number(query.limit) || 50);
      const offset = Math.max(0, Number(query.offset) || 0);
      const results = await dbHelpers.find("tests", filter);
      return results.slice(offset, offset + limit);
    }
    return Test.find(query);
  },

  /**
   * Get test with all details.
   */
  async getById(id) {
    const test = await Test.findByIdentifier(id);
    if (!test) throw new Error("Test not found");

    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      // Get sections
      const sections = await client.query(
        `SELECT id, name, category_id, description, duration, passing_marks, is_active, display_order, created_at, updated_at FROM test_sections WHERE test_id = $1 ORDER BY display_order`,
        [test.id],
      );

      // Get questions count
      const questionCount = await client.query(
        `SELECT COUNT(*) as count FROM test_questions WHERE test_id = $1`,
        [test.id],
      );

      // Get series info if linked
      let series = null;
      if (test.seriesId || test.series_id) {
        const seriesResult = await client.query(
          // Intentional SELECT * — the full series row is returned to the
          // client as part of the test payload. Restricting columns here would
          // silently drop fields the frontend depends on.
          `SELECT * FROM test_series WHERE id = $1`,
          [test.seriesId || test.series_id],
        );
        series = seriesResult.rows[0] || null;
      }

      return {
        ...test,
        sections: sections.rows,
        questionCount: parseInt(questionCount.rows[0].count),
        series,
      };
    } finally {
      client.release();
    }
  },

  /**
   * Update test configuration.
   */
  async update(id, data) {
    const existing = await Test.findByIdentifier(id);
    if (!existing) throw new Error("Test not found");

    const updateData = {
      title: data.title,
      description: data.description,
      duration: data.duration,
      totalMarks: data.totalMarks || data.total_marks,
      negativeMarking: data.negativeMarking || data.negative_marking,
      passingMarks: data.passingMarks || data.passing_marks,
      difficulty: data.difficulty,
      category: data.category,
      subcategory: data.subcategory,
      tags: data.tags,
      languages: data.languages,
      instructions: data.instructions,
      testType: data.testType || data.test_type,
      shuffleQuestions: data.shuffleQuestions || data.shuffle_questions,
      shuffleOptions: data.shuffleOptions || data.shuffle_options,
      allowReview: data.allowReview,
      maxAttempts: data.maxAttempts || data.max_attempts,
      aiExplanationEnabled:
        data.aiExplanationEnabled || data.ai_explanation_enabled,
    };

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(filteredData).length > 0) {
      await Test.updateById(existing.id, filteredData);
    }

    // Update sections if provided
    if (data.sections && Array.isArray(data.sections)) {
      await this.updateSections(existing.id, data.sections);
    }

    return this.getById(existing.id);
  },

  /**
   * Create a section for a test.
   */
  async createSection(testId, data) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO test_sections (
          name, test_id, category_id, description, duration,
          passing_marks, negative_marks, total_marks, total_questions,
          is_active, display_order, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          true, $10, NOW(), NOW()
        ) RETURNING *`,
        [
          data.name,
          testId,
          data.categoryId || data.category_id || null,
          data.description || null,
          data.duration || 60,
          data.passingMarks || data.passing_marks || 0,
          data.negativeMarks || data.negative_marks || 0,
          data.totalMarks || data.total_marks || 0,
          data.totalQuestions || data.total_questions || 0,
          data.displayOrder || data.display_order || 0,
        ],
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  },

  /**
   * Update sections for a test.
   */
  async updateSections(testId, sections) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Remove existing sections
      await client.query(`DELETE FROM test_sections WHERE test_id = $1`, [
        testId,
      ]);

      // Create new sections
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        await client.query(
          `INSERT INTO test_sections (
            name, test_id, category_id, description, duration,
            passing_marks, negative_marks, total_marks, total_questions,
            is_active, display_order, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            true, $10, NOW(), NOW()
          )`,
          [
            section.name,
            testId,
            section.categoryId || section.category_id || null,
            section.description || null,
            section.duration || 60,
            section.passingMarks || section.passing_marks || 0,
            section.negativeMarks || section.negative_marks || 0,
            section.totalMarks || section.total_marks || 0,
            section.totalQuestions || section.total_questions || 0,
            section.displayOrder || section.display_order || i + 1,
          ],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Link questions to a test.
   */
  async linkQuestions(testId, questionIds) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (let i = 0; i < questionIds.length; i++) {
        await client.query(
          `INSERT INTO test_questions (test_id, question_id, question_number)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [testId, questionIds[i], i + 1],
        );
      }

      // Update test stats
      await client.query(
        `UPDATE tests SET
          total_questions = (SELECT COUNT(*) FROM test_questions WHERE test_id = $1),
          total_marks = (SELECT COALESCE(SUM(q.marks), 0) FROM test_questions tq JOIN questions q ON q.id = tq.question_id WHERE tq.test_id = $1),
          updated_at = NOW()
         WHERE id = $1`,
        [testId],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Unlink questions from a test.
   */
  async unlinkQuestions(testId, questionIds = null) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      if (questionIds && Array.isArray(questionIds)) {
        for (const qId of questionIds) {
          await client.query(
            `DELETE FROM test_questions WHERE test_id = $1 AND question_id = $2`,
            [testId, qId],
          );
        }
      } else {
        await client.query(`DELETE FROM test_questions WHERE test_id = $1`, [
          testId,
        ]);
      }

      // Update test stats
      await client.query(
        `UPDATE tests SET
          total_questions = (SELECT COUNT(*) FROM test_questions WHERE test_id = $1),
          total_marks = (SELECT COALESCE(SUM(q.marks), 0) FROM test_questions tq JOIN questions q ON q.id = tq.question_id WHERE tq.test_id = $1),
          updated_at = NOW()
         WHERE id = $1`,
        [testId],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get questions for a test.
   */
  async getQuestions(testId) {
    const { pool } =
      await import("../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT q.*, tq.question_number, tq.section_id, tq.marks as junction_marks,
                ts.name as section_name
         FROM test_questions tq
         JOIN questions q ON q.id = tq.question_id
         LEFT JOIN test_sections ts ON ts.id = tq.section_id
         WHERE tq.test_id = $1
         ORDER BY tq.question_number`,
        [testId],
      );
      return result.rows;
    } finally {
      client.release();
    }
  },

  /**
   * Clone a test with all its configuration.
   */
  async clone(id, data = {}) {
    const existing = await this.getById(id);
    if (!existing) throw new Error("Test not found");

    const cloneData = {
      title: data.title || `${existing.title} (Copy)`,
      description: existing.description,
      duration: existing.duration,
      totalMarks: existing.totalMarks,
      negativeMarking: existing.negativeMarking,
      passingMarks: existing.passingMarks,
      difficulty: existing.difficulty,
      category: existing.category,
      subcategory: existing.subcategory,
      tags: existing.tags,
      languages: existing.languages,
      instructions: existing.instructions,
      testType: existing.testType,
      shuffleQuestions: existing.shuffleQuestions,
      shuffleOptions: existing.shuffleOptions,
      allowReview: existing.allowReview,
      maxAttempts: existing.maxAttempts,
      aiExplanationEnabled: existing.aiExplanationEnabled,
      seriesId: existing.seriesId,
      stageId: existing.stageId,
      subjectId: existing.subjectId,
      examId: existing.examId,
      sections: existing.sections,
      status: "draft",
    };

    const newTest = await this.create(cloneData);

    // Clone questions
    const questions = await this.getQuestions(id);
    if (questions.length > 0) {
      await this.linkQuestions(
        newTest.id,
        questions.map((q) => q.id),
      );
    }

    return this.getById(newTest.id);
  },

  /**
   * Validate test data.
   */
  validate(data) {
    const errors = [];

    if (!data.title) {
      errors.push("Title is required");
    }

    if (
      data.duration !== undefined &&
      (data.duration < 1 || data.duration > 600)
    ) {
      errors.push("Duration must be between 1 and 600 minutes");
    }

    if (data.totalMarks !== undefined && data.totalMarks < 0) {
      errors.push("Total marks cannot be negative");
    }

    if (
      data.negativeMarking !== undefined &&
      (data.negativeMarking < 0 || data.negativeMarking > 1)
    ) {
      errors.push("Negative marking must be between 0 and 1");
    }

    const validDifficulties = ["Easy", "Medium", "Hard", "Very Hard"];
    if (data.difficulty && !validDifficulties.includes(data.difficulty)) {
      errors.push(`Difficulty must be one of: ${validDifficulties.join(", ")}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Generate a URL-friendly slug from title.
   */
  generateSlug(title) {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now()
    );
  },
};

export default testBuilderService;
