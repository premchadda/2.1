/**
 * Base class for all seeders.
 *
 * Each subclass must implement `table`, `columns`, and `rows(fixture)`.
 * The default `run` does the heavy lifting: load fixture, build a single
 * multi-row INSERT with parameterised values, run it inside a transaction,
 * and log the result.
 *
 * All seeders must be IDEMPOTENT: they use ON CONFLICT (PK) DO NOTHING
 * so that running them twice does not duplicate data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, '_fixtures');

export default class BaseSeeder {
  /** @type {string} table name to insert into (must match migration table) */
  static table = '';

  /** @type {string[]} ordered column names */
  static columns = [];

  /** Override if a row needs reshaping before insertion. */
  static toRow(fixtureRow) {
    return fixtureRow
  }

  /** Path of the JSON fixture, relative to _fixtures/. */
  static fixtureFile = '';

  static fixturePath() {
    return path.join(FIXTURES_DIR, this.fixtureFile);
  }

  static loadFixture() {
    const raw = fs.readFileSync(this.fixturePath(), 'utf8');
    return JSON.parse(raw);
  }

  static async run(pool, { logger = console } = {}) {
    if (!this.table || this.columns.length === 0) {
      throw new Error(`${this.name}: table and columns are required`);
    }
    if (!this.fixtureFile) {
      throw new Error(`${this.name}: fixtureFile is required`);
    }
    const rows = this.loadFixture();
    if (!Array.isArray(rows)) {
      throw new Error(`${this.name}: fixture must be an array, got ${typeof rows}`);
    }
    if (rows.length === 0) {
      logger.log?.(`[seed:${this.name}] fixture is empty, skipping`);
      return { inserted: 0, skipped: 0 };
    }

    const shaped = rows.map((r) => this.toRow(r));
    const placeholders = shaped
      .map(
        (_, i) =>
          `(${this.columns.map((__, j) => `$${i * this.columns.length + j + 1}`).join(',')})`
      )
      .join(',');
    const conflictTarget = this.conflictTarget?.() ?? 'id';
    const sql = `
      INSERT INTO ${this.table} (${this.columns.join(',')})
      VALUES ${placeholders}
      ON CONFLICT (${conflictTarget}) DO NOTHING;
    `;
    const values = shaped.flatMap((r) => this.columns.map((c) => this.valueFor(r, c)));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql, values);
      await client.query('COMMIT');
      const inserted = result.rowCount ?? 0;
      const skipped = shaped.length - inserted;
      logger.log?.(
        `[seed:${this.name}] processed ${shaped.length} row(s), inserted ${inserted}, skipped ${skipped}`
      );
      return { inserted, skipped };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error?.(`[seed:${this.name}] failed: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  static valueFor(row, column) {
    return row[column] ?? null;
  }

  /** Override for tables whose PK is not `id` (e.g. natural-key tables). */
  static conflictTarget() {
    return 'id';
  }
}
