import AiGenerationLog from '../../data/models/ai/AiGenerationLog.js'

const aiGenerationLogService = {
  async list(query = {}) {
    return AiGenerationLog.find(query)
  },

  async getById(id) {
    return AiGenerationLog.findById(id)
  },

  async getRecent(limit = 50) {
    return AiGenerationLog.findRecent(limit)
  },

  async getByEntityType(entityType, entityId) {
    return AiGenerationLog.findByEntityType(entityType, entityId)
  },

  async getByModel(model) {
    return AiGenerationLog.findByModel(model)
  },

  async getFailed() {
    return AiGenerationLog.findFailed()
  },

  async getStatsByModel() {
    return AiGenerationLog.getStatsByModel()
  },

  async getStatsByEntityType() {
    return AiGenerationLog.getStatsByEntityType()
  },

  async getCostSummary(startDate, endDate) {
    return AiGenerationLog.getCostSummary(startDate, endDate)
  },

  async getUsageByPeriod(start, end) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT
          DATE(created_at) as date,
          SUM(tokensInput) as total_input_tokens,
          SUM(tokensOutput) as total_output_tokens,
          SUM(tokensInput + tokensOutput) as total_tokens,
          COUNT(*) as total_calls,
          SUM(costUsd) as total_cost_usd,
          model,
          provider
        FROM ai_generation_logs
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY DATE(created_at), model, provider
        ORDER BY date
      `, [start, end])
      return result.rows
    } finally {
      client.release()
    }
  },

  async log(data) {
    return AiGenerationLog.create(data)
  },

  async logSuccess(data) {
    return AiGenerationLog.logSuccess(data)
  },

  async logFailure(data) {
    return AiGenerationLog.logFailure(data)
  },

  async cleanupOldLogs(days = 90) {
    return AiGenerationLog.deleteOlderThan(days)
  },

  async count(query = {}) {
    return AiGenerationLog.count(query)
  }
}

export default aiGenerationLogService
