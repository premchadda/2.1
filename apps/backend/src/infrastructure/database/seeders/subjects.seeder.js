import BaseSeeder from './BaseSeeder.js';

export default class SubjectsSeeder extends BaseSeeder {
  static table = 'subjects';
  static fixtureFile = 'subjects.json';
  static columns = [
    'id', 'title', 'slug', 'icon', 'color', 'description', 'is_active',
    'order', 'stage_ids', 'parent_id', 'subject_group',
  ];

  static toRow(row) {
    return {
      ...row,
      title: row.name ?? row.title ?? null,
      order: row.sort_order ?? row.order ?? 0,
      subject_group: row.subjectGroup ?? null,
    };
  }
}
