import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

/**
 * Notification Model - Represents user notifications
 */
class Notification {
  static collection = 'notifications'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findByUserId(userId, query = {}) {
    return dbHelpers.find(this.collection, { userId, ...query })
  }

  static async findUnreadByUserId(userId) {
    return dbHelpers.find(this.collection, { userId, isRead: false })
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      isRead: data.isRead !== undefined ? data.isRead : false,
      isSent: data.isSent !== undefined ? data.isSent : false,
      priority: data.priority || 'normal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== undefined ? data.isActive : true
    })
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id) {
    return dbHelpers.updateById(this.collection, id, {
      isRead: true,
      readAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  /**
   * Mark all user notifications as read
   */
  static async markAllAsRead(userId) {
    const unread = await this.findUnreadByUserId(userId)
    const promises = unread.map(notif => this.markAsRead(notif.id))
    await Promise.all(promises)
    return { count: unread.length }
  }

  static async deleteById(id) {
    return dbHelpers.deleteById(this.collection, id)
  }

  static async updateById(id, data) {
    return dbHelpers.updateById(this.collection, id, {
      ...data,
      updatedAt: new Date().toISOString()
    })
  }
}

export default Notification
