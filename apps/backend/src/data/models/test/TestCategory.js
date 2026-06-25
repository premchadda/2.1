import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

const normalizeId = (id) => {
  if (id == null) return null
  return String(id)
}

const normalizeSnakeToCamel = (data) => {
  const normalized = { ...data }
  if ('display_order' in normalized) {
    normalized.displayOrder = normalized.display_order
    delete normalized.display_order
  }
  if ('is_active' in normalized) {
    normalized.isActive = normalized.is_active
    delete normalized.is_active
  }
  if ('parent_id' in normalized) {
    normalized.parentId = normalized.parent_id
    delete normalized.parent_id
  }
  if ('stage_ids' in normalized) {
    normalized.stageIds = normalized.stage_ids
    delete normalized.stage_ids
  }
  if ('stageId' in normalized && !('stageIds' in normalized)) {
    normalized.stageIds = normalized.stageId ? [normalized.stageId] : []
    delete normalized.stageId
  }
  if ('test_series_id' in normalized) {
    normalized.testSeriesId = normalized.test_series_id
    delete normalized.test_series_id
  }
  if ('series_id' in normalized || 'seriesId' in normalized) {
    normalized.testSeriesId = normalized.series_id || normalized.seriesId
    delete normalized.series_id
    delete normalized.seriesId
  }
  if ('seriesId' in normalized) {
    normalized.testSeriesId = normalized.seriesId
    delete normalized.seriesId
  }
  if ('exam_category_id' in normalized) {
    normalized.examCategoryId = normalized.exam_category_id
    delete normalized.exam_category_id
  }
  return normalized
}

class TestCategory {
  static collection = 'testCategories'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findActive() {
    return dbHelpers.find(this.collection, { isActive: true })
  }

  static async findByParent(parentId) {
    return dbHelpers.find(this.collection, { parentId: parentId || null })
  }

  static async findByExamCategory(examCategoryId) {
    return dbHelpers.find(this.collection, { examCategoryId })
  }

  static async findByTestSeries(testSeriesId) {
    const parsedId = await dbHelpers.resolveInternalId('testSeries', testSeriesId)
    if (!Number.isFinite(Number(parsedId)) || Number(parsedId) <= 0) return []

    try {
      const result = await dbHelpers.pool.query(
        `SELECT tc.* FROM test_categories tc
         INNER JOIN test_category_series tcs ON tc.id = tcs.test_category_id
         WHERE tcs.test_series_id = $1 AND tc.is_active = true
         ORDER BY tc.display_order ASC`,
        [Number(parsedId)]
      )
      return result.rows.map(row => dbHelpers.toCamel(row))
    } catch (error) {
      console.error('TestCategory.findByTestSeries error:', error.message)
      return []
    }
  }

  static async findOrphaned() {
    return dbHelpers.find(this.collection, { 
      examCategoryId: null, 
      testSeriesId: null, 
      isActive: true 
    })
  }

  static async findRoots(examCategoryId = null, stageId = null) {
    const query = { parentId: null }
    if (examCategoryId) {
      query.examCategoryId = examCategoryId
    }
    if (stageId) {
      query.stageId = stageId
    }
    return dbHelpers.find(this.collection, query)
  }

  static async findByStage(stageId) {
    return dbHelpers.find(this.collection, { stageId, isActive: true })
  }

  static async findByStageWithChildren(stageId) {
    const allCategories = await dbHelpers.find(this.collection, { isActive: true })
    const stageCategories = allCategories.filter(cat =>
      cat.stageId === stageId || cat.stageId === String(stageId) ||
      (Array.isArray(cat.stageIds) && cat.stageIds.includes(Number(stageId)))
    )
    return this.buildTree(stageCategories)
  }

  static async findCommonCategories() {
    return dbHelpers.find(this.collection, { stageId: null, isActive: true })
  }

  static async create(data) {
    const normalized = normalizeSnakeToCamel(data)

    const { testSeriesId, ...categoryData } = normalized

    const result = await dbHelpers.insertOne(this.collection, {
      ...categoryData,
      parentId: normalized.parentId || null,
      examCategoryId: normalized.examCategoryId || null,
      stageIds: Array.isArray(normalized.stageIds) ? normalized.stageIds : [],
      level: normalized.level || 0,
      displayOrder: normalized.displayOrder ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: normalized.isActive !== undefined ? normalized.isActive : true
    })

    if (testSeriesId && result?.id) {
      await this.linkToTestSeries(result.id, testSeriesId)
    }

    return result
  }

  static async updateById(id, data) {
    const normalized = normalizeSnakeToCamel({ ...data, updatedAt: new Date().toISOString() })

    delete normalized.seriesId
    delete normalized.series_id
    delete normalized.test_series_id

    const { testSeriesId, ...categoryData } = normalized

    const result = await dbHelpers.updateById(this.collection, id, categoryData)

    if (testSeriesId !== undefined && result?.id) {
      await this.unlinkFromTestSeries(result.id)
      if (testSeriesId) {
        await this.linkToTestSeries(result.id, testSeriesId)
      }
    }

    return result
  }

  static async linkToTestSeries(testCategoryId, testSeriesId) {
    const parsedCatId = await dbHelpers.resolveInternalId('testCategories', testCategoryId)
    const parsedSeriesId = await dbHelpers.resolveInternalId('testSeries', testSeriesId)
    if (!parsedCatId || !parsedSeriesId) return

    try {
      await dbHelpers.pool.query(
        'INSERT INTO test_category_series (test_category_id, test_series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [Number(parsedCatId), Number(parsedSeriesId)]
      )
    } catch (error) {
      console.error('TestCategory.linkToTestSeries error:', error.message)
    }
  }

  static async unlinkFromTestSeries(testCategoryId) {
    const parsedCatId = await dbHelpers.resolveInternalId('testCategories', testCategoryId)
    if (!parsedCatId) return

    try {
      await dbHelpers.pool.query(
        'DELETE FROM test_category_series WHERE test_category_id = $1',
        [Number(parsedCatId)]
      )
    } catch (error) {
      console.error('TestCategory.unlinkFromTestSeries error:', error.message)
    }
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

  static buildTree(categories, parentId = null) {
    return categories
      .filter(cat => normalizeId(cat.parentId) === normalizeId(parentId))
      .sort((a, b) => ((a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0)))
      .map(cat => ({
        ...cat,
        children: this.buildTree(categories, cat._id ?? cat.id)
      }))
  }

  static getCategoryPath(categories, categoryId, maxDepth = 20) {
    const path = []
    const visited = new Set()
    let current = categories.find(c => (c._id ?? c.id) === categoryId)

    while (current && path.length < maxDepth) {
      const id = current._id ?? current.id
      if (visited.has(id)) break
      visited.add(id)
      path.unshift(current)
      current = current.parentId
        ? categories.find(c => (c._id ?? c.id) === current.parentId)
        : null
    }

    return path
  }

  static getDescendants(categories, categoryId) {
    const descendants = []
    const children = categories.filter(c => normalizeId(c.parentId) === normalizeId(categoryId))

    for (const child of children) {
      descendants.push(child)
      descendants.push(...this.getDescendants(categories, child._id ?? child.id))
    }

    return descendants
  }

  /**
   * Find all test series linked to this category or subcategory
   */
  static async findLinkedTestSeries(categoryId) {
    const allSeries = await dbHelpers.find('testSeries', { isActive: true })
    const catIdStr = String(categoryId)
    
    return allSeries.filter(series => {
      // Check if category is linked directly or as subcategory
      const hasCategory = Array.isArray(series.testCategoryIds) && 
        series.testCategoryIds.some(id => String(id) === catIdStr)
      
      const hasSubCategory = Array.isArray(series.testSubCategoryIds) && 
        series.testSubCategoryIds.some(id => String(id) === catIdStr)
      
      return hasCategory || hasSubCategory
    })
  }
}

export default TestCategory
