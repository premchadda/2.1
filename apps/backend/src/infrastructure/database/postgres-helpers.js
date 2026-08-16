import { Pool } from "pg";
import dotenv from "dotenv";
import { setTimeout as sleep } from "timers/promises";
import crypto, { randomUUID } from "crypto";
import { parseNumericId } from "../../shared/utils/db-utils.js";
import {
  ENTITY_PREFIXES,
  PUBLIC_ID_PATTERNS,
  JSONB_COLUMNS,
  TIMESTAMP_COLUMNS,
} from "./db/constants.js";
import { RELATIONSHIP_DEFINITIONS } from "./db/relationships.js";
import { getReadPool, getWritePool } from "../../../config/database-replicas.js";

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// Configurable default row limit for query helpers. Override via the
// DEFAULT_QUERY_LIMIT env var (falls back to 1000 to avoid loading whole
// tables into memory).
const DEFAULT_QUERY_LIMIT = process.env.DEFAULT_QUERY_LIMIT
  ? Number(process.env.DEFAULT_QUERY_LIMIT)
  : 1000;
const getEncryptionKey = () => {
  const secret = process.env.DB_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('FATAL: DB_ENCRYPTION_KEY or JWT_SECRET must be configured with at least 32 characters');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

export const encryptValue = (text) => {
  if (text === null || text === undefined) return text;
  if (typeof text !== 'string') text = String(text);
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptValue = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
  if (!encryptedText.includes(':')) return encryptedText;

  try {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !encryptedHex) return encryptedText;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
};


dotenv.config();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

// PHASE 1: Columns that must NEVER be returned by generic reads (auth secrets / PII).
// Used by getSelectColumns() to build a safe allowlist for the `users` table.
const SENSITIVE_USER_COLUMNS = [
  'password',
  'refresh_token',
  'refresh_token_version',
  'otp',
  'otp_secret',
  'email_verification_token',
  'reset_token',
];

// Column cache per table - populated once per table at startup
const tableColumnsCache = new Map();





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



// Use environment-provided DATABASE_URL for credentials (safer for secrets)
// Always require SSL for Supabase connections
// CRIT-01 FIX: SSL certificate validation enabled in production
// Only skip validation in development environments
const isDev =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

if (process.env.PG_SSL_REJECT_UNAUTHORIZED === 'false') {
  if (process.env.NODE_ENV === 'production') {
    console.error('WARNING: SSL certificate validation disabled in production — this is a security risk');
  } else {
    console.warn('SSL certificate validation disabled (development only)');
  }
}

// Use replica pool configuration for read/write separation
const pool = getWritePool();
const readPool = getReadPool();

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

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookmarks' AND column_name = 'item_id' AND data_type LIKE '%integer%') THEN
        ALTER TABLE bookmarks ALTER COLUMN item_id TYPE VARCHAR(255) USING item_id::varchar;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'csrf_tokens' AND column_name = 'auth_token_hash') THEN
        ALTER TABLE csrf_tokens ALTER COLUMN auth_token_hash TYPE VARCHAR(255) USING auth_token_hash::varchar;
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
    this.foreignKeysCache = new Map();
    this.indexExistsCache = new Set();
    this.metadataPrefetched = false;
    this.tableMap = {
      users: "users",
      testSeries: "test_series",
      tests: "tests",
      questions: "questions",
      studyMaterials: "study_materials",
      examCategories: "exam_categories",
      exams: "exams",
      examInfo: "exam_info",
      navigationMenu: "navigation_config",
      tagConfigs: "tag_configs",
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
      units: "subject_units",
      chapters: "subject_chapters",
      topics: "subject_topics",
      subtopics: "subject_subtopics",
      subjectParts: "subject_parts",
      stages: "stages",
      // Added missing tables
      liveTests: "live_tests",
      leaderboards: "leaderboards",
      examYearlyData: "exam_yearly_data",
      examUpdates: "exam_updates",
      examSeasons: "exam_seasons",
      bookmarks: "bookmarks",
      userAchievements: "user_achievements",
      attempts: "attempts",
      questionAttempts: "question_attempts",
      questionVersions: "question_versions",
      studyProgress: "study_progress",
      activityLogs: "activity_logs",
      blogs: "blogs",
      referrals: "referrals",
      doubts: "doubts",
      doubtReplies: "doubt_replies",
      questionDiscussions: "discussions",
      discussionReplies: "discussion_replies",
      discussionVotes: "discussion_votes",
      studyGroups: "study_groups",
      studyGroupMembers: "study_group_members",
      studyGroupMessages: "study_group_messages",
      // Community/group routing mappings
      communityGroups: "study_groups",
      communityPosts: "group_posts",
      communityComments: "community_comments",
      communityVotes: "community_votes",
      // Study material related tables
      subjectVideos: "subject_videos",
      subjectPdfs: "subject_pdfs",
      topicTests: "topic_tests",
      passages: "passages",
      currentAffairs: "current_affairs",
      // Admin-managed tables
      faqs: "faqs",
      backups: "backups",
      emailTemplates: "email_templates",
      promotions: "promotions",
      banners: "banners",
      auditLogs: "audit_logs",
      userRoles: "user_roles",
      rolePermissions: "role_permissions",
      permissions: "permissions",
      roles: "roles",
    };
  }

  async query(sql, params) {
    try {
      return await this.pool.query(sql, params);
    } catch (error) {
      // M3: never log bound parameters — they can contain PII (emails, phones,
      // tokens). Log only the error and a parameter COUNT so operators can still
      // diagnose without leaking user data.
      console.error("DB Query Error:", error.message);
      console.error("SQL:", sql);
      console.error("Param count:", Array.isArray(params) ? params.length : 0);
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

  async prefetchMetadata() {
    try {
      const columnsResult = await this.pool.query(`
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
      `);
      this.columnExistsCache.clear();
      for (const row of columnsResult.rows) {
        const cacheKey = `${row.table_name}.${row.column_name}`;
        this.columnExistsCache.set(cacheKey, true);
      }

      const fkResult = await this.pool.query(`
        SELECT
            tc.table_name,
            kcu.column_name,
            tc.constraint_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
      `);
      this.foreignKeysCache = new Map();
      for (const row of fkResult.rows) {
        const cacheKey = `${row.table_name}.${row.column_name}`;
        this.foreignKeysCache.set(cacheKey, row);
      }

      const indexResult = await this.pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
      `);
      this.indexExistsCache.clear();
      for (const row of indexResult.rows) {
        this.indexExistsCache.add(row.indexname);
      }

      this.metadataPrefetched = true;
    } catch (error) {
      console.error('[DB] Prefetch Metadata Error:', error.message);
    }
  }

  async columnExists(tableName, columnName) {
    const cacheKey = `${tableName}.${columnName}`;
    if (this.columnExistsCache.has(cacheKey)) {
      return this.columnExistsCache.get(cacheKey);
    }
    if (this.metadataPrefetched) {
      return false;
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

  // Filter a prepared-values object down to columns that actually exist in
  // the table. Cached per-table in tableColumnsCache. Unknown keys are
  // silently dropped so client payloads cannot crash INSERT/UPDATE.
  async filterToExistingColumns(table, prepared) {
    if (!tableColumnsCache.has(table)) {
      try {
        const colResult = await this.pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
          [table],
        );
        if (colResult.rows.length === 0) return prepared; // view/unknown table — leave untouched
        tableColumnsCache.set(table, new Set(colResult.rows.map((r) => r.column_name)));
      } catch (error) {
        console.error(`[DB] filterToExistingColumns fallback for "${table}":`, error.message);
        return prepared;
      }
    }
    const existingColumns = tableColumnsCache.get(table);
    const filtered = {};
    for (const key of Object.keys(prepared)) {
      if (existingColumns.has(key)) filtered[key] = prepared[key];
    }
    return filtered;
  }

  clearColumnExistsCache() {
    this.columnExistsCache.clear();
    if (this.foreignKeysCache) {
      this.foreignKeysCache.clear();
    }
    if (this.indexExistsCache) {
      this.indexExistsCache.clear();
    }
    this.metadataPrefetched = false;
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
    if (this.metadataPrefetched && this.foreignKeysCache) {
      const cacheKey = `${tableName}.${columnName}`;
      return this.foreignKeysCache.get(cacheKey) || null;
    }

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

    if (this.indexExistsCache.has(indexName)) {
      return;
    }

    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(indexName)} ON ${quoteIdentifier(tableName)} (${quoteIdentifier(columnName)})`,
    );
    this.indexExistsCache.add(indexName);
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
    await this.prefetchMetadata();

    const results = await Promise.all(
      RELATIONSHIP_DEFINITIONS.map((definition) => this.ensureForeignKey(definition))
    );

    const changes = results.filter((applied) => applied).length;
    if (changes > 0)
      console.log(
        `[DB] Finished relations reconciliation. Applied ${changes} changes.`,
      );
    return changes;
  }

  // DEAD CODE — DO NOT CALL.
  // Schema is fully managed via SQL migrations (migrations/000-0xx). This method is a
  // no-op kept for backward-compat only. Calling it does NOT create any tables. Any new
  // DDL MUST go through a migration file, never here. See migrations/048 + README.md.
  async initTables() {
    console.log("[DB] Skip runtime table creation (DDL): Database schema is managed via SQL migrations.");
    return true;
  }

  getTableName(collection) {
    return this.tableMap[collection] || collection;
  }

  toCamel(row) {
    if (!row) return null;
    const newRow = {};
    const sensitiveColumns = ['phone', 'date_of_birth', 'location', 'education', 'bio'];
    for (const key in row) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      let val = row[key];
      if (sensitiveColumns.includes(key) && val) {
        val = decryptValue(val);
      }
      newRow[camelKey] = val;
      if (key === "id") newRow._id = row[key];
    }
    return newRow;
  }

  toSnake(obj, collection = null) {
    if (!obj) return null;
    if (typeof obj === 'string') {
      return obj.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    }
    const newObj = {};
    const sensitiveColumns = ['phone', 'dateOfBirth', 'date_of_birth', 'location', 'education', 'bio'];
    const isUsersTable = collection === 'users' || !collection;
    for (const key in obj) {
      if (key === "_id") continue;
      const snakeKey = key
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
        .toLowerCase();
      let val = obj[key];
      if (isUsersTable && sensitiveColumns.includes(key) && val) {
        val = encryptValue(val);
      }
      newObj[snakeKey] = val;
    }
    return newObj;
  }

  /**
   * H16 — build the column expression for a SELECT clause.
   * @param {string} table - resolved table name
   * @param {string|string[]|null} columns - optional explicit allowlist
   * @returns {Promise<string>} e.g. "*", `"a", "b"`, or the resolved column list
   *
   * - If `columns` is provided (string or array), build an explicit, identifier-quoted list.
   * - Otherwise resolve the table's real column list from the DB catalog
   *   (cached per-table in the module-level `tableColumnsCache` Map) and build an
   *   explicit `SELECT col1, col2, ...` projection. This eliminates `SELECT *` at
   *   the framework level for ALL tables.
   *   - For the `users` table only, SENSITIVE_USER_COLUMNS are excluded so
   *     password/refresh-token/otp secrets are never returned by generic reads.
   * - CRITICAL FALLBACK: if the catalog lookup throws OR resolves to zero usable
   *   columns (e.g. views/CTEs/functions not present in information_schema, or a
   *   table whose only columns are sensitive), we return `*` so behavior is
   *   unchanged and nothing breaks. This method NEVER throws.
   */
  async getSelectColumns(table, columns) {
    if (columns) {
      const cols = Array.isArray(columns) ? columns : [columns];
      const safe = cols.filter((c) => typeof c === 'string' && c.length > 0);
      if (safe.length > 0) {
        return safe.map((c) => quoteIdentifier(c)).join(', ');
      }
    }

    try {
      // Resolve (and cache) the real column list for this table from the catalog.
      if (!tableColumnsCache.has(table)) {
        const colResult = await this.pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
          [table],
        );
        tableColumnsCache.set(
          table,
          new Set(colResult.rows.map((r) => r.column_name)),
        );
      }

      const cols = tableColumnsCache.get(table);
      // FALLBACK: catalog returned nothing (view/cte/function/unknown) -> SELECT *.
      if (!cols || cols.size === 0) {
        return '*';
      }

      // Only the users table strips secrets; every other table keeps all columns.
      const allowed =
        table === 'users'
          ? [...cols].filter((c) => !SENSITIVE_USER_COLUMNS.includes(c))
          : [...cols];

      if (allowed.length > 0) {
        return allowed.map((c) => quoteIdentifier(c)).join(', ');
      }
    } catch (error) {
      // Never throw from getSelectColumns — degrade safely to SELECT *.
      console.error(
        `[DB] getSelectColumns fallback to * for "${table}":`,
        error.message,
      );
    }

    // FALLBACK: nothing usable resolved -> SELECT * (unchanged behavior).
    return '*';
  }

  async find(collection, query = {}, limit = null, offset = null, columns = null) {
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

    const selectCols = await this.getSelectColumns(table, columns);
    let sql = `SELECT ${selectCols} FROM "${table}"`;
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
    sql += ` ORDER BY id ASC`;

    // Default limit of 1000 to prevent loading entire tables into memory
    const effectiveLimit = limit !== null ? limit : DEFAULT_QUERY_LIMIT;
    sql += ` LIMIT $${i}`;
    values.push(effectiveLimit);
    i++;
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

  async findReadOnly(collection, query = {}, limit = null, offset = null, columns = null) {
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

    const selectCols = await this.getSelectColumns(table, columns);
    let sql = `SELECT ${selectCols} FROM "${table}"`;
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
    sql += ` ORDER BY id ASC`;

    // Default limit of 1000 to prevent loading entire tables into memory
    const effectiveLimit = limit !== null ? limit : DEFAULT_QUERY_LIMIT;
    sql += ` LIMIT $${i}`;
    values.push(effectiveLimit);
    i++;
    if (offset !== null) {
      sql += ` OFFSET $${i}`;
      values.push(offset);
      i++;
    }

    try {
      const result = await readPool.query(sql, values);
      return result.rows.map((row) => this.toCamel(row));
    } catch (error) {
      console.error(`DB FindReadOnly Error (${collection}):`, error.message);
      return [];
    }
  }

  async findById(collection, id, columns = null) {
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
      const selectCols = await this.getSelectColumns(table, columns);
      const result = await this.pool.query(
        `SELECT ${selectCols} FROM "${table}" WHERE id = $1`,
        [numericId],
      );
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`DB FindById Error (${collection}):`, error.message);
      return null;
    }
  }

  async findByIdReadOnly(collection, id, columns = null) {
    const table = this.getTableName(collection);

    if (typeof id === "string") {
      const trimmedId = id.trim();
      if (!trimmedId) {
        return null;
      }

      if (this.isValidPublicId(trimmedId, table)) {
        return this.findByPublicIdReadOnly(collection, trimmedId);
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
      const selectCols = await this.getSelectColumns(table, columns);
      const result = await readPool.query(
        `SELECT ${selectCols} FROM "${table}" WHERE id = $1`,
        [numericId],
      );
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`DB FindByIdReadOnly Error (${collection}):`, error.message);
      return null;
    }
  }

  async findOne(collection, query, columns = null) {
    const table = this.getTableName(collection);

    const cleanQuery = { ...query };
    const includeInactive = cleanQuery.includeInactive === true || cleanQuery.include_inactive === true;
    delete cleanQuery.includeInactive;
    delete cleanQuery.include_inactive;

    const hasActive = await this.columnExists(table, "is_active");
    if (hasActive && !includeInactive && cleanQuery.isActive === undefined && cleanQuery.is_active === undefined) {
      cleanQuery.is_active = true;
    }

    const selectCols = await this.getSelectColumns(table, columns);
    let sql = `SELECT ${selectCols} FROM "${table}"`;
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
            conditions.push("1=0");
          }
        }
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += ` ORDER BY id ASC LIMIT 1`;

    try {
      const result = await this.pool.query(sql, values);
      return this.toCamel(result.rows[0]) || null;
    } catch (error) {
      console.error(`DB FindOne Error (${collection}):`, error.message);
      return null;
    }
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
      const selectCols = await this.getSelectColumns(table);
      const result = await this.pool.query(
        `SELECT ${selectCols} FROM "${table}" WHERE public_id = $1 LIMIT 1`,
        [publicId],
      );
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`DB findByPublicId Error (${collection}):`, error.message);
      return null;
    }
  }

  async findByPublicIdReadOnly(collection, publicId) {
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
      const selectCols = await this.getSelectColumns(table);
      const result = await readPool.query(
        `SELECT ${selectCols} FROM "${table}" WHERE public_id = $1 LIMIT 1`,
        [publicId],
      );
      return this.toCamel(result.rows[0]);
    } catch (error) {
      console.error(`DB findByPublicIdReadOnly Error (${collection}):`, error.message);
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
      const selectCols = await this.getSelectColumns(table);
      const result = await this.pool.query(
        `SELECT ${selectCols} FROM "${table}" WHERE public_id_uuid = $1 LIMIT 1`,
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
   * Increment metrics for observability.
   *
   * No metrics provider (Prometheus/DataDog/CloudWatch) is wired into the
   * codebase yet, so this is a best-effort, fire-and-forget increment in
   * Redis (key: `metrics:<metricName>`). It never throws and is safe to call
   * from hot paths like toApi().
   *
   * TODO: replace with a real metrics provider if/when one is adopted.
   *
   * @param {string} metricName - Name of metric to increment
   */
  incrementMetric(metricName) {
    if (!metricName) return;
    import("../cache/redisClient.js")
      .then(({ getRedisClient, isRedisReady }) => {
        if (isRedisReady()) {
          getRedisClient()
            .incr(`metrics:${metricName}`)
            .catch(() => {});
        }
      })
      .catch(() => {});
  }

  async count(table, filter = {}) {
    let tableName = table
    let filterObj = filter

    if (typeof table === 'object' && table !== null) {
      tableName = filter
      filterObj = table
    }

    const resolvedTable = typeof tableName === 'string' ? (this.tableMap[tableName] || tableName) : 'bookmarks'
    const quotedTable = quoteIdentifier(resolvedTable)
    const conditions = []
    const values = []
    let paramIndex = 1

    if (filterObj && typeof filterObj === 'object') {
      for (const [key, value] of Object.entries(filterObj)) {
        const snakeKey = typeof key === 'string' ? key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`) : String(key)
        if (value === null) {
          conditions.push(`${quoteIdentifier(snakeKey)} IS NULL`)
        } else {
          conditions.push(`${quoteIdentifier(snakeKey)} = $${paramIndex}`)
          values.push(value)
          paramIndex++
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await this.pool.query(`SELECT COUNT(*)::int AS count FROM ${quotedTable} ${whereClause}`, values)
    return result.rows[0]?.count || 0
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
    // Filter to only columns that actually exist in the table (same behavior
    // as updateById; unknown fields from client payloads must not crash inserts)
    const filteredPrepared = await this.filterToExistingColumns(table, prepared);
    const keys = Object.keys(filteredPrepared);
    const values = Object.values(filteredPrepared);

    if (keys.length === 0) return null;

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders}) RETURNING *`;

    try {
      const db = client || this.pool;
      const result = await db.query(sql, values);
      const inserted = this.toCamel(result.rows[0]);
      if (['units', 'chapters', 'topics', 'subtopics'].includes(collection)) {
        this.getSubjectIdForCurriculumItem(collection, inserted.id || inserted._id, inserted).then(subjectId => {
          if (subjectId) this.resequenceAndPrefixCurriculum(subjectId).catch(console.error);
        }).catch(console.error);
      }
      return inserted;
    } catch (error) {
      console.error(`DB Insert Error (${collection}):`, error.message);
      throw error;
    }
  }

  async insertMany(collection, items, client = null) {
    if (!items || items.length === 0) return [];

    const table = this.getTableName(collection);
    // Process all items to get consistent column sets
    const processedItems = items.map(item => {
      const dbData = this.toSnake(item, collection);
      delete dbData.id;
      delete dbData.created_at;
      delete dbData.updated_at;
      if (Array.isArray(dbData.stage_ids)) {
        dbData.stage_ids = dbData.stage_ids.filter(
          (id) => typeof id === "number" || /^\d+$/.test(String(id)),
        );
      }
      return prepareDbValues(table, dbData);
    });

    // Use the column set from the first item, restricted to columns that
    // actually exist in the table (unknown fields from client payloads must
    // not crash bulk inserts — same behavior as updateById)
    await this.filterToExistingColumns(table, {}); // warms tableColumnsCache
    const firstKeys = Object.keys(processedItems[0]);
    if (firstKeys.length === 0) return [];
    const existingColumns = tableColumnsCache.get(table);
    const keys = existingColumns
      ? firstKeys.filter((k) => existingColumns.has(k))
      : firstKeys;
    if (keys.length === 0) return [];

    const allValues = [];
    const valuePlaceholders = processedItems.map((item, rowIdx) => {
      const placeholders = keys.map((_, colIdx) => `$${rowIdx * keys.length + colIdx + 1}`);
      keys.forEach((key) => allValues.push(item[key]));
      return `(${placeholders.join(', ')})`;
    }).join(', ');

    const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES ${valuePlaceholders} RETURNING *`;

    const db = client || this.pool;
    try {
      const result = await db.query(sql, allValues);
      return result.rows.map((row) => this.toCamel(row));
    } catch (error) {
      console.error(`DB InsertMany Error (${collection}):`, error.message);
      throw error;
    }
  }

  async updateById(collection, id, data, client = null) {
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

    // Filter to only columns that actually exist in the table (cached per table)
    const filtered = await this.filterToExistingColumns(table, prepared);
    const keys = Object.keys(filtered);
    const values = keys.map((k) => filtered[k]);

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
      const db = client || this.pool;
      const result = await db.query(sql, values);
      if (result.rows.length === 0) return null;
      console.log(`   ✅ Updated 1 row in ${table}`);
      const updated = this.toCamel(result.rows[0]);
      if (['units', 'chapters', 'topics', 'subtopics'].includes(collection)) {
        this.getSubjectIdForCurriculumItem(collection, numericId || id || updated.id || updated._id, updated).then(subjectId => {
          if (subjectId) this.resequenceAndPrefixCurriculum(subjectId).catch(console.error);
        }).catch(console.error);
      }
      return updated;
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
      let subjectId = null;
      if (['units', 'chapters', 'topics', 'subtopics'].includes(collection)) {
        subjectId = await this.getSubjectIdForCurriculumItem(collection, numericId || id);
      }
      await this.pool.query(`DELETE FROM "${table}" WHERE id = $1`, [
        numericId,
      ]);
      if (subjectId) {
        this.resequenceAndPrefixCurriculum(subjectId).catch(console.error);
      }
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
    const table = this.getTableName(collection);
    // USE STANDARDIZED SOFT-DELETE PATTERN (Migration 032)
    // Keep is_deleted and is_active/isActive in sync to support consistent queries.
    return await this.updateById(collection, id, { 
      is_deleted: true, 
      is_active: false,
      isActive: false,
      deleted_by: userId || null, 
      deleted_at: new Date() 
    });
  }

  async getTrashItems(filter = {}) {
    // Note: 'exams' replaces 'examSubCategories' - no separate subcategories table exists
    const collections = [
      "testSeries",
      "tests",
      "questions",
      "studyMaterials",
      "units",
      "chapters",
      "subtopics",
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

    const results = await Promise.all(
      collections.map(async (collection) => {
        try {
          const items = await this.find(collection, { isActive: false });
          return items.map((item) => ({
            ...item,
            originalCollection: collection,
            deletedAt: item.updatedAt || item.updated_at,
          }));
        } catch (e) {
          return [];
        }
      })
    );

    const allTrashItems = results.flat();

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
      "units",
      "chapters",
      "subtopics",
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
        if (item && (item.is_deleted === true || item.isActive === false)) {
          const restored = await this.updateById(collection, id, {
            is_deleted: false,
            isActive: true,
            deleted_by: null,
            deleted_at: null,
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
      "units",
      "chapters",
      "subtopics",
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
      "units",
      "chapters",
      "subtopics",
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

  async getSubjectIdForCurriculumItem(collection, id, data) {
    try {
      if (collection === 'units') {
        if (data && (data.subjectId || data.subject_id)) return data.subjectId || data.subject_id;
        const unit = await this.findById('units', id);
        return unit?.subjectId || unit?.subject_id;
      }
      if (collection === 'chapters') {
        if (data && (data.subjectId || data.subject_id)) return data.subjectId || data.subject_id;
        if (data && (data.unitId || data.unit_id)) {
          const unit = await this.findById('units', data.unitId || data.unit_id);
          if (unit?.subjectId || unit?.subject_id) return unit.subjectId || unit.subject_id;
        }
        const ch = await this.findById('chapters', id);
        if (ch?.subjectId || ch?.subject_id) return ch.subjectId || ch.subject_id;
        if (ch?.unitId || ch?.unit_id) {
          const unit = await this.findById('units', ch.unitId || ch.unit_id);
          return unit?.subjectId || unit?.subject_id;
        }
      }
      if (collection === 'topics') {
        let chId = data?.chapterId || data?.chapter_id;
        if (!chId && id) {
          const t = await this.findById('topics', id);
          chId = t?.chapterId || t?.chapter_id;
        }
        if (chId) {
          const ch = await this.findById('chapters', chId);
          if (ch?.subjectId || ch?.subject_id) return ch.subjectId || ch.subject_id;
          if (ch?.unitId || ch?.unit_id) {
            const unit = await this.findById('units', ch.unitId || ch.unit_id);
            return unit?.subjectId || unit?.subject_id;
          }
        }
      }
      if (collection === 'subtopics') {
        let topicId = data?.topicId || data?.topic_id;
        if (!topicId && id) {
          const st = await this.findById('subtopics', id);
          topicId = st?.topicId || st?.topic_id;
        }
        if (topicId) {
          const t = await this.findById('topics', topicId);
          if (t?.chapterId || t?.chapter_id) {
            const ch = await this.findById('chapters', t.chapterId || t.chapter_id);
            if (ch?.subjectId || ch?.subject_id) return ch.subjectId || ch.subject_id;
            if (ch?.unitId || ch?.unit_id) {
              const unit = await this.findById('units', ch.unitId || ch.unit_id);
              return unit?.subjectId || unit?.subject_id;
            }
          }
        }
      }
    } catch (_) {
      // ignore — non-fatal; returns null below
    }
    return null;
  }

  async resequenceAndPrefixCurriculum(subjectId) {
    if (!subjectId) return;
    try {
      const prefixRegex = /^(?:Unit|Chapter|Topic|Subtopic|Ch|U|T|St)\s*\d+[\s:]\s*/i;
      const cleanName = (name) => {
        if (!name) return '';
        return name.replace(prefixRegex, '').trim();
      };

      // 1. Resequence & Prefix Units
      const units = (await this.pool.query(`
        SELECT id, name, order_index FROM subject_units
        WHERE subject_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
        ORDER BY order_index, id
      `, [subjectId])).rows;

      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const unitOrder = i + 1;
        const cleaned = cleanName(u.name);
        const newName = `Unit ${unitOrder}: ${cleaned}`;
        await this.pool.query(`
          UPDATE subject_units SET name = $1, order_index = $2, updated_at = NOW() WHERE id = $3
        `, [newName, unitOrder, u.id]);
      }

      // 2. Resequence & Prefix Chapters (Continuous Global Index)
      const chapters = (await this.pool.query(`
        SELECT c.id, c.title, c.order_index, c.unit_id, u.order_index as unit_order
        FROM subject_chapters c
        LEFT JOIN subject_units u ON c.unit_id = u.id
        WHERE c.subject_id = $1 AND (c.is_deleted = false OR c.is_deleted IS NULL)
        ORDER BY COALESCE(u.order_index, 9999), c.order_index, c.id
      `, [subjectId])).rows;

      for (let i = 0; i < chapters.length; i++) {
        const c = chapters[i];
        const globalChapNum = i + 1;
        const cleaned = cleanName(c.title);
        const newTitle = `Chapter ${globalChapNum}: ${cleaned}`;
        await this.pool.query(`
          UPDATE subject_chapters SET title = $1, order_index = $2, updated_at = NOW() WHERE id = $3
        `, [newTitle, globalChapNum, c.id]);
      }

      // 3. Resequence & Prefix Topics (Per Chapter Index)
      const chapterIds = chapters.map(c => c.id);
      if (chapterIds.length > 0) {
        const topics = (await this.pool.query(`
          SELECT id, name, order_index, chapter_id FROM subject_topics
          WHERE chapter_id = ANY($1) AND (is_deleted = false OR is_deleted IS NULL)
          ORDER BY chapter_id, order_index, id
        `, [chapterIds])).rows;

        const topicsByChapter = {};
        for (const t of topics) {
          if (!topicsByChapter[t.chapter_id]) topicsByChapter[t.chapter_id] = [];
          topicsByChapter[t.chapter_id].push(t);
        }

        for (const chId in topicsByChapter) {
          const chTopics = topicsByChapter[chId];
          for (let i = 0; i < chTopics.length; i++) {
            const t = chTopics[i];
            const topicOrder = i + 1;
            const cleaned = cleanName(t.name);
            const newName = `Topic ${topicOrder}: ${cleaned}`;
            await this.pool.query(`
              UPDATE subject_topics SET name = $1, order_index = $2, updated_at = NOW() WHERE id = $3
            `, [newName, topicOrder, t.id]);
          }
        }

        // 4. Resequence & Prefix Subtopics (Per Topic Index)
        const topicIds = topics.map(t => t.id);
        if (topicIds.length > 0) {
          const subtopics = (await this.pool.query(`
            SELECT id, name, order_index, topic_id FROM subject_subtopics
            WHERE topic_id = ANY($1) AND (is_deleted = false OR is_deleted IS NULL)
            ORDER BY topic_id, order_index, id
          `, [topicIds])).rows;

          const subtopicsByTopic = {};
          for (const st of subtopics) {
            if (!subtopicsByTopic[st.topic_id]) subtopicsByTopic[st.topic_id] = [];
            subtopicsByTopic[st.topic_id].push(st);
          }

          for (const tId in subtopicsByTopic) {
            const tSubtopics = subtopicsByTopic[tId];
            for (let i = 0; i < tSubtopics.length; i++) {
              const st = tSubtopics[i];
              const subtopicOrder = i + 1;
              const cleaned = cleanName(st.name);
              const newName = `Subtopic ${subtopicOrder}: ${cleaned}`;
              await this.pool.query(`
                UPDATE subject_subtopics SET name = $1, order_index = $2, updated_at = NOW() WHERE id = $3
              `, [newName, subtopicOrder, st.id]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error auto-prefixing/resequencing curriculum:', err);
    }
  }

  /**
   * Gracefully close the underlying connection pools (write + read replicas).
   * Safe to call multiple times; no-ops if a pool is already closed. Used by the
   * process graceful-shutdown handler (app-port5001.js).
   * @returns {Promise<void>}
   */
  async close() {
    const errors = [];
    // Close read replica pool first, then the primary write pool.
    for (const p of [readPool, this.pool]) {
      if (!p || typeof p.end !== "function") continue;
      try {
        await p.end();
      } catch (err) {
        errors.push(err && err.message ? err.message : String(err));
      }
    }
    if (errors.length > 0) {
      console.error("[DB] Error while closing pools:", errors.join("; "));
    }
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

// Run a set of operations atomically on a single connection. The callback
// receives the live `client` and should pass it to dbHelpers methods that
// accept an optional `client` argument (e.g. insertOne/updateById) so every
// write shares the same transaction. Automatically rolls back on error.
export const withTransaction = async (fn, options = {}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (options.lockTimeout) {
      await client.query(`SET LOCAL lock_timeout = '${options.lockTimeout}'`);
    }
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const dbHelpers = new PostgresHelpers(pool);
export { pool };
