import BaseSeeder from './BaseSeeder.js';

/**
 * Live tests are created in the future, anchored to NOW() + 30 days by
 * default. The seeder does NOT hardcode stale dates.
 */
export default class LiveTestsSeeder extends BaseSeeder {
  static table = 'live_tests';
  static fixtureFile = 'live_tests.json';
  static columns = [
    'test_id', 'name', 'code', 'subject', 'category', 'description',
    'duration_minutes', 'total_questions', 'positive_marking',
    'negative_marking', 'instructions', 'status', 'is_archived',
    'is_recurring', 'recur_freq', 'recur_count', 'attempt_limit',
    'show_leaderboard', 'show_explanation', 'section_config',
    'start_time', 'end_time', 'result_time', 'is_active',
  ];

  static toRow(row) {
    const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30d
    const end   = new Date(start.getTime() + (row.duration_minutes ?? 60) * 60 * 1000);
    const result = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    return {
      ...row,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      result_time: result.toISOString(),
      is_active: true,
    };
  }

  static valueFor(row, column) {
    if (column === 'section_config') return JSON.stringify(row.section_config ?? {});
    return row[column] ?? null;
  }

  static conflictTarget() {
    return 'code';
  }
}
