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

export function qb(table, client = null) {
  let _client = client;
  let _select = "*";
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
        _select = cols.map((c) => quoteId(c)).join(", ");
      } else {
        _select = quoteId(cols);
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
      _orderBy = `${quoteId(col)} ${String(dir).toUpperCase()}`;
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
      let sql = `SELECT ${_select} FROM ${quoteId(table)}`;
      if (_conditions.length > 0) {
        sql += ` WHERE ${_conditions.join(" AND ")}`;
      }
      if (_orderBy) sql += ` ORDER BY ${_orderBy}`;
      if (_limit !== null && _limit !== undefined) sql += ` LIMIT ${Number(_limit)}`;
      if (_offset !== null && _offset !== undefined) sql += ` OFFSET ${Number(_offset)}`;
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
      const ret = _returning || "*";
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
      const ret = _returning || "*";
      sql += ` RETURNING ${ret}`;
      const result = await db.query(sql, [...values, ..._params]);
      return _limit === 1 ? result.rows[0] || null : result.rows;
    },
  };

  return api;
}

export default qb;
