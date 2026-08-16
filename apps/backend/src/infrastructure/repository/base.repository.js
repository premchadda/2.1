import { dbHelpers, pool } from "../database/postgres-helpers.js";

// Table name allowlist — only tables that exist in the schema can be queried.
// Prevents SQL injection via dynamic table names in count(), queryRaw(), etc.
const ALLOWED_TABLES = new Set([
  'users', 'tests', 'questions', 'test_categories', 'test_series', 'test_sections',
  'test_questions', 'attempts', 'attempt_sections', 'attempt_answers',
  'enrollments', 'exam_categories', 'exams', 'exam_info', 'exam_seasons',
  'exam_yearly_data', 'study_materials', 'chapters', 'topics', 'subject_parts',
  'units', 'subtopics', 'passages', 'stages', 'sections', 'quizzes',
  'notifications', 'subscriptions', 'subscription_plans', 'results',
  'doubts', 'bookmarks', 'leaderboards', 'leaderboard_entries',
  'activity_logs', 'audit_trail', 'study_groups', 'group_posts',
  'group_post_likes', 'group_messages', 'discussions', 'discussion_replies',
  'discussion_likes', 'blog_posts', 'referrals', 'achievements',
  'achievements_user', 'promotions', 'coupons', 'coupon_usage',
  'referral_codes', 'email_templates', 'navigation_items',
  'app_settings', 'user_sessions', 'two_factor_secrets', 'backup_codes',
  'payments', 'user_events', 'recommendations', 'learning_progress',
  'spaced_repetition', 'daily_quiz_history', 'moderation_queue',
  'certificates', 'content_moderation', 'tags', 'question_tags',
  'user_activity', 'current_affairs', 'banners', 'pyp_hierarchy',
  'roles', 'permissions', 'role_permissions', 'user_roles',
  'uploads', 'files', 'trash', 'practice_questions', 'practice_tests',
  'ai_usage_logs', 'ai_cache', 'practice_ai_cache', 'rate_limits',
  'feature_flags', 'system_health', 'backups',
]);

const assertValidTable = (table) => {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`[BaseRepository] Disallowed table name: "${table}"`);
  }
};

export class BaseRepository {
  constructor(collectionName) {
    assertValidTable(collectionName);
    this.collection = collectionName;
    this.db = dbHelpers;
    this.pool = pool;
  }

  async findById(id) {
    return this.db.findById(this.collection, id);
  }

  async findOne(query) {
    return this.db.findOne(this.collection, query);
  }

  async find(query, limit = null, offset = null) {
    return this.db.find(this.collection, query, limit, offset);
  }

  async findActive(query = {}) {
    return this.db.find(this.collection, { ...query, isActive: true });
  }

  async insert(data, client = null) {
    return this.db.insertOne(this.collection, data, client);
  }

  async update(id, data, client = null) {
    return this.db.updateById(this.collection, id, data, client);
  }

  async softDelete(id, userId) {
    return this.db.softDelete(this.collection, id, userId);
  }

  async count(query = {}) {
    const table = this.collection;
    let sql = `SELECT COUNT(*)::int AS count FROM ${table}`;
    const values = [];
    const conditions = [];
    let i = 1;

    const snakeQuery = this.db.toSnake ? this.db.toSnake(query, this.collection) : query;

    for (const key in snakeQuery) {
      const value = snakeQuery[key];
      if (value === null) {
        conditions.push(`"${key}" IS NULL`);
      } else if (typeof value !== 'object') {
        conditions.push(`"${key}" = $${i}`);
        values.push(value);
        i++;
      } else if (value.$in && Array.isArray(value.$in)) {
        if (value.$in.length > 0) {
          const placeholders = value.$in.map(() => `$${i++}`).join(', ');
          conditions.push(`"${key}" IN (${placeholders})`);
          values.push(...value.$in);
        } else {
          conditions.push('1=0');
        }
      } else if (value.$gt) {
        conditions.push(`"${key}" > $${i}`);
        values.push(value.$gt);
        i++;
      } else if (value.$lt) {
        conditions.push(`"${key}" < $${i}`);
        values.push(value.$lt);
        i++;
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    try {
      const result = await this.pool.query(sql, values);
      return result.rows[0]?.count || 0;
    } catch (error) {
      console.error(`DB Count Error (${table}):`, error.message);
      throw error;
    }
  }

  async queryRaw(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async queryOneRaw(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows[0] || null;
  }

  async executeRaw(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result;
  }
}
