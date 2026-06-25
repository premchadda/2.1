import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

class TestTemplate {
  static collection = 'test_templates'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findByPublicId(publicId) {
    return dbHelpers.findByPublicId(this.collection, publicId)
  }

  static async findByIdentifier(identifier) {
    if (!identifier) return null
    const numId = Number(identifier)
    if (!isNaN(numId)) return this.findById(numId)
    if (typeof identifier === 'string' && identifier.startsWith('tpl_')) {
      return this.findByPublicId(identifier)
    }
    return this.findOne({ name: identifier })
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findActive() {
    return this.find({ isActive: true })
  }

  static async findSystemTemplates() {
    return this.find({ isSystem: true, isActive: true })
  }

  static async findByExamId(examId) {
    return this.find({ examId, isActive: true })
  }

  static async findByStageId(stageId) {
    return this.find({ stageId, isActive: true })
  }

  static async create(data) {
    const now = new Date()
    const payload = {
      name: data.name,
      description: data.description || null,
      examId: data.examId || null,
      stageId: data.stageId || null,
      subjectId: data.subjectId || null,
      configJson: data.configJson || {},
      totalQuestions: data.totalQuestions || data.configJson?.totalQuestions || 0,
      totalMarks: data.totalMarks || data.configJson?.totalMarks || 0,
      duration: data.duration || data.configJson?.duration || 60,
      difficulty: data.difficulty || data.configJson?.difficulty || 'Medium',
      isActive: data.isActive !== undefined ? data.isActive : true,
      isSystem: data.isSystem || false,
      usageCount: 0,
      createdBy: data.createdBy || null,
      createdAt: now,
      updatedAt: now
    }
    return dbHelpers.insertOne(this.collection, payload)
  }

  static async updateById(id, data) {
    const update = { ...data, updatedAt: new Date() }
    return dbHelpers.updateById(this.collection, id, update)
  }

  static async incrementUsageCount(id) {
    const { pool } = await import('../../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()
    try {
      await client.query(
        `UPDATE test_templates SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1`,
        [id]
      )
    } finally {
      client.release()
    }
  }

  static async deleteById(id) {
    return dbHelpers.deleteById(this.collection, id)
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }
}

export default TestTemplate
