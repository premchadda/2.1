import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

/**
 * LiveTest Model - Represents scheduled live test sessions
 */
class LiveTest {
  static collection = 'liveTests'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      registrationOpen: data.registrationOpen !== undefined ? data.registrationOpen : true,
      maxParticipants: data.maxParticipants || 10000,
      isCompleted: data.isCompleted !== undefined ? data.isCompleted : false,
      resultsPublished: data.resultsPublished !== undefined ? data.resultsPublished : false,
      chatEnabled: data.chatEnabled !== undefined ? data.chatEnabled : true,
      isAllIndiaMock: data.isAllIndiaMock !== undefined ? data.isAllIndiaMock : false,
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

  static async softDelete(id, userId) {
    return dbHelpers.softDelete(this.collection, id, userId)
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }

  static async findUpcoming() {
    return dbHelpers.find(this.collection, { 
      scheduledAt: { $gt: new Date().toISOString() },
      isActive: true 
    })
  }
}

export default LiveTest
