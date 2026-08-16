import BaseSeeder from './BaseSeeder.js';

export default class QuestionsSeeder extends BaseSeeder {
  static table = 'questions';
  static fixtureFile = 'questions.json';
  static columns = [
    'id', 'test_id', 'question_number', 'question_text', 'question_text_hi',
    'options', 'options_hi', 'correct_option', 'marks', 'negative_marks',
    'section', 'explanation', 'difficulty', 'image', 'is_active', 'subject',
    'chapter_id', 'topic', 'image_asset_id', 'series_id', 'category_id',
    'sub_category_id', 'study_material_id', 'topic_id', 'quiz_id',
    'category', 'type', 'status', 'tags', 'passage_id', 'chapter',
    'is_practice', 'solution',
  ];

  static toRow(row) {
    return {
      ...row,
      question_text: row.question_text ?? row.question ?? null,
      correct_option: row.correct_option ?? row.correct_option_id ?? 0,
      solution: row.solution ?? row.explanation ?? null,
    };
  }
}
