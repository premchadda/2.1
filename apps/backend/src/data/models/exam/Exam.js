import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

class Exam {
  static collection = 'exams'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findBySlug(slug) {
    return dbHelpers.findOne(this.collection, { slug })
  }

  static async findActive() {
    return dbHelpers.find(this.collection, { isActive: true })
  }

  /**
   * Resolve identifier (ID, public_id, or slug) to an exam record
   */
  static async findByIdentifier(identifier) {
    if (!identifier) return null
    if (!isNaN(identifier)) {
      const byId = await this.findById(identifier)
      if (byId) return byId
    }
    if (String(identifier).startsWith('exm_')) {
      const byPublicId = await dbHelpers.findByPublicId(this.collection, identifier)
      if (byPublicId) return byPublicId
    }
    return this.findBySlug(identifier)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
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
}

export default Exam