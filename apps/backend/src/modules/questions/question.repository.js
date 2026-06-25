import { BaseRepository } from "../../infrastructure/repository/base.repository.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";

export class QuestionRepository extends BaseRepository {
  constructor() {
    super("questions");
  }

  async findByTestId(testId) {
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

  async findOrphaned() {
    return this.find({ _orphaned: true, isActive: true });
  }

  async bulkInsert(questions, client = null) {
    if (client) {
      for (const q of questions) {
        const result = await client.query(
          `INSERT INTO questions (question_text, options, correct_answer, explanation, marks, negative_marks,
            difficulty, section, chapter_id, topic_id, question_number, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW(),NOW()) RETURNING id`,
          [q.questionText || q.question_text, JSON.stringify(q.options), q.correctAnswer ?? q.correct_option,
           q.explanation, q.marks, q.negMarks ?? q.negative_marks, q.difficulty,
           q.section, q.chapterId || q.chapter_id, q.topicId || q.topic_id,
           q.questionNumber || q.question_number]
        );

        const testId = q.testId || q.test_id;
        if (testId) {
          await client.query(
            "INSERT INTO test_questions (test_id, question_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [testId, result.rows[0].id, q.orderIndex || q.order_index || 0]
          );
        }
      }
      return questions.length;
    }

    let count = 0;
    for (const q of questions) {
      const inserted = await this.insert({
        questionText: q.questionText || q.question_text,
        options: q.options,
        correctAnswer: q.correctAnswer ?? q.correct_option,
        explanation: q.explanation,
        marks: q.marks,
        negativeMarks: q.negMarks ?? q.negative_marks,
        difficulty: q.difficulty,
        section: q.section,
        chapterId: q.chapterId || q.chapter_id,
        topicId: q.topicId || q.topic_id,
        questionNumber: q.questionNumber || q.question_number,
      });

      const testId = q.testId || q.test_id;
      if (testId) {
        await this.executeRaw(
          "INSERT INTO test_questions (test_id, question_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [testId, inserted.id, q.orderIndex || q.order_index || 0]
        );
      }
      count++;
    }
    return count;
  }

  async getMaxQuestionNumber() {
    const row = await this.queryOneRaw("SELECT COALESCE(MAX(question_number), 0) as max_num FROM questions WHERE is_active = true");
    return row?.max_num || 0;
  }

  async updateTags(questionId, tagIds) {
    await this.executeRaw("DELETE FROM question_tag_map WHERE question_id = $1", [questionId]);
    for (const tagId of tagIds) {
      await this.executeRaw(
        "INSERT INTO question_tag_map (question_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [questionId, tagId]
      );
    }
  }
}
