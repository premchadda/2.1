import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

class AiGenerationLog {
  static collection = 'ai_generation_logs'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findByEntityType(entityType, entityId) {
    return this.find({ entityType, entityId })
  }

  static async findByModel(model) {
    return this.find({ model })
  }

  static async findFailed() {
    return this.find({ status: 'failed' })
  }

  static async findRecent(limit = 50) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT * FROM ai_generation_logs ORDER BY created_at DESC LIMIT $1`,
        [limit]
      )
      return result.rows
    } finally {
      client.release()
    }
  }

  static async getStatsByModel() {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT
          model,
          provider,
          COUNT(*) as total_calls,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(tokens_input) as total_tokens_input,
          SUM(tokens_output) as total_tokens_output,
          SUM(cost_usd) as total_cost_usd,
          AVG(latency_ms) as avg_latency_ms
        FROM ai_generation_logs
        GROUP BY model, provider
        ORDER BY total_calls DESC
      `)
      return result.rows
    } finally {
      client.release()
    }
  }

  static async getStatsByEntityType() {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT
          entity_type,
          COUNT(*) as total_calls,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(cost_usd) as total_cost_usd,
          AVG(latency_ms) as avg_latency_ms
        FROM ai_generation_logs
        GROUP BY entity_type
        ORDER BY total_calls DESC
      `)
      return result.rows
    } finally {
      client.release()
    }
  }

  static async getCostSummary(startDate, endDate) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT
          DATE(created_at) as date,
          SUM(cost_usd) as daily_cost,
          SUM(tokens_input + tokens_output) as total_tokens,
          COUNT(*) as total_calls
        FROM ai_generation_logs
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [startDate, endDate])
      return result.rows
    } finally {
      client.release()
    }
  }

  static async create(data) {
    const now = new Date()
    const payload = {
      entityType: data.entityType,
      entityId: data.entityId || null,
      prompt: data.prompt || null,
      model: data.model || null,
      provider: data.provider || null,
      tokensInput: data.tokensInput || 0,
      tokensOutput: data.tokensOutput || 0,
      costUsd: data.costUsd || 0,
      latencyMs: data.latencyMs || 0,
      status: data.status || 'success',
      errorMessage: data.errorMessage || null,
      metadata: data.metadata || {},
      createdBy: data.createdBy || null,
      createdAt: now
    }
    return dbHelpers.insertOne(this.collection, payload)
  }

  static async logSuccess(data) {
    return this.create({ ...data, status: 'success' })
  }

  static async logFailure(data) {
    return this.create({ ...data, status: 'failed' })
  }

  static async deleteOlderThan(days = 90) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(
        `DELETE FROM ai_generation_logs WHERE created_at < NOW() - ($1 * INTERVAL '1 day')`,
        [days]
      )
      return result.rowCount
    } finally {
      client.release()
    }
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }
}

export default AiGenerationLog
