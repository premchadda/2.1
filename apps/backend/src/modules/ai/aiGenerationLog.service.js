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
