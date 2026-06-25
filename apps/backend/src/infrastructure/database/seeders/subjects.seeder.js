import BaseSeeder from './BaseSeeder.js';

export default class SubjectsSeeder extends BaseSeeder {
  static table = 'subjects';
  static fixtureFile = 'subjects.json';
  static columns = [
    'id', 'name', 'slug', 'icon', 'color', 'description', 'is_active',
    'sort_order', 'subject_group', 'exam_ids', 'stage_ids', 'parent_id',
  ];
}
