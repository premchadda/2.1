import { QuestionRepository } from "./question.repository.js";
import { createSchema } from "../../middleware/validation/inputValidation.js";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";

const repo = new QuestionRepository();

const createVersionForQuestion = async (
  questionId,
  data,
  versionNumber,
  snapshotType = "admin_edit",
  userId = null,
  changeSummary = null,
) => {
  await dbHelpers.insertOne("questionVersions", {
    questionId,
    versionNumber,
    text: data.questionText || data.question_text || data.text || "",
    options: data.options || [],
    correctAnswer:
      data.correctAnswer ??
      data.correctOption ??
      data.correct_option ??
      data.correct_answer ??
      data.correct_option_id ??
      data.correctOptionId ??
      data.correct ??
      data.answer ??
      0,
    explanation: data.explanation ?? null,
    marks: data.marks ?? 1,
    negativeMarks: data.negativeMarks ?? data.negative_marks ?? 0,
    difficulty: data.difficulty ?? "medium",
    questionType:
      data.questionType ?? data.question_type ?? data.type ?? "single_correct",
    isCurrent: true,
    snapshotType,
    changeSummary,
    changedBy: userId,
    createdAt: new Date().toISOString(),
  });
};

export const questionSchema = createSchema()
  .field("question_text", {
    type: "string",
    required: true,
    minLength: 5,
    maxLength: 5000,
  })
  .field("questionText", {
    type: "string",
    required: false,
    minLength: 5,
    maxLength: 5000,
  })
  .field("options", { type: "array", required: true, minLength: 2 })
  .field("correct_option", { type: "integer", required: false, min: 0 })
  .field("correctOption", { type: "integer", required: false, min: 0 })
  .field("correct_answer", { type: "any", required: false })
  .field("correctAnswer", { type: "any", required: false })
  .field("type", {
    type: "string",
    required: false,
    enum: ["mcq", "msq", "numerical", "descriptive"],
  })
  .field("difficulty", {
    type: "string",
    required: false,
    enum: ["easy", "medium", "hard", "Easy", "Medium", "Hard"],
  })
  .field("marks", { type: "integer", required: false, min: 0 })
  .field("negative_marks", { type: "integer", required: false, min: 0 })
  .field("explanation", { type: "string", required: false, maxLength: 5000 });

export const questionService = {
  async list(query = {}) {
    return repo.findActive(query);
  },

  async getById(id) {
    return repo.findById(id);
  },

  async getByTestId(testId) {
    return repo.findByTestId(testId);
  },

  async create(data) {
    const maxNum = await repo.getMaxQuestionNumber();
    const payload = {
      questionText: data.questionText || data.question_text,
      options: data.options,
      correctAnswer:
        data.correctAnswer ??
        data.correctOption ??
        data.correct_option ??
        data.correct_answer ??
        data.correct_option_id ??
        data.correctOptionId ??
        data.correct ??
        data.answer ??
        0,
      explanation: data.explanation,
      marks: data.marks,
      negMarks: data.negativeMarks ?? data.negative_marks,
      difficulty: data.difficulty || "medium",
      testId: data.testId || data.test_id,
      section: data.section,
      chapterId: data.chapterId || data.chapter_id,
      topicId: data.topicId || data.topic_id,
      questionNumber: data.questionNumber || data.question_number || maxNum + 1,
      isActive: true,
    };

    const question = await repo.insert(payload);

    if (question?.id) {
      await createVersionForQuestion(
        question.id,
        payload,
        1,
        "admin_edit",
        data.createdBy || null,
        "Initial version",
      );
    }

    if (payload.testId) {
      await repo.executeRaw(
        "INSERT INTO test_questions (test_id, question_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [payload.testId, question.id, payload.questionNumber],
      );
      await syncTestStats(payload.testId);
    }

    if (data.tagIds) {
      await repo.updateTags(question.id, data.tagIds);
    }

    return question;
  },

  async update(id, data) {
    const existing = await repo.findById(id);
    if (!existing) return null;

    const payload = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        payload[key] = value;
      }
    }

    const updated = await repo.update(id, payload);

    const existingVersion = await dbHelpers.findOne("questionVersions", {
      questionId: id,
      isCurrent: true,
    });
    if (existingVersion) {
      await dbHelpers.updateById(
        "questionVersions",
        existingVersion.id || existingVersion._id,
        { isCurrent: false },
      );
    }
    const nextVersion = (existingVersion?.versionNumber ?? 0) + 1;
    await createVersionForQuestion(
      id,
      { ...existing, ...payload },
      nextVersion,
      "admin_edit",
      data.updatedBy || null,
      "Edited",
    );

    const junction = await repo.queryOneRaw(
      "SELECT test_id FROM test_questions WHERE question_id = $1",
      [id],
    );
    if (junction?.test_id) await syncTestStats(junction.test_id);

    if (data.tagIds) {
      await repo.updateTags(id, data.tagIds);
    }

    return updated;
  },

  async remove(id) {
    const existing = await repo.findById(id);
    if (!existing) return null;

    const junction = await repo.queryOneRaw(
      "SELECT test_id FROM test_questions WHERE question_id = $1",
      [id],
    );
    const deleted = await repo.softDelete(id);
    if (junction?.test_id) await syncTestStats(junction.test_id);
    return deleted;
  },

  async bulkUpload(questions, testId = null) {
    const prepared = questions.map((q, i) => ({
      ...q,
      testId: q.testId || q.test_id || testId,
      questionNumber: q.questionNumber || q.question_number || i + 1,
    }));
    return repo.bulkInsert(prepared);
  },

  async restore(id) {
    return repo.db.restoreFromTrash(id);
  },

  async reorder(questionId, fromPosition, toPosition) {
    const question = await repo.findById(questionId);
    if (!question) return null;

    const junction = await repo.queryOneRaw(
      "SELECT test_id FROM test_questions WHERE question_id = $1",
      [questionId],
    );
    const testId = junction?.test_id;
    if (!testId) return { error: "Question not linked to a test" };

    const questions = await repo.queryRaw(
      "SELECT q.* FROM questions q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1 AND q.is_active = true ORDER BY q.question_number",
      [testId],
    );
    questions.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));

    if (fromPosition < toPosition) {
      for (let i = fromPosition; i < toPosition; i++) {
        await repo.update(questions[i].id, { questionNumber: i + 1 });
      }
    } else {
      for (let i = fromPosition; i > toPosition; i--) {
        await repo.update(questions[i].id, { questionNumber: i + 1 });
      }
    }
    await repo.update(questionId, { questionNumber: toPosition + 1 });
    return true;
  },
};

async function syncTestStats(testId) {
  if (!testId) return;
  const { TestRepository } =
    await import("../../modules/tests/test.repository.js");
  const tr = new TestRepository();
  await tr.syncStats(testId);
}
