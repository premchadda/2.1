import AiGenerationLog from "../../data/models/ai/AiGenerationLog.js";

const aiGenerationLogService = {
  async list(query = {}) {
    return AiGenerationLog.find(query);
  },

  async getById(id) {
    return AiGenerationLog.findById(id);
  },

  async getRecent(limit = 50) {
    return AiGenerationLog.findRecent(limit);
  },

  async getByEntityType(entityType, entityId) {
    return AiGenerationLog.findByEntityType(entityType, entityId);
  },

  async getByModel(model) {
    return AiGenerationLog.findByModel(model);
  },

  async getFailed() {
    return AiGenerationLog.findFailed();
  },

  async getStatsByModel() {
    return AiGenerationLog.getStatsByModel();
  },

  async getStatsByEntityType() {
    return AiGenerationLog.getStatsByEntityType();
  },

  async getCostSummary(startDate, endDate) {
    return AiGenerationLog.getCostSummary(startDate, endDate);
  },

  async getUsageByPeriod(start, end) {
    const { pool } =
      await import("../../../infrastructure/database/postgres-helpers.js");
    const client = await pool.connect();
    try {
      // Physical columns are snake_case (tokens_input/tokens_output/cost_usd)
      // — the old camelCase identifiers 500'd this endpoint on Postgres.
      const result = await client.query(
        `
        SELECT
          DATE(created_at) as date,
          SUM(tokens_input) as total_input_tokens,
          SUM(tokens_output) as total_output_tokens,
          SUM(tokens_input + tokens_output) as total_tokens,
          COUNT(*) as total_calls,
          SUM(cost_usd) as total_cost_usd,
          model,
          provider
        FROM ai_generation_logs
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY DATE(created_at), model, provider
        ORDER BY date
      `,
        [start, end],
      );
      return result.rows;
    } finally {
      client.release();
    }
  },

  async log(data) {
    return AiGenerationLog.create(data);
  },

  async logSuccess(data) {
    return AiGenerationLog.logSuccess(data);
  },

  async logFailure(data) {
    return AiGenerationLog.logFailure(data);
  },

  async cleanupOldLogs(days = 90) {
    const parsed = parseInt(days, 10);
    if (Number.isNaN(parsed)) {
      throw new Error("days must be a number");
    }
    // Clamp to a sane retention window (1 day .. 1 year).
    const clamped = Math.min(Math.max(parsed, 1), 365);
    return AiGenerationLog.deleteOlderThan(clamped);
  },

  async count(query = {}) {
    return AiGenerationLog.count(query);
  },
};

// NOTE: no cron/scheduler wiring here by design — invoke
// `scheduleAiLogCleanup(days)` from the host app boot sequence (or an ops
// runbook) if periodic purging is desired. Unexported timers inside a service
// module would start/stop unpredictably across replicas and tests.
export const scheduleAiLogCleanup = ({
  days = 90,
  intervalMs = 24 * 60 * 60 * 1000,
  runNow = false,
} = {}) => {
  const run = () => AiGenerationLog.deleteOlderThan(days).catch(() => 0);
  let timer = null;
  if (runNow) run();
  timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return () => clearInterval(timer);
};

export default aiGenerationLogService;
