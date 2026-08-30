import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

/**
 * Test Model - PostgreSQL
 * Collection: tests
 */
class Test {
  static collection = 'tests'

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async find(query = {}, options = {}) {
    return dbHelpers.find(this.collection, query, options)
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      isPro: data.isPro !== undefined ? data.isPro : true,
      totalQuestions: data.totalQuestions || 0,
      totalMarks: data.totalMarks || 0,
      duration: data.duration || 60,
      negativeMarking: data.negativeMarking || 0.5,
      // V3 schema fields
      shuffleQuestions: data.shuffleQuestions ?? false,
      shuffleOptions: data.shuffleOptions ?? false,
      allowReview: data.allowReview ?? true,
      maxAttempts: data.maxAttempts ?? 0,
      version: data.version ?? 1,
      aiExplanationEnabled: data.aiExplanationEnabled ?? true,
    })
  }

  static async updateById(id, data) {
    return dbHelpers.updateById(this.collection, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    })
  }

  static async deleteById(id) {
    return dbHelpers.deleteById(this.collection, id)
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }
}

export default Test
