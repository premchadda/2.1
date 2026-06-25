import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

class Coupon {
  static collection = 'coupons'

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

export default Coupon
