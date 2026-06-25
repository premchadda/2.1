import { dbHelpers, pool } from "../database/postgres-helpers.js";

export class BaseRepository {
  constructor(collectionName) {
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

  async insert(data) {
    return this.db.insertOne(this.collection, data);
  }

  async update(id, data) {
    return this.db.updateById(this.collection, id, data);
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
      const items = await this.db.find(this.collection, query);
      return items.length;
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
