import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

/**
 * Leaderboard Model - Represents rankings for a specific test
 */
class Leaderboard {
  static collection = 'leaderboards'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findByTestId(testId) {
    return dbHelpers.findOne(this.collection, { testId })
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      totalParticipants: data.totalParticipants || 0,
      topScore: data.topScore || 0,
      avgScore: data.avgScore || 0,
      isPublished: data.isPublished !== undefined ? data.isPublished : false,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  static async updateById(id, data) {
    return dbHelpers.updateById(this.collection, id, {
      ...data,
      updatedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    })
  }

  static async deleteById(id) {
    return dbHelpers.deleteById(this.collection, id)
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }
}

export default Leaderboard
