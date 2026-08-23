/**
 * Scaffold for incremental ORM adoption; do not migrate dbHelpers call sites en masse yet.
 *
 * This is a lightweight, safe query-builder intended to live ALONGSIDE the existing
 * `dbHelpers` (PostgresHelpers). It builds parameterized SQL ($1, $2, ...) against the
 * existing `pg` pool (or an existing transaction `client`) and quotes all identifiers.
 *
 * It does NOT generate schemas or run migrations. It is intentionally minimal so a few
 * pilot modules can adopt it without risking the ~1,481 existing dbHelpers call sites.
 *
 * A future migration can compose this with dbHelpers transactions:
 *
 *   import { qb } from "./qb.js";
 *   import { withTransaction } from "../postgres-helpers.js";
 *
 *   await withTransaction(async (client) => {
 *     const row = await qb("attempts").transacting(client)
 *       .where({ user_id: 1 }).first();
 *     await qb("attempts").transacting(client)
 *       .where({ id: row.id }).update({ is_completed: true });
 *   });
 */

import { pool as defaultPool } from "./postgres-helpers.js";

const quoteId = (id) => `"${String(id).replace(/"/g, '""')}"`;

/**
 * Convert a single snake_case row to camelCase (kept local so this module has no
 * dependency on PostgresHelpers). Mirrors dbHelpers.toCamel's key transform minus the
 * PII-decryption behavior (callers that need decryption should keep using dbHelpers).
 */
export const snakeToCamel = (row) => {
  if (!row) return null;
  const out = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = row[key];
  }
  return out;
};

const SENSITIVE_USER_COLUMNS = new Set([
  "password",
  "refresh_token",
  "refresh_token_version",
  "otp",
  "otp_secret",
  "email_verification_token",
  "reset_token",
]);
// Safe explicit columns for users table (excludes sensitive)
const SAFE_USER_COLUMNS = [
  "id",
  "name",
  "email",
  "role",
  "is_active",
  "is_pro_user",
  "phone",
  "created_at",
  "updated_at",
];

// Safe projections per table to avoid SELECT * leaks
const SAFE_ATTEMPT_COLUMNS = [
  "id",
  "user_id",
  "test_id",
  "series_id",
  "score",
  "accuracy",
  "time_spent",
  "time_spent_seconds",
  "is_completed",
  "status",
  "submitted_at",
  "created_at",
  "updated_at",
];
const SAFE_TEST_COLUMNS = [
  "id",
  "title",
  "description",
  "series_id",
  "subject_id",
  "duration",
  "total_marks",
  "is_active",
  "status",
  "created_at",
  "updated_at",
];
const SAFE_SERIES_COLUMNS = [
  "id",
  "title",
  "description",
  "category",
  "price",
  "is_active",
  "created_at",
  "updated_at",
];
const SAFE_ASSET_COLUMNS = [
  "id",
  "name",
  "type",
  "category",
  "url",
  "size",
  "metadata",
  "uploaded_by",
  "is_active",
  "created_at",
  "updated_at",
];

const SAFE_TABLE_COLUMNS = {
  users: SAFE_USER_COLUMNS,
  attempts: SAFE_ATTEMPT_COLUMNS,
  tests: SAFE_TEST_COLUMNS,
  test_series: SAFE_SERIES_COLUMNS,
  series: SAFE_SERIES_COLUMNS,
  assets: SAFE_ASSET_COLUMNS,
  media: SAFE_ASSET_COLUMNS,
};

// ORDER BY allowlist — only these columns may be used for sorting
// Prevents ORDER BY injection via arbitrary column names and ensures index-friendly sorts
const ORDER_BY_ALLOWLIST = new Set([
  "id",
  "created_at",
  "updated_at",
  "name",
  "email",
  "title",
  "score",
  "accuracy",
  "time_spent",
  "time_spent_seconds",
  "display_order",
  "order_index",
  "displayOrder",
  "orderIndex",
  "price",
  "amount",
  "status",
  "is_active",
  "submitted_at",
  "total_marks",
  "duration",
  "category",
  "type",
  "series_id",
  "test_id",
  "user_id",
  "exam_id",
  "study_material_id",
]);
const ORDER_BY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function qb(table, client = null) {
  let _client = client;
  let _select = null;
  let _conditions = [];
  let _params = [];
  let _returning = null;
  let _orderBy = null;
  let _limit = null;
  let _offset = null;

  const addParam = (value) => {
    _params.push(value);
    return `$${_params.length}`;
  };

  const addWhere = (col, op, value) => {
    _conditions.push(`${quoteId(col)} ${op} ${addParam(value)}`);
  };

  const api = {
    /** Bind to an existing transaction client (from dbHelpers.withTransaction). */
    transacting(txClient) {
      _client = txClient;
      return api;
    },

    select(cols) {
      if (!cols) {
        _select = "*";
      } else if (Array.isArray(cols)) {
        if (cols.length === 1 && cols[0] === "*") {
          _select = "*";
        } else {
          _select = cols.map((c) => (c === "*" ? "*" : quoteId(c))).join(", ");
        }
      } else {
        _select = cols === "*" ? "*" : quoteId(cols);
      }
      return api;
    },

    /** Equality / NULL conditions: { a: 1, b: null } -> a = $1 AND b IS NULL. */
    where(conds) {
      for (const [key, value] of Object.entries(conds || {})) {
        if (value === null || value === undefined) {
          _conditions.push(`${quoteId(key)} IS NULL`);
        } else {
          addWhere(key, "=", value);
        }
      }
      return api;
    },

    /** IN clause: whereIn("id", [1,2,3]). Empty array -> no-match guard. */
    whereIn(col, values) {
      if (!Array.isArray(values) || values.length === 0) {
        _conditions.push("1=0");
        return api;
      }
      const placeholders = values.map((v) => addParam(v)).join(", ");
      _conditions.push(`${quoteId(col)} IN (${placeholders})`);
      return api;
    },

    returning(cols) {
      if (!cols) {
        _returning = "*";
      } else if (Array.isArray(cols)) {
        _returning = cols.map((c) => quoteId(c)).join(", ");
      } else {
        _returning = quoteId(cols);
      }
      return api;
    },

    orderBy(col, dir = "ASC") {
      const safeDir = String(dir).toUpperCase() === "DESC" ? "DESC" : "ASC";
      const colStr = String(col).trim();
      // Allowlist: must be valid identifier and in ORDER_BY_ALLOWLIST (or fallback to regex for unknown tables)
      // For strict security, enforce allowlist for all tables; unknown columns default to 'id'
      if (!ORDER_BY_REGEX.test(colStr) || !ORDER_BY_ALLOWLIST.has(colStr)) {
        // If table has safe columns and col is in its safe list, allow it anyway
        const safeForTable = SAFE_TABLE_COLUMNS[table];
        if (!safeForTable || !safeForTable.includes(colStr)) {
          console.warn(
            `[qb] Blocked ORDER BY column "${colStr}" not in allowlist — defaulting to "id"`,
          );
          _orderBy = `${quoteId("id")} ${safeDir}`;
          return api;
        }
      }
      _orderBy = `${quoteId(colStr)} ${safeDir}`;
      return api;
    },

    limit(n) {
      _limit = n;
      return api;
    },

    offset(n) {
      _offset = n;
      return api;
    },

    _buildSelect() {
      // Explicit columns required — avoid SELECT * leak. Default to safe projection per table.
      let selectClause = _select;
      if (!selectClause) {
        const safeCols = SAFE_TABLE_COLUMNS[table];
        if (safeCols) {
          selectClause = safeCols.map((c) => quoteId(c)).join(", ");
        } else if (table === "users") {
          selectClause = SAFE_USER_COLUMNS.map((c) => quoteId(c)).join(", ");
        } else {
          // For unknown tables, require explicit .select([...]); fallback to * with warning to avoid breakage
          console.warn(
            `[qb] SELECT without explicit columns for table "${table}" — use .select([...]) to avoid SELECT *`,
          );
          selectClause = "*";
        }
      }
      // If caller explicitly requested "*" replace with safe list for known tables
      if (selectClause === "*") {
        const safeCols = SAFE_TABLE_COLUMNS[table];
        if (safeCols) {
          selectClause = safeCols.map((c) => quoteId(c)).join(", ");
        } else if (table === "users") {
          selectClause = SAFE_USER_COLUMNS.map((c) => quoteId(c)).join(", ");
        }
      }
      let sql = `SELECT ${selectClause} FROM ${quoteId(table)}`;
      if (_conditions.length > 0) {
        sql += ` WHERE ${_conditions.join(" AND ")}`;
      }
      if (_orderBy) sql += ` ORDER BY ${_orderBy}`;
      if (_limit !== null && _limit !== undefined)
        sql += ` LIMIT ${Number(_limit)}`;
      if (_offset !== null && _offset !== undefined)
        sql += ` OFFSET ${Number(_offset)}`;
      return sql;
    },

    /** Execute the SELECT and return the first row (or null). */
    async first() {
      const db = _client || defaultPool;
      const sql = api._buildSelect() + " LIMIT 1";
      const result = await db.query(sql, _params);
      return result.rows[0] || null;
    },

    /** Execute the SELECT and return all rows. */
    async get() {
      const db = _client || defaultPool;
      const result = await db.query(api._buildSelect(), _params);
      return result.rows;
    },

    /** Insert one row, returning the columns set via .returning() (or *). */
    async insert(data) {
      const db = _client || defaultPool;
      const prepared = data || {};
      const keys = Object.keys(prepared);
      if (keys.length === 0) return null;
      const cols = keys.map((k) => quoteId(k)).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map((k) => prepared[k]);
      let ret = _returning || "*";
      if (ret === "*") {
        const safeCols =
          SAFE_TABLE_COLUMNS[table] ||
          (table === "users" ? SAFE_USER_COLUMNS : null);
        if (safeCols) ret = safeCols.map((c) => quoteId(c)).join(", ");
      }
      const sql = `INSERT INTO ${quoteId(table)} (${cols}) VALUES (${placeholders}) RETURNING ${ret}`;
      const result = await db.query(sql, values);
      return result.rows[0] || null;
    },

    /** Update rows matching the built WHERE clause, returning updated row(s). */
    async update(data) {
      const db = _client || defaultPool;
      const prepared = data || {};
      const keys = Object.keys(prepared);
      if (keys.length === 0) return null;
      const setClause = keys
        .map((k, i) => `${quoteId(k)} = $${i + 1}`)
        .join(", ");
      const values = keys.map((k) => prepared[k]);
      let sql = `UPDATE ${quoteId(table)} SET ${setClause}`;
      if (_conditions.length > 0) {
        sql += ` WHERE ${_conditions.join(" AND ")}`;
      }
      let ret = _returning || "*";
      if (ret === "*") {
        const safeCols =
          SAFE_TABLE_COLUMNS[table] ||
          (table === "users" ? SAFE_USER_COLUMNS : null);
        if (safeCols) ret = safeCols.map((c) => quoteId(c)).join(", ");
      }
      sql += ` RETURNING ${ret}`;
      const result = await db.query(sql, [...values, ..._params]);
      return _limit === 1 ? result.rows[0] || null : result.rows;
    },
  };

  return api;
}

export default qb;
