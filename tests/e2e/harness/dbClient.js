/**
 * tests/e2e/harness/dbClient.js
 * Database client helper supporting PostgreSQL connections, transactional rollbacks, and schema introspection.
 */

import pg from "pg";

const { Pool } = pg;

export class DbClient {
  constructor(connectionString = process.env.DATABASE_URL) {
    this.connectionString = connectionString;
    this.pool = null;
    this._isConnected = false;
    this._connectionAttempted = false;
  }

  getPool() {
    if (!this.pool && this.connectionString) {
      this.pool = new Pool({
        connectionString: this.connectionString,
        ssl:
          this.connectionString.includes("localhost") ||
          this.connectionString.includes("127.0.0.1")
            ? false
            : { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      });
    }
    return this.pool;
  }

  async isDbConnected() {
    if (this._connectionAttempted) {
      return this._isConnected;
    }
    this._connectionAttempted = true;
    const pool = this.getPool();
    if (!pool) {
      this._isConnected = false;
      return false;
    }
    try {
      const client = await pool.connect();
      client.release();
      this._isConnected = true;
      return true;
    } catch {
      this._isConnected = false;
      return false;
    }
  }

  async query(text, params = []) {
    const pool = this.getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is not configured.");
    }
    return pool.query(text, params);
  }

  /**
   * Executes a callback within a transaction that is guaranteed to ROLLBACK at completion,
   * ensuring zero persistent state pollution during tests.
   */
  async withTransaction(fn) {
    const pool = this.getPool();
    if (!pool) {
      throw new Error("DATABASE_URL is not configured for transaction.");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      return result;
    } finally {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors on teardown
      }
      client.release();
    }
  }

  async checkTableExists(tableName) {
    const sql = `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = $1
      ) as exists;
    `;
    const res = await this.query(sql, [tableName]);
    return Boolean(res.rows[0]?.exists);
  }

  async getTableColumns(tableName) {
    const sql = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    const res = await this.query(sql, [tableName]);
    return res.rows;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export const dbClient = new DbClient();
