import BaseSeeder from './BaseSeeder.js';

export default class TestsSeeder extends BaseSeeder {
  static table = 'tests';
  static fixtureFile = 'tests.json';
  static columns = [
    'id', 'series_id', 'slug', 'title', 'category', 'sub_category', 'type',
    'total_questions', 'total_marks', 'duration', 'passing_marks',
    'negative_marking', 'tags', 'is_live', 'live_schedule', 'scheduled_at',
    'difficulty', 'is_active', 'subject_id', 'is_pro', 'stage_id',
    'banner_asset_id', 'promotion_banner_asset_id', 'is_coming_soon',
    'category_path_ids', 'category_path_names', 'languages',
    'coming_soon_date', 'test_category_id', 'exam_id', 'stage_ids',
  ];
}
