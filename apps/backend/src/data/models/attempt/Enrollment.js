import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

/**
 * Enrollment Model - Represents a user's enrollment in a test series
 */
class Enrollment {
  static collection = 'enrollments'

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
    return dbHelpers.find(this.collection, { userId })
  }

  static async findByUserAndSeries(userId, seriesId) {
    return dbHelpers.findOne(this.collection, { userId, seriesId })
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      enrolledAt: data.enrolledAt || new Date().toISOString(),
      status: data.status || 'active',
      progress: data.progress || 0,
      amount: data.amount || 0,
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

export default Enrollment
