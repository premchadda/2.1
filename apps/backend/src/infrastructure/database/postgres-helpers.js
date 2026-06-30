import { Pool } from "pg";
import dotenv from "dotenv";
import { setTimeout as sleep } from "timers/promises";
import { randomUUID } from "crypto";
import { parseNumericId } from "../../shared/utils/db-utils.js";

dotenv.config();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

// Entity prefix registry for public_id generation
// CRITICAL: Each prefix must be GLOBALLY UNIQUE to prevent collisions
const ENTITY_PREFIXES = Object.freeze({
  users: "usr_",
  tests: "tst_",
  questions: "qst_",
  attempts: "att_",
  test_series: "ser_",
  exams: "exm_",
  subjects: "subj_", // Changed from 'sub_' to avoid collision with subscriptions
  chapters: "chp_",
  topics: "tpc_",
  subtopics: "stp_",
  stages: "stg_",
  bookmarks: "bkm_",
  doubts: "dbt_",
  doubt_replies: "dbr_",
  notifications: "nfy_",
  subscriptions: "subs_", // Changed from 'sub_' to avoid collision with subjects
  study_streaks: "sts_",
  user_achievements: "uac_",
  enrollments: "enr_",
  leaderboard_entries: "lbe_",
  results: "res_",
  daily_quizzes: "dqz_",
  revision_queue: "rvq_",
  wrong_questions: "wq_",
  test_categories: "tct_",
  exam_categories: "ect_",
});

// Regex patterns for validating public_id format per entity type
const PUBLIC_ID_PATTERNS = Object.freeze({
  users: /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  tests: /^tst_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  questions:
    /^qst_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  attempts:
    /^att_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  test_series:
    /^ser_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  exams: /^exm_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  subjects:
    /^subj_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  chapters:
    /^chp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  topics: /^tpc_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  subtopics:
    /^stp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  stages: /^stg_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  bookmarks:
    /^bkm_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  doubts: /^dbt_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  doubt_replies:
    /^dbr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  notifications:
    /^nfy_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  subscriptions:
    /^subs_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  study_streaks:
    /^sts_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  user_achievements:
    /^uac_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  enrollments:
    /^enr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  leaderboard_entries:
    /^lbe_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  results:
    /^res_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  daily_quizzes:
    /^dqz_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  revision_queue:
    /^rvq_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  wrong_questions:
    /^wq_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  test_categories:
    /^tct_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  exam_categories:
    /^ect_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
});

// JSONB columns per table - arrays in these columns must be stringified for PostgreSQL
const JSONB_COLUMNS = Object.freeze({
  tests: ["languages"],
  test_series: [
    "sections",
    "languages",
    "category_path_ids",
    "category_path_names",
  ],
  attempts: [
    "questions",
    "answers",
    "question_results",
    "solutions",
    "marked_for_review",
    "section_timers",
  ],
  live_tests: [
    "questions",
    "answers",
    "question_results",
    "solutions",
    "category_path_ids",
    "category_path_names",
  ],
  pyp_papers: ["category_path_ids", "category_path_names"],
  exam_yearly_data: ["vacancy_breakup", "cutoff", "important_dates"],
  exam_info: ["exam_pattern", "important_dates", "salary_structure"],
  achievement_definitions: ["criteria"],
  activity_logs: ["metadata"],
  affiliates: ["social_links", "features", "payment"],
  app_settings: ["metadata"],
  attempt_events: ["event_data"],
  coupons: ["used_by_users"],
  daily_quiz_attempts: ["answers"],
  doubts: ["metadata"],
  exams: ["tags"],
  leaderboards: ["metadata"],
  leaderboard_entries: ["rankings"],
  media: ["metadata"],
  messages: ["metadata"],
  question_options: ["options"],
  results: ["answers"],
  revision_queue: ["metadata"],
  subscription_plans: ["features"],
  topics: ["related_chapters"],
  users: ["attempted_tests", "notification_preferences", "privacy"],
  wrong_questions: ["metadata"],
});

// Timestamp columns per table - empty strings must be converted to NULL for PostgreSQL
const TIMESTAMP_COLUMNS = Object.freeze({
  tests: ["coming_soon_date"],
  live_tests: ["start_time", "end_time", "result_time"],
  users: ["pro_expiry"],
  pro_passes: ["start_date", "end_date"],
});

// Helper to stringify JSONB values (objects and arrays) for PostgreSQL
const stringifyJsonbValue = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
};

// Helper to prepare values for PostgreSQL insert/update based on table's JSONB columns
const prepareDbValues = (table, dbData) => {
  const jsonbCols = JSONB_COLUMNS[table] || [];
  const timestampCols = TIMESTAMP_COLUMNS[table] || [];
  const result = {};
  for (const [key, value] of Object.entries(dbData)) {
    if (jsonbCols.includes(key)) {
      result[key] = stringifyJsonbValue(value);
    } else if (
      timestampCols.includes(key) &&
      (value === "" || value === undefined)
    ) {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
};

const RELATIONSHIP_DEFINITIONS = Object.freeze([
  {
    table: "assets",
    column: "uploaded_by",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "assets_uploaded_by_fkey",
    onDelete: "SET NULL",
    indexName: "idx_assets_uploaded_by",
  },
  {
    table: "attempt_events",
    column: "attempt_id",
    foreignTable: "attempts",
    foreignColumn: "id",
    constraintName: "attempt_events_attempt_id_fkey",
    onDelete: "CASCADE",
  },
  {
    table: "attempt_events",
    column: "question_id",
    foreignTable: "questions",
    foreignColumn: "id",
    constraintName: "attempt_events_question_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_attempt_events_question_id",
  },
  {
    table: "attempt_answers",
    column: "attempt_id",
    foreignTable: "attempts",
    foreignColumn: "id",
    constraintName: "attempt_answers_attempt_id_fkey",
    onDelete: "CASCADE",
    dropIfMismatch: true,
    indexName: "idx_attempt_answers_attempt_id",
  },
  {
    table: "attempt_answers",
    column: "question_id",
    foreignTable: "questions",
    foreignColumn: "id",
    constraintName: "attempt_answers_question_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_attempt_answers_question_id",
  },
  {
    table: "attempts",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "attempts_user_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_attempts_user_id",
  },
  {
    table: "attempts",
    column: "test_id",
    foreignTable: "tests",
    foreignColumn: "id",
    constraintName: "attempts_test_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_attempts_test_id",
  },
  {
    table: "attempts",
    column: "series_id",
    foreignTable: "test_series",
    foreignColumn: "id",
    constraintName: "attempts_series_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_attempts_series_id",
  },
  {
    table: "banners",
    column: "asset_id",
    foreignTable: "assets",
    foreignColumn: "id",
    constraintName: "banners_asset_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_banners_asset_id",
  },
  {
    table: "bookmarks",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "bookmarks_user_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_bookmarks_user_id",
  },
  {
    table: "doubts",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "doubts_user_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_doubts_user_id",
  },
  {
    table: "doubt_replies",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "doubt_replies_user_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_doubt_replies_user_id",
  },
  {
    table: "promotions",
    column: "banner_asset_id",
    foreignTable: "assets",
    foreignColumn: "id",
    constraintName: "promotions_banner_asset_id_fkey",
    onDelete: "SET NULL",
  },
  {
    table: "question_options",
    column: "question_id",
    foreignTable: "questions",
    foreignColumn: "id",
    constraintName: "question_options_question_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_question_options_question_id",
  },
  {
    table: "questions",
    column: "chapter_id",
    foreignTable: "chapters",
    foreignColumn: "id",
    constraintName: "questions_chapter_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_questions_chapter_id",
  },
  {
    table: "questions",
    column: "image_asset_id",
    foreignTable: "assets",
    foreignColumn: "id",
    constraintName: "questions_image_asset_id_fkey",
    onDelete: "SET NULL",
  },
  {
    table: "study_group_members",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "study_group_members_user_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_study_group_members_user_id",
  },
  {
    table: "study_groups",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "study_groups_user_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_study_groups_user_id",
  },
  {
    table: "subscriptions",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "subscriptions_user_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_subscriptions_user_id",
  },
  // test_attempts is a VIEW (migration 039/048), not a table — FK constraints
  // belong on the underlying "attempts" table. Skipping to avoid
  // "ALTER action ADD CONSTRAINT cannot be performed on relation" errors.
  {
    table: "test_categories",
    column: "exam_category_id",
    foreignTable: "exam_categories",
    foreignColumn: "category_id",
    constraintName: "test_categories_exam_category_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_test_categories_exam_category_id",
  },
  {
    table: "tests",
    column: "banner_asset_id",
    foreignTable: "assets",
    foreignColumn: "id",
    constraintName: "tests_banner_asset_id_fkey",
    onDelete: "SET NULL",
  },
  {
    table: "tests",
    column: "promotion_banner_asset_id",
    foreignTable: "assets",
    foreignColumn: "id",
    constraintName: "tests_promotion_banner_asset_id_fkey",
    onDelete: "SET NULL",
  },
  {
    table: "test_questions",
    column: "test_id",
    foreignTable: "tests",
    foreignColumn: "id",
    constraintName: "test_questions_test_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_test_questions_test_id",
  },
  {
    table: "test_questions",
    column: "question_id",
    foreignTable: "questions",
    foreignColumn: "id",
    constraintName: "test_questions_question_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_test_questions_question_id",
  },
  {
    table: "tests",
    column: "subject_id",
    foreignTable: "subjects",
    foreignColumn: "id",
    constraintName: "tests_subject_id_fkey",
    onDelete: "SET NULL",
    dropIfMismatch: true,
  },
  {
    table: "user_achievements",
    column: "user_id",
    foreignTable: "users",
    foreignColumn: "id",
    constraintName: "user_achievements_user_id_fkey",
    onDelete: "CASCADE",
  },
  {
    table: "tests",
    column: "series_id",
    foreignTable: "test_series",
    foreignColumn: "id",
    constraintName: "tests_series_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_tests_series_id",
  },
  {
    table: "tests",
    column: "stage_id",
    foreignTable: "stages",
    foreignColumn: "id",
    constraintName: "tests_stage_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_tests_stage_id",
  },
  {
    table: "subject_parts",
    column: "subject_id",
    foreignTable: "subjects",
    foreignColumn: "id",
    constraintName: "subject_parts_subject_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_subject_parts_subject_id",
  },
  {
    table: "units",
    column: "part_id",
    foreignTable: "subject_parts",
    foreignColumn: "id",
    constraintName: "units_part_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_units_part_id",
  },
  {
    table: "chapters",
    column: "unit_id",
    foreignTable: "units",
    foreignColumn: "id",
    constraintName: "chapters_unit_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_chapters_unit_id",
  },
  {
    table: "topics",
    column: "chapter_id",
    foreignTable: "chapters",
    foreignColumn: "id",
    constraintName: "topics_chapter_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_topics_chapter_id",
  },
  {
    table: "subtopics",
    column: "topic_id",
    foreignTable: "topics",
    foreignColumn: "id",
    constraintName: "subtopics_topic_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_subtopics_topic_id",
  },
  {
    table: "subjects",
    column: "parent_id",
    foreignTable: "subjects",
    foreignColumn: "id",
    constraintName: "subjects_parent_id_fkey",
    onDelete: "CASCADE",
    indexName: "idx_subjects_parent_id",
  },
  {
    table: "test_sections",
    column: "category_id",
    foreignTable: "test_categories",
    foreignColumn: "id",
    constraintName: "test_sections_category_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_test_sections_category",
  },
  {
    table: "tests",
    column: "section_id",
    foreignTable: "test_sections",
    foreignColumn: "id",
    constraintName: "tests_section_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_tests_section_id",
  },
  {
    table: "test_questions",
    column: "section_id",
    foreignTable: "test_sections",
    foreignColumn: "id",
    constraintName: "test_questions_section_id_fkey",
    onDelete: "SET NULL",
    indexName: "idx_test_questions_section_id",
  },
]);

// Use environment-provided DATABASE_URL for credentials (safer for secrets)
// Always require SSL for Supabase connections
// CRIT-01 FIX: SSL certificate validation enabled in production
// Only skip validation in development environments
const isDev =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PG_SSL_REJECT_UNAUTHORIZED === "false"
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: !isDev },
  connectionTimeoutMillis: parsePositiveInt(
    process.env.PG_CONNECTION_TIMEOUT_MS,
    10000,
  ),
  idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30000),
  query_timeout: parsePositiveInt(process.env.PG_QUERY_TIMEOUT_MS, 30000),
  max: parsePositiveInt(process.env.PG_POOL_MAX, 20),
  allowExitOnIdle: false,
})

pool.on('error', (err) => {
  console.error('[Pool] Idle client error (non-fatal):', err.message)
})

let ensureTestSectionsSchemaPromise = null;

const runEnsureTestSectionsSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_sections (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category_id INTEGER REFERENCES test_categories(id) ON DELETE SET NULL,
      description TEXT,
      duration INTEGER DEFAULT 60,
      passing_marks INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_test_sections_category ON test_sections(category_id);
    CREATE INDEX IF NOT EXISTS idx_test_sections_order ON test_sections(display_order);
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tests')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'section_id') THEN
        ALTER TABLE tests ADD COLUMN section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'test_questions')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_questions' AND column_name = 'section_id') THEN
        ALTER TABLE test_questions ADD COLUMN section_id INTEGER REFERENCES test_sections(id) ON DELETE SET NULL;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attempts')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'section_scores') THEN
        ALTER TABLE attempts ADD COLUMN section_scores JSONB DEFAULT '{}'::jsonb;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attempts')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'section_times') THEN
        ALTER TABLE attempts ADD COLUMN section_times JSONB DEFAULT '{}'::jsonb;
      END IF;
    END $$;
  `);
};

export const ensureTestSectionsSchema = async () => {
  if (!ensureTestSectionsSchemaPromise) {
    ensureTestSectionsSchemaPromise = runEnsureTestSectionsSchema().catch(
      (error) => {
        ensureTestSectionsSchemaPromise = null;
        throw error;
      },
    );
  }

  return ensureTestSectionsSchemaPromise;
};

class PostgresHelpers {
  constructor(pool) {
    this.pool = pool;
    this.columnExistsCache = new Map();
    this.tableMap = {
      users: "users",
      testSeries: "test_series",
      tests: "tests",
      questions: "questions",
      studyMaterials: "study_materials",
      examCategories: "exam_categories",
      exams: "exams",
      examInfo: "exam_info",
      navigationMenu: "navigation_menu",
      tagConfigs: "ui_tag_configs",
      media: "media",
      appSettings: "app_settings",
      testCategories: "test_categories",
      enrollments: "enrollments",
      results: "results",
      videos: "study_materials",
      pdfs: "study_materials",
      coupons: "coupons",
      notifications: "notifications",
      attemptEvents: "attempt_events",
      subscriptionPlans: "subscription_plans",
      subjects: "subjects",
      subjectParts: "subject_parts",
      units: "units",
      chapters: "chapters",
      topics: "topics",
      subtopics: "subtopics",
      stages: "stages",
      // Added missing tables
      liveTests: "live_tests",
      leaderboards: "leaderboards",
      examYearlyData: "exam_yearly_data",
      examUpdates: "exam_updates",
      bookmarks: "bookmarks",
      userAchievements: "user_achievements",
      attempts: "attempts",
      questionAttempts: "question_attempts",
      activityLogs: "activity_logs",
      blogs: "blogs",
      referrals: "referrals",
      doubts: "doubts",
      doubtReplies: "doubt_replies",
      studyGroups: "study_groups",
      studyGroupMembers: "study_group_members",
      // Study material related tables
      subjectVideos: "subject_videos",
      subjectPdfs: "subject_pdfs",
      topicTests: "topic_tests",
      passages: "passages",
    };
  }

  async query(sql, params) {
    try {
      return await this.pool.query(sql, params);
    } catch (error) {
      console.error("DB Query Error:", error.message);
      console.error("SQL:", sql);
      console.error("Params:", params);
      throw error;
    }
  }

  async withTransaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async columnExists(tableName, columnName) {
    const cacheKey = `${tableName}.${columnName}`;
    if (this.columnExistsCache.has(cacheKey)) {
      return this.columnExistsCache.get(cacheKey);
    }

    const result = await this.pool.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        LIMIT 1
      `,
      [tableName, columnName],
    );
    const exists = result.rowCount > 0;
    this.columnExistsCache.set(cacheKey, exists);
    return exists;
  }

  async getColumnDataType(tableName, columnName) {
    const result = await this.pool.query(
      `
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        LIMIT 1
      `,
      [tableName, columnName],
    );

    return result.rows[0]?.data_type || null;
  }

  async getTableRowCount(tableName) {
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)}`,
    );

    return result.rows[0]?.count || 0;
  }

  async getForeignKeyForColumn(tableName, columnName) {
    const result = await this.pool.query(
      `
        SELECT
          tc.constraint_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND kcu.column_name = $2
        LIMIT 1
      `,
      [tableName, columnName],
    );
    return result.rows[0] || null;
  }

  async ensureIndex(tableName, columnName, indexName) {
    if (!indexName) return;

    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(indexName)} ON ${quoteIdentifier(tableName)} (${quoteIdentifier(columnName)})`,
    );
  }

  async countForeignKeyOrphans(
    tableName,
    columnName,
    foreignTable,
    foreignColumn,
  ) {
    const result = await this.pool.query(
      `
        SELECT COUNT(*)::int AS broken
        FROM ${quoteIdentifier(tableName)} child
        LEFT JOIN ${quoteIdentifier(foreignTable)} parent
          ON child.${quoteIdentifier(columnName)} = parent.${quoteIdentifier(foreignColumn)}
        WHERE child.${quoteIdentifier(columnName)} IS NOT NULL
          AND parent.${quoteIdentifier(foreignColumn)} IS NULL
      `,
    );

    return result.rows[0]?.broken || 0;
  }

  async ensureForeignKey(definition) {
    const {
      table,
      column,
      foreignTable,
      foreignColumn = "id",
      constraintName,
      onDelete = "NO ACTION",
      onUpdate = "NO ACTION",
      indexName,
      dropIfMismatch = false,
    } = definition;

    const childColumnExists = await this.columnExists(table, column);
    const parentColumnExists = await this.columnExists(
      foreignTable,
      foreignColumn,
    );

    if (!childColumnExists || !parentColumnExists) {
      return false;
    }

    const existingForeignKey = await this.getForeignKeyForColumn(table, column);
    if (existingForeignKey) {
      const isExpectedTarget =
        existingForeignKey.foreign_table_name === foreignTable &&
        existingForeignKey.foreign_column_name === foreignColumn;

      if (isExpectedTarget) {
        await this.ensureIndex(table, column, indexName);
        return false;
      }

      if (!dropIfMismatch) {
        console.warn(
          `[DB] Skipping FK ${table}.${column}; existing constraint points to ${existingForeignKey.foreign_table_name}.${existingForeignKey.foreign_column_name}.`,
        );
        return false;
      }

      await this.pool.query(
        `ALTER TABLE ${quoteIdentifier(table)} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(existingForeignKey.constraint_name)}`,
      );
    }

    const orphanCount = await this.countForeignKeyOrphans(
      table,
      column,
      foreignTable,
      foreignColumn,
    );
    if (orphanCount > 0) {
      console.warn(
        `[DB] Skipping FK ${table}.${column} -> ${foreignTable}.${foreignColumn}; found ${orphanCount} orphaned row(s).`,
      );
      return false;
    }

    await this.pool.query(
      `
        ALTER TABLE ${quoteIdentifier(table)}
        ADD CONSTRAINT ${quoteIdentifier(constraintName)}
        FOREIGN KEY (${quoteIdentifier(column)})
        REFERENCES ${quoteIdentifier(foreignTable)} (${quoteIdentifier(foreignColumn)})
        ON UPDATE ${onUpdate}
        ON DELETE ${onDelete}
      `,
    );

    await this.ensureIndex(table, column, indexName);
    console.log(
      `[DB] Added FK ${table}.${column} -> ${foreignTable}.${foreignColumn}`,
    );
    return true;
  }

  async reconcileRelationships() {
    let changes = 0;

    for (const definition of RELATIONSHIP_DEFINITIONS) {
      const applied = await this.ensureForeignKey(definition);
      if (applied) {
        changes += 1;
      }
    }
    if (changes > 0)
      console.log(
        `[DB] Finished relations reconciliation. Applied ${changes} changes.`,
      );
    return changes;
  }

  async initTables() {
    try {
      // 0. Ensure tests table has required columns for the new schema
      await this.pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'test_category_id') THEN
            ALTER TABLE tests ADD COLUMN test_category_id INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'exam_id') THEN
            ALTER TABLE tests ADD COLUMN exam_id VARCHAR(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'slug') THEN
            ALTER TABLE tests ADD COLUMN slug VARCHAR(255) UNIQUE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'stage_ids') THEN
            ALTER TABLE tests ADD COLUMN stage_ids INTEGER[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'tags') THEN
            ALTER TABLE tests ADD COLUMN tags TEXT[] DEFAULT '{}';
          END IF;

          -- Migration: Populate slugs for existing tests that don't have one
          UPDATE tests 
          SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || id
          WHERE slug IS NULL OR slug = '';
        END $$;
      `);

      // 1. Create stages table (essential for various route handlers)
      // FIXED: All columns now use snake_case (PostgreSQL convention)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS stages (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          icon VARCHAR(50),
          exam_ids VARCHAR(255)[] DEFAULT '{}',
          "order" INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // 2. Ensure users table has pro-pass and subscription-related columns
      await this.pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_pro_user') THEN
            ALTER TABLE users ADD COLUMN is_pro_user BOOLEAN DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pro_expiry') THEN
            ALTER TABLE users ADD COLUMN pro_expiry TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pass_type') THEN
            ALTER TABLE users ADD COLUMN pass_type VARCHAR(50) DEFAULT 'free';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'enrolled_series') THEN
            ALTER TABLE users ADD COLUMN enrolled_series INTEGER[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'enrolled_exams') THEN
            ALTER TABLE users ADD COLUMN enrolled_exams INTEGER[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'enrolled_study_materials') THEN
            ALTER TABLE users ADD COLUMN enrolled_study_materials INTEGER[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar') THEN
            ALTER TABLE users ADD COLUMN avatar TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'banner') THEN
            ALTER TABLE users ADD COLUMN banner TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
            ALTER TABLE users ADD COLUMN phone VARCHAR(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'date_of_birth') THEN
            ALTER TABLE users ADD COLUMN date_of_birth VARCHAR(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'location') THEN
            ALTER TABLE users ADD COLUMN location VARCHAR(200);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'education') THEN
            ALTER TABLE users ADD COLUMN education VARCHAR(200);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
            ALTER TABLE users ADD COLUMN bio TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notification_preferences') THEN
            ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{}'::jsonb;
          END IF;
           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'privacy') THEN
             ALTER TABLE users ADD COLUMN privacy JSONB DEFAULT '{"profileVisibility":"public","showProgress":true,"showOnLeaderboard":true,"allowMessages":true}'::jsonb;
           END IF;
           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'refresh_token_version') THEN
             ALTER TABLE users ADD COLUMN refresh_token_version INTEGER DEFAULT 0;
           END IF;
           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_password_token') THEN
             ALTER TABLE users ADD COLUMN reset_password_token TEXT;
           END IF;
           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_password_expires') THEN
             ALTER TABLE users ADD COLUMN reset_password_expires TIMESTAMP;
           END IF;
           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_email_verified') THEN
             ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT true;
             -- Backfill existing users so they are not locked out
             UPDATE users SET is_email_verified = true WHERE is_email_verified IS NULL;
           END IF;
         END $$;
      `);

      // 3. Ensure attempts table has review and reattempt functionality columns
      await this.pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'marked_for_review') THEN
            ALTER TABLE attempts ADD COLUMN marked_for_review JSONB DEFAULT '[]'::jsonb;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'is_completed') THEN
            ALTER TABLE attempts ADD COLUMN is_completed BOOLEAN DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'is_reattempt') THEN
            ALTER TABLE attempts ADD COLUMN is_reattempt BOOLEAN DEFAULT false;
          END IF;
        END $$;
      `);

      // 4. Ensure test_series & test_categories have required columns
      await this.pool.query(`
        DO $$ 
        BEGIN 
          -- stages updates
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stages' AND column_name = 'icon') THEN
            ALTER TABLE stages ADD COLUMN icon VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stages' AND column_name = 'exam_ids') THEN
            ALTER TABLE stages ADD COLUMN exam_ids VARCHAR(255)[] DEFAULT '{}';
          ELSIF (SELECT udt_name FROM information_schema.columns WHERE table_name = 'stages' AND column_name = 'exam_ids') = '_int4' THEN
            ALTER TABLE stages ALTER COLUMN exam_ids TYPE VARCHAR(255)[] USING exam_ids::VARCHAR(255)[];
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stages' AND column_name = 'category_ids') THEN
            ALTER TABLE stages ADD COLUMN category_ids VARCHAR(255)[] DEFAULT '{}';
          ELSIF (SELECT udt_name FROM information_schema.columns WHERE table_name = 'stages' AND column_name = 'category_ids') = '_int4' THEN
            ALTER TABLE stages ALTER COLUMN category_ids TYPE VARCHAR(255)[] USING category_ids::VARCHAR(255)[];
          END IF;

          -- test_series updates
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'sections') THEN
            ALTER TABLE test_series ADD COLUMN sections JSONB DEFAULT '[]'::jsonb;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'languages') THEN
            ALTER TABLE test_series ADD COLUMN languages JSONB DEFAULT '[]'::jsonb;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'colour_hex') THEN
            ALTER TABLE test_series ADD COLUMN colour_hex VARCHAR(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'total_attempts') THEN
            ALTER TABLE test_series ADD COLUMN total_attempts INTEGER DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'stages') THEN
            ALTER TABLE test_series ADD COLUMN stages INTEGER[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'is_coming_soon') THEN
            ALTER TABLE test_series ADD COLUMN is_coming_soon BOOLEAN DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_series' AND column_name = 'order') THEN
            ALTER TABLE test_series ADD COLUMN "order" INTEGER DEFAULT 0;
          END IF;

          -- study_materials updates (add order column)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_materials' AND column_name = 'order') THEN
            ALTER TABLE study_materials ADD COLUMN "order" INTEGER DEFAULT 0;
          END IF;

          -- tests updates (add category path columns)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'category_path_ids') THEN
            ALTER TABLE tests ADD COLUMN category_path_ids TEXT[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'category_path_names') THEN
            ALTER TABLE tests ADD COLUMN category_path_names TEXT[] DEFAULT '{}';
          END IF;

          -- test_categories updates
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'exam_category_id') THEN
            ALTER TABLE test_categories ADD COLUMN exam_category_id VARCHAR(255);
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'stage_id') THEN
            ALTER TABLE test_categories DROP COLUMN stage_id;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'stage_ids') THEN
            ALTER TABLE test_categories ADD COLUMN stage_ids INTEGER[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'display_order') THEN
            ALTER TABLE test_categories ADD COLUMN display_order INTEGER DEFAULT 0;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'order_index') THEN
            UPDATE test_categories SET display_order = order_index WHERE display_order = 0 AND order_index != 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'is_deleted') THEN
            ALTER TABLE test_categories ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'deleted_by') THEN
            ALTER TABLE test_categories ADD COLUMN deleted_by INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'deleted_at') THEN
            ALTER TABLE test_categories ADD COLUMN deleted_at TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'public_id_uuid') THEN
            ALTER TABLE test_categories ADD COLUMN public_id_uuid UUID DEFAULT gen_random_uuid();
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'public_id') THEN
            ALTER TABLE test_categories ADD COLUMN public_id TEXT GENERATED ALWAYS AS ('tct_' || public_id_uuid::text) STORED;
          END IF;

          -- NEW: Add test series relationship (replace exam category linkage)
          -- Support multiple test series per category using array
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'test_series_id') THEN
            ALTER TABLE test_categories ADD COLUMN test_series_id INTEGER[] DEFAULT '{}';
            CREATE INDEX IF NOT EXISTS idx_test_categories_test_series_id ON test_categories USING GIN(test_series_id);
          ELSIF (SELECT udt_name FROM information_schema.columns WHERE table_name = 'test_categories' AND column_name = 'test_series_id') = 'int4' THEN
            -- Drop any FK constraints on this column BEFORE altering its type.
            -- PostgreSQL cannot change a column's type while a FK constraint is active.
            -- FKs on INTEGER[] array columns are not supported by PostgreSQL anyway.
            ALTER TABLE test_categories DROP CONSTRAINT IF EXISTS test_categories_test_series_id_fkey;
            -- Convert existing integer column to array
            ALTER TABLE test_categories ALTER COLUMN test_series_id TYPE INTEGER[] USING ARRAY[test_series_id];
            ALTER TABLE test_categories ALTER COLUMN test_series_id SET DEFAULT '{}';
            CREATE INDEX IF NOT EXISTS idx_test_categories_test_series_id ON test_categories USING GIN(test_series_id);
          END IF;


          -- exam_categories updates (stage_ids removed - exam categories should not be linked to stages)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_categories' AND column_name = 'display_order') THEN
            ALTER TABLE exam_categories ADD COLUMN display_order INTEGER DEFAULT 0;
          END IF;

          -- exams table (acts as subcategories in current schema)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'stage_ids') THEN
            ALTER TABLE exams ADD COLUMN stage_ids INTEGER[] DEFAULT '{}';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'display_order') THEN
            ALTER TABLE exams ADD COLUMN display_order INTEGER DEFAULT 0;
          END IF;
        END $$;
      `);

      // 5. Create New Hierarchy Tables
      await this.pool.query(`
        -- Subject Parts
        CREATE TABLE IF NOT EXISTS "subject_parts" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
          stage_ids INTEGER[] DEFAULT '{}',
          order_index INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Units
        CREATE TABLE IF NOT EXISTS "units" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          part_id INTEGER REFERENCES subject_parts(id) ON DELETE SET NULL,
          subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
          stage_ids INTEGER[] DEFAULT '{}',
          order_index INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Migration 056: Backfill part_id on pre-existing units tables
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'units')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'part_id') THEN
            ALTER TABLE units ADD COLUMN part_id INTEGER REFERENCES subject_parts(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_units_part_id ON units(part_id);
          END IF;
        END $$;

        -- Subtopics
        CREATE TABLE IF NOT EXISTS "subtopics" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE,
          stage_ids INTEGER[] DEFAULT '{}',
          order_index INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // 6. Update existing tables for Hierarchy and Stages
      await this.pool.query(`
        DO $$ 
        BEGIN 
          -- Update Subjects
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'stage_ids') THEN
            ALTER TABLE subjects ADD COLUMN stage_ids INTEGER[] DEFAULT '{}';
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'parent_id') THEN
            ALTER TABLE subjects ADD COLUMN parent_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'color') THEN
            ALTER TABLE subjects ADD COLUMN color VARCHAR(7) DEFAULT '#667eea';
          END IF;

          -- Update Chapters
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapters' AND column_name = 'unit_id') THEN
            ALTER TABLE chapters ADD COLUMN unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chapters' AND column_name = 'stage_ids') THEN
            ALTER TABLE chapters ADD COLUMN stage_ids INTEGER[] DEFAULT '{}';
          END IF;

          -- Update Topics
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'chapter_id') THEN
            ALTER TABLE topics ADD COLUMN chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'stage_ids') THEN
            ALTER TABLE topics ADD COLUMN stage_ids INTEGER[] DEFAULT '{}';
          END IF;

          -- Update Questions and Tests for Hub-based model
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'series_id') THEN
            ALTER TABLE tests ADD COLUMN series_id INTEGER REFERENCES test_series(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'stage_id') THEN
            ALTER TABLE tests ADD COLUMN stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'category_path_ids') THEN
            ALTER TABLE tests ADD COLUMN category_path_ids JSONB DEFAULT '[]'::jsonb;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'category_path_names') THEN
            ALTER TABLE tests ADD COLUMN category_path_names JSONB DEFAULT '[]'::jsonb;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'is_coming_soon') THEN
            ALTER TABLE tests ADD COLUMN is_coming_soon BOOLEAN DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'languages') THEN
            ALTER TABLE tests ADD COLUMN languages JSONB DEFAULT '[]'::jsonb;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tests' AND column_name = 'coming_soon_date') THEN
            ALTER TABLE tests ADD COLUMN coming_soon_date TIMESTAMP WITHOUT TIME ZONE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'series_id') THEN
            ALTER TABLE questions ADD COLUMN series_id INTEGER REFERENCES test_series(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'category_id') THEN
            ALTER TABLE questions ADD COLUMN category_id VARCHAR(255);
            -- Clean invalid category_id values before adding constraint
            UPDATE questions SET category_id = NULL WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT category_id FROM exam_categories);
            ALTER TABLE questions ADD CONSTRAINT questions_category_id_fkey FOREIGN KEY (category_id) REFERENCES exam_categories(category_id) ON DELETE SET NULL;
          END IF;
          -- sub_category_id removed (exam_sub_categories table no longer exists)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'sub_category_id') THEN
            ALTER TABLE questions ADD COLUMN sub_category_id VARCHAR(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'study_material_id') THEN
            ALTER TABLE questions ADD COLUMN study_material_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'topic_id') THEN
            ALTER TABLE questions ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'quiz_id') THEN
            ALTER TABLE questions ADD COLUMN quiz_id INTEGER;
          END IF;

          -- FIX PQ-01/PQ-02: Add explicit is_practice flag to questions table
          -- This replaces the fragile pattern of relying on null testId to distinguish practice questions
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'is_practice') THEN
            ALTER TABLE questions ADD COLUMN is_practice BOOLEAN DEFAULT false;
            -- Backfill: mark existing practice questions (category='practice' or no test_id)
            UPDATE questions SET is_practice = true WHERE category = 'practice' OR test_id IS NULL;
          END IF;

          -- Update Subject Parts
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_parts' AND column_name = 'description') THEN
            ALTER TABLE subject_parts ADD COLUMN description TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_parts' AND column_name = 'icon') THEN
            ALTER TABLE subject_parts ADD COLUMN icon VARCHAR(100);
          END IF;

          -- Update Units
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'description') THEN
            ALTER TABLE units ADD COLUMN description TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'units' AND column_name = 'icon') THEN
            ALTER TABLE units ADD COLUMN icon VARCHAR(100);
          END IF;

          -- Update Subtopics
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subtopics' AND column_name = 'description') THEN
            ALTER TABLE subtopics ADD COLUMN description TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subtopics' AND column_name = 'icon') THEN
            ALTER TABLE subtopics ADD COLUMN icon VARCHAR(100);
          END IF;
        END $$;
      `);

      // 7. Ensure exam_info table exists
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS "exam_info" (
          id SERIAL PRIMARY KEY,
          category_id VARCHAR(255),
          exam_id VARCHAR(255),
          year INTEGER,
          title VARCHAR(255),
          full_name VARCHAR(500),
          description TEXT,
          notification TEXT,
          series_id VARCHAR(255),
          eligibility TEXT,
          age_limit VARCHAR(255),
          syllabus TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // 8. Ensure core curriculum tables exist
      await this.pool.query(`
        -- Subjects table (study materials)
        CREATE TABLE IF NOT EXISTS "subjects" (
          id SERIAL PRIMARY KEY,
          public_id_uuid UUID DEFAULT gen_random_uuid(),
          public_id TEXT GENERATED ALWAYS AS ('subj_' || public_id_uuid::text) STORED,
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          icon VARCHAR(100),
          color VARCHAR(7) DEFAULT '#667eea',
          parent_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
          "order" INTEGER DEFAULT 0,
          stage_ids INTEGER[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Chapters table
        CREATE TABLE IF NOT EXISTS "chapters" (
          id SERIAL PRIMARY KEY,
          public_id_uuid UUID DEFAULT gen_random_uuid(),
          public_id TEXT GENERATED ALWAYS AS ('chp_' || public_id_uuid::text) STORED,
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          study_material_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
          unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
          stage_ids INTEGER[] DEFAULT '{}',
          order_index INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Topics table
        CREATE TABLE IF NOT EXISTS "topics" (
          id SERIAL PRIMARY KEY,
          public_id_uuid UUID DEFAULT gen_random_uuid(),
          public_id TEXT GENERATED ALWAYS AS ('tpc_' || public_id_uuid::text) STORED,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
          stage_ids INTEGER[] DEFAULT '{}',
          order_index INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Backups table
        CREATE TABLE IF NOT EXISTS "backups" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) DEFAULT 'manual',
          status VARCHAR(50) DEFAULT 'completed',
          size VARCHAR(50) DEFAULT '0 MB',
          created_by INTEGER,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_public_id ON subjects(public_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_chapters_public_id ON chapters(public_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_topics_public_id ON topics(public_id);
      `);

      // 9. Ensure pyp_papers table exists and has linking columns
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS "pyp_papers" (
          id SERIAL PRIMARY KEY,
          exam_id VARCHAR(255),
          year INTEGER,
          shift VARCHAR(100),
          title VARCHAR(255) NOT NULL,
          duration INTEGER,
          total_marks INTEGER,
          questions JSONB DEFAULT '[]'::jsonb,
          solutions JSONB DEFAULT '[]'::jsonb,
          difficulty VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "pyp_attempts" (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          pyp_id INTEGER REFERENCES pyp_papers(id) ON DELETE CASCADE,
          answers JSONB DEFAULT '[]'::jsonb,
          score NUMERIC(10, 2),
          percentage NUMERIC(5, 2),
          correct_count INTEGER,
          time_spent INTEGER,
          question_results JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Live Tests Table
        CREATE TABLE IF NOT EXISTS "live_tests" (
          id SERIAL PRIMARY KEY,
          test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          result_time TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- UI Tag Configurations
        CREATE TABLE IF NOT EXISTS "ui_tag_configs" (
          id SERIAL PRIMARY KEY,
          tag_id VARCHAR(100) NOT NULL UNIQUE,
          label VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(100),
          color VARCHAR(50) DEFAULT 'blue',
          route VARCHAR(255),
          filter_key VARCHAR(100),
          filter_value VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pyp_papers' AND column_name = 'series_id') THEN
            ALTER TABLE pyp_papers ADD COLUMN series_id INTEGER REFERENCES test_series(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pyp_papers' AND column_name = 'stage_id') THEN
            ALTER TABLE pyp_papers ADD COLUMN stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pyp_papers' AND column_name = 'category_id') THEN
            ALTER TABLE pyp_papers ADD COLUMN category_id VARCHAR(255);
            -- Optional: ALTER TABLE pyp_papers ADD CONSTRAINT pyp_category_fkey FOREIGN KEY (category_id) REFERENCES exam_categories(category_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pyp_papers' AND column_name = 'sub_category_id') THEN
            ALTER TABLE pyp_papers ADD COLUMN sub_category_id VARCHAR(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pyp_papers' AND column_name = 'category_path_ids') THEN
            ALTER TABLE pyp_papers ADD COLUMN category_path_ids JSONB DEFAULT '[]'::jsonb;
          END IF;
        END $$;
      `);

      // 10. Audit Notifications and Attempt-Events Tables
      await this.pool.query(`
        -- Audit Notifications
        CREATE TABLE IF NOT EXISTS "notifications" (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info',
          channel VARCHAR(50) DEFAULT 'in_app',
          read BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'channel') THEN
            ALTER TABLE notifications ADD COLUMN channel VARCHAR(50) DEFAULT 'in_app';
          END IF;
        END $$;

        -- Audit Attempt Events (for anti-cheat)
        CREATE TABLE IF NOT EXISTS "attempt_events" (
          id SERIAL PRIMARY KEY,
          attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
          event_type VARCHAR(100) NOT NULL,
          question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
          event_data JSONB DEFAULT '{}'::jsonb,
          event_timestamp TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Audit Question Attempts (per question analytics)
        CREATE TABLE IF NOT EXISTS "question_attempts" (
          id SERIAL PRIMARY KEY,
          attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
          question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
          selected_option INTEGER,
          is_marked_for_review BOOLEAN DEFAULT false,
          time_spent_seconds INTEGER DEFAULT 0,
          visits_count INTEGER DEFAULT 0,
          last_viewed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_attempts' AND column_name = 'time_spent_seconds') THEN
            ALTER TABLE question_attempts ADD COLUMN time_spent_seconds INTEGER DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_attempts' AND column_name = 'visits_count') THEN
            ALTER TABLE question_attempts ADD COLUMN visits_count INTEGER DEFAULT 0;
          END IF;
        END $$;

        -- Audit Subscriptions and Plans
        CREATE TABLE IF NOT EXISTS "subscription_plans" (
          id SERIAL PRIMARY KEY,
          plan_id VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          price DECIMAL(10, 2) NOT NULL,
          original_price DECIMAL(10, 2),
          period VARCHAR(20) NOT NULL,
          features JSONB DEFAULT '[]'::jsonb,
          button_text VARCHAR(50),
          button_class VARCHAR(50),
          popular BOOLEAN DEFAULT false,
          savings VARCHAR(20),
          is_active BOOLEAN DEFAULT true,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "subscriptions" (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          plan_type VARCHAR(50) NOT NULL,
          start_date TIMESTAMP DEFAULT NOW(),
          expiry_date TIMESTAMP NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          auto_renew BOOLEAN DEFAULT false,
          payment_method VARCHAR(50),
          transaction_id VARCHAR(100),
          amount_paid DECIMAL(10, 2),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "subscription_features" (
          id SERIAL PRIMARY KEY,
          plan_type VARCHAR(50) NOT NULL,
          feature_key VARCHAR(100) NOT NULL,
          is_enabled BOOLEAN DEFAULT true,
          limit_value INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(plan_type, feature_key)
        );

        -- Audit Activity Logs
        CREATE TABLE IF NOT EXISTS "activity_logs" (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(100) NOT NULL,
          description TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Admin Audit Logs (for security compliance)
        CREATE TABLE IF NOT EXISTS "audit_logs" (
          id SERIAL PRIMARY KEY,
          action VARCHAR(50) NOT NULL,
          resource VARCHAR(100) NOT NULL,
          resource_id VARCHAR(255),
          admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          admin_email VARCHAR(255),
          admin_name VARCHAR(255),
          ip_address VARCHAR(100),
          user_agent TEXT,
          details JSONB DEFAULT '{}'::jsonb,
          status VARCHAR(20) DEFAULT 'success',
          request_method VARCHAR(10),
          request_path TEXT,
          response_status_code INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at DESC);

        -- Login attempts tracking for brute force protection
        CREATE TABLE IF NOT EXISTS "login_attempts" (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          ip_address VARCHAR(100) NOT NULL,
          attempted_at TIMESTAMP DEFAULT NOW(),
          successful BOOLEAN DEFAULT false
        );
        CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at DESC);

        -- User sessions for tracking login activity
        CREATE TABLE IF NOT EXISTS "user_sessions" (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL,
          session_id VARCHAR(255) UNIQUE NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          device_type VARCHAR(50),
          browser VARCHAR(50),
          os VARCHAR(50),
          country VARCHAR(100),
          country_code VARCHAR(10),
          city VARCHAR(100),
          region VARCHAR(100),
          session_type VARCHAR(50) DEFAULT 'web',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

        -- Audit Test Series and relationship in Attempts
        CREATE TABLE IF NOT EXISTS "test_series" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          image TEXT,
          total_attempts INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attempts' AND column_name = 'series_id') THEN
            ALTER TABLE attempts ADD COLUMN series_id INTEGER;
          END IF;

          -- Add display_order to resource tables for reordering
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_videos' AND column_name = 'display_order') THEN
            ALTER TABLE subject_videos ADD COLUMN display_order INTEGER DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_pdfs' AND column_name = 'display_order') THEN
            ALTER TABLE subject_pdfs ADD COLUMN display_order INTEGER DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_tests' AND column_name = 'display_order') THEN
            ALTER TABLE topic_tests ADD COLUMN display_order INTEGER DEFAULT 0;
          END IF;

          -- Add topic_id to resource tables so content can be linked to a specific topic
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_videos' AND column_name = 'topic_id') THEN
            ALTER TABLE subject_videos ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_pdfs' AND column_name = 'topic_id') THEN
            ALTER TABLE subject_pdfs ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_tests' AND column_name = 'topic_id') THEN
            ALTER TABLE topic_tests ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);

      // ═══════════════════════════════════════════════════
      // 11. Practice Lab tables (see docs/PRACTICE_LAB_PRD.md)
      // ═══════════════════════════════════════════════════
      await this.pool.query(`
        -- Tracks one practice session (a user practicing N questions in mode M on topic T)
        CREATE TABLE IF NOT EXISTS "practice_sessions" (
          id              SERIAL PRIMARY KEY,
          user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          exam_id         VARCHAR(255),
          subject_id      INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
          chapter_id      INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
          topic_id        INTEGER REFERENCES topics(id) ON DELETE SET NULL,
          mode            VARCHAR(32) NOT NULL,
          difficulty      VARCHAR(16),
          target_count    INTEGER,
          time_limit_sec  INTEGER,
          questions_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
          current_index   INTEGER DEFAULT 0,
          correct_count   INTEGER DEFAULT 0,
          wrong_count      INTEGER DEFAULT 0,
          skipped_count   INTEGER DEFAULT 0,
          started_at      TIMESTAMP DEFAULT NOW(),
          last_active_at  TIMESTAMP,
          completed_at    TIMESTAMP,
          is_active       BOOLEAN DEFAULT true
        );
        CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id, is_active);

        -- Per-question answer log — this is the "wrong-question notebook" source
        CREATE TABLE IF NOT EXISTS "practice_answers" (
          id              SERIAL PRIMARY KEY,
          user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_id      INTEGER REFERENCES practice_sessions(id) ON DELETE CASCADE,
          question_id     INTEGER NOT NULL,
          selected_option INTEGER,
          is_correct      BOOLEAN,
          is_skipped      BOOLEAN DEFAULT false,
          time_taken_sec  INTEGER,
          mode            VARCHAR(32),
          created_at      TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, question_id, session_id)
        );
        CREATE INDEX IF NOT EXISTS idx_practice_answers_user_q ON practice_answers(user_id, question_id);
        CREATE INDEX IF NOT EXISTS idx_practice_answers_wrong ON practice_answers(user_id, is_correct) WHERE is_correct = false;

        -- Bookmark a question for later re-practice
        CREATE TABLE IF NOT EXISTS "question_bookmarks" (
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_id  INTEGER NOT NULL,
          created_at   TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (user_id, question_id)
        );

        -- One row per user, updated on every session completion (streak tracking)
        CREATE TABLE IF NOT EXISTS "practice_streaks" (
          user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          current_streak    INTEGER DEFAULT 0,
          longest_streak    INTEGER DEFAULT 0,
          last_practice_date DATE,
          total_sessions    INTEGER DEFAULT 0,
          total_questions   INTEGER DEFAULT 0,
          total_correct     INTEGER DEFAULT 0
        );

        -- Caches AI-generated extras per question so we only pay for the first generation
        CREATE TABLE IF NOT EXISTS "practice_ai_cache" (
          question_id    INTEGER NOT NULL,
          feature        VARCHAR(32) NOT NULL,
          content        JSONB NOT NULL,
          model          VARCHAR(64),
          generated_at   TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (question_id, feature)
        );

        -- One curated set per user per day (Daily Practice mode)
        CREATE TABLE IF NOT EXISTS "practice_daily_sets" (
          id           SERIAL PRIMARY KEY,
          user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          set_date     DATE NOT NULL,
          questions    JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_completed BOOLEAN DEFAULT false,
          score        INTEGER,
          created_at   TIMESTAMP DEFAULT NOW(),
          UNIQUE (user_id, set_date)
        );

        -- User reports a bad/ambiguous question
        CREATE TABLE IF NOT EXISTS "question_reports" (
          id           SERIAL PRIMARY KEY,
          user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
          question_id  INTEGER NOT NULL,
          reason       VARCHAR(100),
          notes        TEXT,
          status       VARCHAR(32) DEFAULT 'open',
          created_at   TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_question_reports_q ON question_reports(question_id);
      `);

      console.log("✅ Database schema verified and initialized.");
      await ensureTestSectionsSchema();
      const relationshipChanges = await this.reconcileRelationships();
      if (relationshipChanges > 0) {
        console.log(
          `[DB] Applied ${relationshipChanges} relationship fix(es).`,
        );
       }

       // Create CSRF tokens table for token-based CSRF protection (Issue #8)
       await this.pool.query(`
         CREATE TABLE IF NOT EXISTS "csrf_tokens" (
           id SERIAL PRIMARY KEY,
           csrf_token TEXT UNIQUE NOT NULL,
           user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
           expires_at TIMESTAMP NOT NULL,
           created_at TIMESTAMP DEFAULT NOW()
         )
       `);
       await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens(expires_at)`);

       return true;
    } catch (error) {
      console.error("❌ Database Initialization Error:", error.message);
      // Don't crash here, as tables might already be present or being managed externally
      return false;
    }
  }

  getTableName(collection) {
    return this.tableMap[collection] || collection;
  }

  toCamel(row) {
    if (!row) return null;
    const newRow = {};
    for (const key in row) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      newRow[camelKey] = row[key];
      if (key === "id") newRow._id = row[key];
    }
    return newRow;
  }

  toSnake(obj, collection = null) {
    if (!obj) return null;
    const newObj = {};
    for (const key in obj) {
      if (key === "_id") continue;
      const snakeKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      newObj[snakeKey] = obj[key];
    }
    return newObj;
  }

  async find(collection, query = {}, limit = null, offset = null) {
    const table = this.getTableName(collection);

    // Extract includeInactive/include_inactive to support opt-out
    const cleanQuery = { ...query };
    const includeInactive = cleanQuery.includeInactive === true || cleanQuery.include_inactive === true;
    delete cleanQuery.includeInactive;
    delete cleanQuery.include_inactive;

    // Default isActive: true scope if the table contains 'is_active'
    const hasActive = await this.columnExists(table, "is_active");
    if (hasActive && !includeInactive && cleanQuery.isActive === undefined && cleanQuery.is_active === undefined) {
      cleanQuery.is_active = true;
    }

    let sql = `SELECT * FROM "${table}"`;
    const values = [];
    const conditions = [];
    let i = 1;

    const snakeQuery = this.toSnake(cleanQuery, collection);

    for (const key in snakeQuery) {
      const value = snakeQuery[key];

      if (
        (key === "id" || key === "_id") &&
        typeof value === "string" &&
        value.includes("-")
      ) {
        continue;
      }

      let processedValue = value;
      if (
        (key === "id" || key === "_id") &&
        typeof value === "string" &&
        /^[0-9]+$/.test(value)
      ) {
        processedValue = parseInt(value, 10);
      }
      if (processedValue === null) {
        conditions.push(`"${key}" IS NULL`);
      } else if (typeof processedValue !== "object") {
        conditions.push(`"${key}" = $${i}`);
        values.push(processedValue);
        i++;
      } else {
        // Handle operators
        if (processedValue.$gt) {
          conditions.push(`"${key}" > $${i}`);
          values.push(processedValue.$gt);
          i++;
        } else if (processedValue.$lt) {
          conditions.push(`"${key}" < $${i}`);
          values.push(processedValue.$lt);
          i++;
        } else if (processedValue.$gte) {
          conditions.push(`"${key}" >= $${i}`);
          values.push(processedValue.$gte);
          i++;
        } else if (processedValue.$lte) {
          conditions.push(`"${key}" <= $${i}`);
          values.push(processedValue.$lte);
          i++;
        } else if (processedValue.$in && Array.isArray(processedValue.$in)) {
          if (processedValue.$in.length > 0) {
            const placeholders = processedValue.$in
              .map(() => `$${i++}`)
              .join(", ");
            conditions.push(`"${key}" IN (${placeholders})`);
            values.push(...processedValue.$in);
          } else {
            conditions.push("1=0"); // Always false for empty IN
          }
        }
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Default ordering to ensure consistent pagination if limit/offset is used
    if (limit !== null || offset !== null) {
      sql += ` ORDER BY id ASC`;
    }

    if (limit !== null) {
      sql += ` LIMIT $${i}`;
      values.push(limit);
      i++;
    }
    if (offset !== null) {
      sql += ` OFFSET $${i}`;
      values.push(offset);
      i++;
    }

    try {
      const result = await this.pool.query(sql, values);
      return result.rows.map((row) => this.toCamel(row));
    } catch (error) {
      console.error(`DB Find Error (${collection}):`, error.message);
      return [];
    }
  }

  async findById(collection, id) {
    const table = this.getTableName(collection);

    if (typeof id === "string") {
      const trimmedId = id.trim();
      if (!trimmedId) {
        return null;
      }

      if (this.isValidPublicId(trimmedId, table)) {
        return this.findByPublicId(collection, trimmedId);
      }

      if (trimmedId.includes("-")) {
        return null;
      }
    }

    const numericId = parseNumericId(id);
    if (numericId === null) {
      return null;
    }

    try {
      const result = await this.pool.query(
        `SELECT * FROM "${table}" WHERE id = $1`,
        [numericId],
      );
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`DB FindById Error (${collection}):`, error.message);
      return null;
    }
  }

  async findOne(collection, query) {
    const items = await this.find(collection, query);
    return items[0] || null;
  }

  /**
   * Generate prefixed public_id for an entity (ELITE: UUID + GENERATED pattern)
   * @param {string} entityType - Entity type (e.g., 'users', 'tests')
   * @returns {object} { uuid, publicId } - Both UUID and prefixed ID
   */
  generatePublicId(entityType) {
    const prefix = ENTITY_PREFIXES[entityType] || "ent_";
    const uuid = randomUUID();
    return {
      uuid,
      publicId: `${prefix}${uuid}`,
    };
  }

  /**
   * Generate raw UUID (for public_id_uuid column)
   * @returns {string} UUID v4
   */
  generateUuid() {
    return randomUUID();
  }

  /**
   * Parse public_id into components (for routing, logging, debugging)
   * @param {string} publicId - The public_id to parse
   * @returns {object|null} { prefix, uuid, entityType } or null if invalid
   */
  parsePublicId(publicId) {
    if (!publicId || typeof publicId !== "string") return null;

    const underscoreIndex = publicId.indexOf("_");
    if (underscoreIndex === -1) return null;

    const prefix = publicId.substring(0, underscoreIndex + 1);
    const uuid = publicId.substring(underscoreIndex + 1);

    // Find entity type from prefix
    const entityType =
      Object.entries(ENTITY_PREFIXES).find(([_, p]) => p === prefix)?.[0] ||
      "unknown";

    return { prefix, uuid, entityType };
  }

  /**
   * Insert with auto-generated public_id (ELITE: UUID + GENERATED pattern)
   * With GENERATED column, we only need to set public_id_uuid
   * The public_id TEXT column is computed automatically: 'prefix' || public_id_uuid::text
   * @param {string} collection - Collection name
   * @param {object} data - Record data
   * @param {string} entityType - Entity type for prefix (defaults to collection name)
   */
  async insertWithPublicId(collection, data, entityType = null) {
    const type = entityType || collection;
    const prefix = ENTITY_PREFIXES[type] || "ent_";

    // For UUID + GENERATED pattern, we set public_id_uuid, not public_id
    // The GENERATED column will compute public_id = prefix + uuid automatically
    let uuid = data.publicIdUuid || data.public_id_uuid;

    // If caller provided a prefixed ID, extract the UUID
    if (!uuid && (data.publicId || data.public_id)) {
      const publicId = data.publicId || data.public_id;
      const parsed = this.parsePublicId(publicId);
      if (parsed) {
        uuid = parsed.uuid;
      }
    }

    // Generate new UUID if not provided
    if (!uuid) {
      uuid = this.generateUuid();
    }

    // Remove public_id fields (GENERATED column handles this)
    const {
      publicId: _,
      public_id: __,
      publicIdUuid: ___,
      public_id_uuid: ____,
      ...rest
    } = data;

    // Insert with public_id_uuid (GENERATED column computes public_id automatically)
    return this.insertOne(collection, { ...rest, public_id_uuid: uuid });
  }

  /**
   * Validate public_id format for an entity type
   * @param {string} publicId - The public_id to validate
   * @param {string} entityType - Expected entity type (optional)
   * @returns {boolean} True if valid format
   */
  isValidPublicId(publicId, entityType = null) {
    if (!publicId || typeof publicId !== "string") return false;

    // If entity type specified, validate against its pattern
    if (entityType && PUBLIC_ID_PATTERNS[entityType]) {
      return PUBLIC_ID_PATTERNS[entityType].test(publicId);
    }

    // Otherwise, check if it matches any known prefix pattern
    for (const pattern of Object.values(PUBLIC_ID_PATTERNS)) {
      if (pattern.test(publicId)) return true;
    }
    return false;
  }

  /**
   * Find by public_id (exact match only - ELITE: uses GENERATED column)
   * The public_id TEXT column has a unique index for fast lookups.
   * @param {string} collection - Collection name
   * @param {string} publicId - Public ID (must be full prefixed ID)
   */
  async findByPublicId(collection, publicId) {
    const table = this.getTableName(collection);

    if (!publicId) return null;

    if (!(await this.columnExists(table, "public_id"))) {
      return null;
    }

    // Validate format before querying (fail fast)
    if (!this.isValidPublicId(publicId)) {
      console.warn(`Invalid public_id format: ${publicId}`);
      return null;
    }

    try {
      // CRITICAL: Use exact match only - NEVER use LIKE or partial matching
      // The public_id TEXT column has a unique index for fast lookups
      const result = await this.pool.query(
        `SELECT * FROM "${table}" WHERE public_id = $1 LIMIT 1`,
        [publicId],
      );
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`DB findByPublicId Error (${collection}):`, error.message);
      return null;
    }
  }

  /**
   * Find by public_id_uuid (fastest lookup - direct UUID binary comparison)
   * Use this when you have the raw UUID without prefix.
   * @param {string} collection - Collection name
   * @param {string} uuid - Raw UUID (without prefix)
   */
  async findByPublicIdUuid(collection, uuid) {
    const table = this.getTableName(collection);

    if (!uuid) return null;

    if (!(await this.columnExists(table, "public_id_uuid"))) {
      return null;
    }

    try {
      // Direct UUID lookup - fastest possible (16 bytes binary index)
      const result = await this.pool.query(
        `SELECT * FROM "${table}" WHERE public_id_uuid = $1 LIMIT 1`,
        [uuid],
      );
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(
        `DB findByPublicIdUuid Error (${collection}):`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Check if public_id mode is enabled (kill switch for emergency rollback)
   * @returns {boolean} True if should use public_id in API responses
   */
  shouldUsePublicId() {
    // Environment variable kill switch - instant rollback without DB changes
    // Set USE_PUBLIC_ID=false to instantly revert to integer IDs
    return process.env.USE_PUBLIC_ID !== "false";
  }

  async resolveInternalId(collection, identifier) {
    const table = this.getTableName(collection);

    if (typeof identifier === "string") {
      const trimmedIdentifier = identifier.trim();
      if (!trimmedIdentifier) {
        return null;
      }

      if (this.isValidPublicId(trimmedIdentifier, table)) {
        const record = await this.findByPublicId(collection, trimmedIdentifier);
        return record?.id ?? record?._id ?? null;
      }

      return parseNumericId(trimmedIdentifier);
    }

    return parseNumericId(identifier);
  }

  /**
   * Transform record for API response (ELITE: UUID + GENERATED pattern)
   * With GENERATED column: public_id is computed from public_id_uuid
   * @param {object|Array} record - Database record(s)
   * @param {string} entityType - Entity type (REQUIRED for proper prefix validation)
   * @param {object} options - Options { allowFallback: false }
   */
  toApi(record, entityType = null, options = { allowFallback: false }) {
    if (!record) return null;
    if (Array.isArray(record))
      return record.map((r) => this.toApi(r, entityType, options));

    const { id, publicId, publicIdUuid, deletedAt, ...rest } = record;

    // KILL SWITCH: Instant rollback via environment variable
    // Set USE_PUBLIC_ID=false to instantly revert to integer IDs
    if (!this.shouldUsePublicId()) {
      this.incrementMetric("legacy_id.lookup");
      return {
        id: id,
        _publicId: publicId,
        ...rest,
      };
    }

    this.incrementMetric("public_id.lookup");

    const prefix = ENTITY_PREFIXES[entityType] || "ent_";
    const effectivePublicId =
      publicId || (publicIdUuid ? `${prefix}${publicIdUuid}` : null);

    if (!effectivePublicId) {
      throw new Error(
        `Missing public_id for ${entityType || "unknown"} entity with id=${id}.`,
      );
    }

    const response = {
      id: effectivePublicId,
      _id: id, // CRITICAL: Preserve internal integer ID for relationship mapping
      publicId: effectivePublicId,
      ...rest,
    };

    return response;
  }

  /**
   * Increment metrics for observability (stub - implement with your metrics provider)
   * @param {string} metricName - Name of metric to increment
   */
  incrementMetric(metricName) {
    // Implement with your metrics provider (DataDog, Prometheus, CloudWatch, etc.)
    // Example: metrics.increment(metricName)
    // For now, just log in development
    if (process.env.NODE_ENV === "development") {
      // Silent in production, but could be hooked to a metrics service
    }
  }

  async count(collection, query = {}) {
    const items = await this.find(collection, query);
    return items.length;
  }

  async resolveForeignKeys(table, dbData) {
    const relationships = RELATIONSHIP_DEFINITIONS.filter(
      (r) => r.table === table,
    );
    for (const rel of relationships) {
      const value = dbData[rel.column];
      if (typeof value === "string" && this.isValidPublicId(value)) {
        const collection =
          Object.keys(this.tableMap).find(
            (key) => this.tableMap[key] === rel.foreignTable,
          ) || rel.foreignTable;

        const resolvedId = await this.resolveInternalId(collection, value);
        if (resolvedId !== null) {
          dbData[rel.column] = resolvedId;
        }
      }
    }
  }

  async insertOne(collection, data, client = null) {
    const table = this.getTableName(collection);
    const dbData = this.toSnake(data, collection);

    await this.resolveForeignKeys(table, dbData);

    delete dbData.id;
    delete dbData.created_at;
    delete dbData.updated_at;

    // Filter stage_ids arrays to only contain integers (remove UUID strings)
    if (Array.isArray(dbData.stage_ids)) {
      dbData.stage_ids = dbData.stage_ids.filter(
        (id) => typeof id === "number" || /^\d+$/.test(String(id)),
      );
    }

    // Prepare values - stringify JSONB columns, keep PostgreSQL arrays as-is
    const prepared = prepareDbValues(table, dbData);
    const keys = Object.keys(prepared);
    const values = Object.values(prepared);

    if (keys.length === 0) return null;

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders}) RETURNING *`;

    try {
      const db = client || this.pool;
      const result = await db.query(sql, values);
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`DB Insert Error (${collection}):`, error.message);
      throw error;
    }
  }

  async insertMany(collection, items, client = null) {
    if (client) {
      const results = [];
      for (const item of items) {
        results.push(await this.insertOne(collection, item, client));
      }
      return results;
    }

    // Default to transactional behavior for insertMany if no client provided
    return await this.withTransaction(async (dbClient) => {
      const results = [];
      for (const item of items) {
        results.push(await this.insertOne(collection, item, dbClient));
      }
      return results;
    });
  }

  async updateById(collection, id, data) {
    const table = this.getTableName(collection);
    const dbData = this.toSnake(data, collection);

    await this.resolveForeignKeys(table, dbData);

    // Remove fields that shouldn't be updated
    delete dbData.id;
    delete dbData._id;
    delete dbData.created_at;
    dbData.updated_at = new Date();

    // Filter stage_ids arrays to only contain integers (remove UUID strings)
    if (Array.isArray(dbData.stage_ids)) {
      dbData.stage_ids = dbData.stage_ids.filter(
        (id) => typeof id === "number" || /^\d+$/.test(String(id)),
      );
    }

    // Prepare values - stringify JSONB columns, keep PostgreSQL arrays as-is
    const prepared = prepareDbValues(table, dbData);

    // Filter to only columns that actually exist in the table
    const colResult = await this.pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table],
    );
    const existingColumns = new Set(colResult.rows.map((r) => r.column_name));
    const keys = Object.keys(prepared).filter((k) => existingColumns.has(k));
    const values = keys.map((k) => prepared[k]);

    if (keys.length === 0) return null;

    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(", ");

    const numericId = await this.resolveInternalId(collection, id);
    if (numericId === null) return null;
    values.push(numericId);

    const sql = `UPDATE "${table}" SET ${setClause} WHERE id = $${values.length} RETURNING *`;

    // Log database update operations in camelCase
    const camelKeys = keys.map((key) =>
      key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
    );
    console.log(
      `\n🗄️  [DB Update] collection: ${collection} | table: ${table}`,
    );
    console.log(`   📝 fields: ${camelKeys.join(", ")}`);
    console.log(`   🔑 id: ${id} (numericId: ${numericId})`);
    console.log(`   📊 sql: ${sql.substring(0, 150)}...`);
    console.log(`   ──`.repeat(25));

    try {
      const result = await this.pool.query(sql, values);
      if (result.rows.length === 0) return null;
      console.log(`   ✅ Updated 1 row in ${table}`);
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`   ❌ DB Update Error (${collection}):`, error.message);
      throw error;
    }
  }

  async deleteById(collection, id) {
    const table = this.getTableName(collection);
    try {
      const numericId = await this.resolveInternalId(collection, id);
      if (numericId === null) {
        return false;
      }
      await this.pool.query(`DELETE FROM "${table}" WHERE id = $1`, [
        numericId,
      ]);
      return true;
    } catch (error) {
      console.error(`DB Delete Error (${collection}):`, error.message);
      return false;
    }
  }

  async deleteMany(collection, query = {}) {
    const table = this.getTableName(collection);
    let sql = `DELETE FROM "${table}"`;
    const values = [];
    const conditions = [];
    let i = 1;

    const snakeQuery = this.toSnake(query, collection);

    for (const key in snakeQuery) {
      const value = snakeQuery[key];

      if (typeof value !== "object" || value === null) {
        conditions.push(`"${key}" = $${i}`);
        values.push(value);
        i++;
      } else {
        // Handle operators
        if (value.$gt) {
          conditions.push(`"${key}" > $${i}`);
          values.push(value.$gt);
          i++;
        } else if (value.$lt) {
          conditions.push(`"${key}" < $${i}`);
          values.push(value.$lt);
          i++;
        } else if (value.$gte) {
          conditions.push(`"${key}" >= $${i}`);
          values.push(value.$gte);
          i++;
        } else if (value.$lte) {
          conditions.push(`"${key}" <= $${i}`);
          values.push(value.$lte);
          i++;
        } else if (value.$in && Array.isArray(value.$in)) {
          if (value.$in.length > 0) {
            const placeholders = value.$in.map(() => `$${i++}`).join(", ");
            conditions.push(`"${key}" IN (${placeholders})`);
            values.push(...value.$in);
          } else {
            conditions.push("1=0"); // Always false for empty IN
          }
        }
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    try {
      const result = await this.pool.query(sql, values);
      return result.rowCount;
    } catch (error) {
      console.error(`DB DeleteMany Error (${collection}):`, error.message);
      return 0;
    }
  }

  async softDelete(collection, id, userId) {
    try {
      const table = this.getTableName(collection);
      // USE STANDARDIZED SOFT-DELETE PATTERN (Migration 008)
      // This uses the columns added by Migration 008: is_deleted, deleted_by, deleted_at
      return await this.updateById(collection, id, { 
        isActive: false, 
        is_deleted: true, 
        deleted_by: userId || null, 
        deleted_at: new Date() 
      });
    } catch (e) {
      console.warn(`Soft delete failed for ${collection}:`, e.message);
      return await this.deleteById(collection, id);
    }
  }

  async getTrashItems(filter = {}) {
    // Note: 'exams' replaces 'examSubCategories' - no separate subcategories table exists
    const collections = [
      "testSeries",
      "tests",
      "questions",
      "studyMaterials",
      "examCategories",
      "exams",
      "testCategories",
      "topics",
      "liveTests",
      "coupons",
      "notifications",
      "leaderboards",
      "subscriptionPlans",
      "videos",
      "subjects",
      "media",
      "navigationMenu",
      "tagConfigs",
    ];
    const allTrashItems = [];

    for (const collection of collections) {
      try {
        const items = await this.find(collection, { isActive: false });
        items.forEach((item) => {
          allTrashItems.push({
            ...item,
            originalCollection: collection,
            deletedAt: item.updatedAt || item.updated_at,
          });
        });
      } catch (e) {
        // Collection might not exist, skip
      }
    }

    // Apply filter if type is specified
    if (filter.originalCollection) {
      return allTrashItems.filter(
        (item) => item.originalCollection === filter.originalCollection,
      );
    }

    return allTrashItems;
  }

  async restoreFromTrash(id) {
    const collections = [
      "testSeries",
      "tests",
      "questions",
      "studyMaterials",
      "examCategories",
      "exams",
      "testCategories",
      "topics",
      "liveTests",
      "coupons",
      "notifications",
      "leaderboards",
      "subscriptionPlans",
      "videos",
      "subjects",
      "media",
      "navigationMenu",
      "tagConfigs",
    ];

    for (const collection of collections) {
      try {
        const item = await this.findById(collection, id);
        if (item && item.isActive === false) {
          const restored = await this.updateById(collection, id, {
            isActive: true,
          });
          return { ...restored, originalCollection: collection };
        }
      } catch (e) {
        // Continue to next collection
      }
    }
    return null;
  }

  async deleteFromTrash(id) {
    // Note: 'exams' replaces 'examSubCategories' - no separate subcategories table exists
    const collections = [
      "testSeries",
      "tests",
      "questions",
      "studyMaterials",
      "examCategories",
      "exams",
      "examInfo",
      "testCategories",
      "topics",
      "liveTests",
      "coupons",
      "notifications",
      "leaderboards",
      "subscriptionPlans",
      "videos",
      "subjects",
      "media",
      "navigationMenu",
      "tagConfigs",
    ];

    for (const collection of collections) {
      try {
        const item = await this.findById(collection, id);
        if (item && item.isActive === false) {
          await this.deleteById(collection, id);
          return true;
        }
      } catch (e) {
        // Continue to next collection
      }
    }
    return false;
  }

  async emptyTrash() {
    // Note: 'exams' replaces 'examSubCategories' - no separate subcategories table exists
    const collections = [
      "testSeries",
      "tests",
      "questions",
      "studyMaterials",
      "examCategories",
      "exams",
      "examInfo",
      "testCategories",
      "topics",
      "liveTests",
      "coupons",
      "notifications",
      "leaderboards",
      "subscriptionPlans",
      "videos",
      "subjects",
      "media",
      "navigationMenu",
      "tagConfigs",
    ];

    for (const collection of collections) {
      try {
        const table = this.getTableName(collection);
        await this.pool.query(`DELETE FROM "${table}" WHERE is_active = false`);
      } catch (e) {
        // Collection might not exist, skip
      }
    }
    return true;
  }
}

export const testConnection = async (maxAttempts = 1, initialDelayMs = 0) => {
  const attempts = Math.max(1, parsePositiveInt(maxAttempts, 1));
  const baseDelayMs = Math.max(0, parsePositiveInt(initialDelayMs, 0));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await pool.query("SELECT NOW()");
      console.log("PostgreSQL database connected (", res.rows[0].now, ")");
      return true;
    } catch (err) {
      console.error(
        `PostgreSQL Connection Error (attempt ${attempt}/${attempts}):`,
        err.message,
      );
      const isLastAttempt = attempt === attempts;
      if (!isLastAttempt && baseDelayMs > 0) {
        await sleep(baseDelayMs * attempt);
      }
    }
  }

  return false;
};

export const dbHelpers = new PostgresHelpers(pool);
export { pool };
