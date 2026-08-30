import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

/**
 * Test Model - Represents an individual test
 */
class Test {
  static collection = 'tests'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findBySlug(slug) {
    return dbHelpers.findOne(this.collection, { slug })
  }

  static async findByPublicId(publicId) {
    return dbHelpers.findByPublicId(this.collection, publicId)
  }

  /**
   * Resolve identifier (ID, public_id, or slug) to a test record
   */
  static async findByIdentifier(identifier) {
    if (!identifier) return null
    
    // 1. Try numeric ID
    if (!isNaN(identifier)) {
      const byId = await this.findById(identifier)
      if (byId) return byId
    }
    
    // 2. Try public_id
    if (String(identifier).startsWith('tst_')) {
      const byPublicId = await this.findByPublicId(identifier)
      if (byPublicId) return byPublicId
    }
    
    // 3. Try slug
    return this.findBySlug(identifier)
  }

  static async findActive() {
    return dbHelpers.find(this.collection, { isActive: true })
  }

  static async findBySeriesId(seriesId) {
    return dbHelpers.find(this.collection, { seriesId })
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

  /**
   * Find a test imported from an external source by its source ID.
   * Used for deduplication during ClassX/external imports.
   */
  static async findImported(source, sourceTestId) {
    return dbHelpers.findOne(this.collection, {
      importedFrom: source,
      sourceTestId: String(sourceTestId),
    })
  }

  /**
   * Find tests by test_type (mock, pyp, practice, sectional, etc.)
   */
  static async findByTestType(testType, query = {}) {
    return dbHelpers.find(this.collection, {
      ...query,
      testType,
      isActive: true,
    })
  }

  /**
   * Get tests with associated category names
   */
  static async getDetailed(query = {}) {
    const tests = await this.find(query)
    const series = await dbHelpers.find('testSeries')

    return tests.map(t => ({
      ...t,
      seriesTitle: series.find(s => String(s.id) === String(t.seriesId))?.title || 'Unknown Series'
    }))
  }
}

export default Test
