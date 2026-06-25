import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

/**
 * Result Model - Represents user test attempt results
 */
class Result {
  static collection = 'results'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findByUserId(userId) {
    return dbHelpers.find(this.collection, { userId }, { sort: { submittedAt: -1 } })
  }

  static async findByTestId(testId) {
    return dbHelpers.find(this.collection, { testId }, { sort: { score: -1 } })
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      attemptNumber: data.attemptNumber || 1,
      score: data.score || 0,
      totalMarks: data.totalMarks || 0,
      correctCount: data.correctCount || 0,
      incorrectCount: data.incorrectCount || 0,
      skippedCount: data.skippedCount || 0,
      timeSpent: data.timeSpent || 0,
      isCompleted: data.isCompleted !== undefined ? data.isCompleted : false,
      startedAt: data.startedAt || new Date().toISOString(),
      submittedAt: data.submittedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== undefined ? data.isActive : true
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

export default Result
