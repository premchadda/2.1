import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

/**
 * SectionAttempt Model - Represents performance in a specific test section
 */
class SectionAttempt {
  static collection = 'sectionAttempts'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findByAttemptId(attemptId) {
    return dbHelpers.find(this.collection, { attemptId })
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      totalQuestions: data.totalQuestions || 0,
      attempted: data.attempted || 0,
      correct: data.correct || 0,
      wrong: data.wrong || 0,
      unattempted: data.unattempted || 0,
      marks: data.marks || 0,
      timeSpent: data.timeSpent || 0,
      accuracy: data.accuracy || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  static async updateById(id, data) {
    return dbHelpers.updateById(this.collection, id, {
      ...data,
      updatedAt: new Date().toISOString()
    })
  }

  static async deleteById(id) {
    return dbHelpers.deleteById(this.collection, id)
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }
}

export default SectionAttempt
