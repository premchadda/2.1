import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

const MODEL_PRICING = {
  // Specific (longer) keys MUST come before their prefixes — matching uses
  // `includes`, so 'gpt-4o-mini' must win over 'gpt-4' (100x cost difference).
  'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
  'gpt-4o': { input: 0.0025 / 1000, output: 0.01 / 1000 },
  'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
  'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
  'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 },
  'claude-3-5-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-3.5-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-3.5': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'claude-3-opus': { input: 0.015 / 1000, output: 0.075 / 1000 },
  'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
  'claude-3': { input: 0.015 / 1000, output: 0.075 / 1000 },
  'text-embedding-3-small': { input: 0.00002 / 1000, output: 0 },
  'text-embedding-3-large': { input: 0.00013 / 1000, output: 0 },
  'text-embedding-ada': { input: 0.0001 / 1000, output: 0 },
  'llama': { input: 0.0002 / 1000, output: 0.0002 / 1000 },
  'mistral': { input: 0.0002 / 1000, output: 0.0006 / 1000 },
  'gemini': { input: 0.00035 / 1000, output: 0.00105 / 1000 },
  'deepseek': { input: 0.00014 / 1000, output: 0.00028 / 1000 },
  // Approximate rates for newer model families (no exact contract — recheck
  // provider pricing before using these for billing; longest-match wins).
  'gpt-5': { input: 0.005 / 1000, output: 0.015 / 1000 },
  'gpt-4.1': { input: 0.002 / 1000, output: 0.008 / 1000 },
  'claude-4': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'sonnet-4': { input: 0.003 / 1000, output: 0.015 / 1000 },
  'gemini-2': { input: 0.00035 / 1000, output: 0.00105 / 1000 },
  'qwen': { input: 0.0002 / 1000, output: 0.0006 / 1000 },
  'default': { input: 0.002 / 1000, output: 0.002 / 1000 }
}

function calculateCost(model, inputTokens, outputTokens) {
  const name = model?.toLowerCase?.() || ''
  // Longest-prefix match so specific variants win over family prefixes.
  const modelKey = Object.keys(MODEL_PRICING)
    .filter((key) => key !== 'default' && name.includes(key))
    .sort((a, b) => b.length - a.length)[0] || 'default';
  const pricing = MODEL_PRICING[modelKey];
  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}

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
        `SELECT id, entity_type, entity_id, prompt, model, provider, tokens_input, tokens_output, cost_usd, latency_ms, status, error_message, metadata, created_by, created_at FROM ai_generation_logs ORDER BY created_at DESC LIMIT $1`,
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
    // Never persist zero-token rows: a provider that omits usage (or a caller
    // that passes 0) would make cost dashboards under-report. Fall back to a
    // chars/4 estimate from the prompt / text length metadata.
    let inputTokens = data.tokensInput || 0
    let outputTokens = data.tokensOutput || 0
    if (inputTokens === 0 && outputTokens === 0) {
      try {
        const { default: usageLogger } = await import('../../../infrastructure/logger/logger.js')
        usageLogger.warn?.(
          { entityType: data.entityType, entityId: data.entityId, model: data.model },
          '[AI Usage] Zero-token row, falling back to chars/4 estimate',
        )
      } catch {
        /* logger unavailable — estimate still applies */
      }
      const textLen =
        (typeof data.prompt === 'string' ? data.prompt.length : 0) ||
        (data.metadata && typeof data.metadata.textLength === 'number' ? data.metadata.textLength : 0) ||
        0
      inputTokens = Math.max(1, Math.ceil(textLen / 4))
    }
    const costUsd = data.costUsd || calculateCost(data.model, inputTokens, outputTokens)

    const payload = {
      entityType: data.entityType,
      entityId: data.entityId || null,
      prompt: data.prompt || null,
      model: data.model || null,
      provider: data.provider || null,
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      costUsd: costUsd,
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
