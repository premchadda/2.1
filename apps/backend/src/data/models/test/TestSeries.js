import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

/**
 * TestSeries Model - Represents a collection of tests (Mock Tests, PYPs, etc.)
 */
class TestSeries {
  static collection = 'testSeries'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findByPublicId(publicId) {
    return dbHelpers.findByPublicId(this.collection, publicId)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findBySlug(slug) {
    return dbHelpers.findOne(this.collection, { slug })
  }

  static async findActive() {
    return dbHelpers.find(this.collection, { isActive: true })
  }

  /**
   * Find test series by exam and optionally stage.
   * Supports the V3 hierarchy: Exam → Stage → Test Series
   */
  static async findByExamAndStage(examId, stageId = null) {
    const query = { examId, isActive: true }
    if (stageId) query.stageId = stageId
    return dbHelpers.find(this.collection, query)
  }

  /**
   * Resolve identifier (ID, public_id, or slug) to a series record
   */
  static async findByIdentifier(identifier) {
    if (!identifier) return null
    
    // 1. Try numeric ID
    if (!isNaN(identifier)) {
      const byId = await this.findById(identifier)
      if (byId) return byId
    }
    
    // 2. Try public_id
    if (String(identifier).startsWith('ser_')) {
      const byPublicId = await this.findByPublicId(identifier)
      if (byPublicId) return byPublicId
    }
    
    // 3. Try slug
    return this.findBySlug(identifier)
  }

  /**
   * Resolve an array of stage identifiers (public_id or ID) to numeric IDs
   */
  static async resolveStages(stages) {
    if (!Array.isArray(stages)) return []
    
    const allStages = await dbHelpers.find('stages')
    const resolved = []
    
    for (const sIdent of stages) {
      const stage = allStages.find(s => 
        String(s.public_id || '') === String(sIdent) || 
        String(s.id || '') === String(sIdent) ||
        String(s._id || '') === String(sIdent)
      )
      if (stage) {
        resolved.push(stage.id || stage._id)
      }
    }
    return resolved
  }

  static async create(data) {
    // Resolve stages if provided
    let resolvedStages = []
    if (data.stages) {
      resolvedStages = await this.resolveStages(data.stages)
    }

    // Normalize category arrays
    const testCategoryIds = Array.isArray(data.testCategoryIds) ? data.testCategoryIds : []
    const testSubCategoryIds = Array.isArray(data.testSubCategoryIds) ? data.testSubCategoryIds : []

    return dbHelpers.insertOne(this.collection, {
      ...data,
      stages: resolvedStages,
      testCategoryIds,
      testSubCategoryIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      totalTests: data.totalTests || 0,
      freeTests: data.freeTests || 0,
      rating: data.rating || 4.5
    })
  }

  static async updateById(id, data) {
    const updateData = { ...data }
    
    // Resolve stages if provided
    if (Array.isArray(updateData.stages)) {
      updateData.stages = await this.resolveStages(updateData.stages)
    }

    // Normalize category arrays if provided
    if (Array.isArray(updateData.testCategoryIds)) {
      // noop - already validated as array
    }
    if (Array.isArray(updateData.testSubCategoryIds)) {
      // noop - already validated as array
    }

    // Clean up restricted fields
    delete updateData.order
    delete updateData.isPinned
    delete updateData.is_pinned

    return dbHelpers.updateById(this.collection, id, {
      ...updateData,
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
   * Get test series with actual test counts and types
   */
  static async getWithCounts(query = {}) {
    const seriesList = await this.find(query)
    if (seriesList.length === 0) return []

    // PERF FIX (H11): previously this loaded the ENTIRE tests table into memory
    // and ran a nested `.filter()` per series (O(series * tests)). Now we fetch
    // only the tests belonging to the series in this result set ($in), then
    // bucket them into a map for O(1) lookup — reducing to O(series + tests).
    const seriesIds = []
    for (const s of seriesList) {
      if (s.id !== undefined && s.id !== null) seriesIds.push(String(s.id))
      if (s._id !== undefined && s._id !== null) seriesIds.push(String(s._id))
    }

    const tests = await dbHelpers.find('tests', {
      isActive: true,
      seriesId: { $in: seriesIds },
    })

    const testsBySeries = new Map()
    for (const t of tests) {
      const key = String(t.seriesId)
      if (!testsBySeries.has(key)) testsBySeries.set(key, [])
      testsBySeries.get(key).push(t)
    }

    return seriesList.map(s => {
      const idKey = String(s.id)
      const altKey = String(s._id)
      const seriesTests = [
        ...(testsBySeries.get(idKey) || []),
        ...(altKey !== idKey ? (testsBySeries.get(altKey) || []) : []),
      ]

      const testTypesMap = {}
      seriesTests.forEach(t => {
        const type = t.subCategory || t.category || t.type || 'Other'
        testTypesMap[type] = (testTypesMap[type] || 0) + 1
      })

      return {
        ...s,
        totalTests: seriesTests.length,
        freeTests: seriesTests.filter(t => t.isPro === false || t.type?.toLowerCase() === 'free').length,
        testTypes: Object.keys(testTypesMap),
        testCounts: testTypesMap
      }
    })
  }
}

export default TestSeries
