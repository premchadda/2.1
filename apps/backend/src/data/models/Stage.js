import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

const parseExamIds = (value) => {
  if (Array.isArray(value)) {
    // Return array as is, dbHelpers will handle it
    return value
  }
  return value
}

/** Normalize DB / JSON / Postgres-array string to a flat id list */
const coerceIdArray = (val) => {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) {
    const t = val.trim()
    if (t.startsWith('{') && t.endsWith('}')) {
      return t
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
    try {
      const p = JSON.parse(t)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Stage Model - Manages test stages (Tier-1, Tier-2, CBT-1, CBT-2, etc.)
 * Each stage can have its own set of categories and subcategories
 */
class Stage {
  static collection = 'stages'

  // Stages are manually created and managed by admins

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
    const stages = await dbHelpers.find(this.collection, { isActive: true })
    return stages.sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  static async findBySlug(slug) {
    return dbHelpers.findOne(this.collection, { slug })
  }

  static async create(data) {
    return dbHelpers.insertOne(this.collection, {
      ...data,
      examIds: data.examIds || data.exam_ids || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true)
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

  static coerceIdArray(val) {
    return coerceIdArray(val)
  }

  static idEquals(a, b) {
    if (a == null || b == null) return false
    if (String(a) === String(b)) return true
    const na = Number(a)
    const nb = Number(b)
    return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb
  }

  /** Test category row linked to this stage (singular stageId or stageIds array / JSON). */
  static categoryLinkedToStage(cat, stage) {
    const sid = stage?._id ?? stage?.id
    if (sid == null || sid === '') return false
    if (cat.stageId != null && Stage.idEquals(cat.stageId, sid)) return true
    const fromArray = Array.isArray(cat.stageIds) ? cat.stageIds : coerceIdArray(cat.stageIds ?? cat.stage_ids)
    return fromArray.some((x) => Stage.idEquals(x, sid))
  }

  /** Test series linked by stages[] / stageId or by belonging to a category already linked to the stage. */
  static seriesLinkedToStage(series, stage) {
    const sid = stage?._id ?? stage?.id
    if (sid == null || sid === '') return false
    if (series.stageId != null && Stage.idEquals(series.stageId, sid)) return true
    const sStages = coerceIdArray(series.stages ?? series.stageIds)
    return sStages.some((x) => Stage.idEquals(x, sid))
  }

  /** Test row linked by stageId, stageIds, tier name, or via series membership (caller passes seriesIdSet). */
  static testLinkedToStage(test, stage) {
    const sid = stage?._id ?? stage?.id
    if (sid == null || sid === '') return false
    if (test.stageId != null && Stage.idEquals(test.stageId, sid)) return true
    const tStages = Array.isArray(test.stageIds) ? test.stageIds : coerceIdArray(test.stageIds)
    if (tStages.some((x) => Stage.idEquals(x, sid))) return true
    if (stage.name && test.tier === stage.name) return true
    return false
  }

  /**
   * Single source of truth for admin + public: categories, series (direct + via category), tests (direct + via series).
   */
  static getAggregatesForStage(stage, { categories, tests, testSeries }) {
    const linkedCategories = categories.filter((cat) => Stage.categoryLinkedToStage(cat, stage))
    const categoryIdSet = new Set(linkedCategories.map((c) => String(c._id ?? c.id)))

    const linkedSeries = testSeries.filter((series) => {
      if (Stage.seriesLinkedToStage(series, stage)) return true
      const cid = series.category ?? series.categoryId ?? series.category_id
      if (cid != null && categoryIdSet.has(String(cid))) return true
      const path = series.categoryPathIds
      if (Array.isArray(path) && path.some((id) => categoryIdSet.has(String(id)))) return true
      return false
    })

    const seriesIdSet = new Set(linkedSeries.map((s) => String(s._id ?? s.id)))

    const linkedTests = tests.filter((test) => {
      if (Stage.testLinkedToStage(test, stage)) return true
      const sid = test.seriesId ?? test.series_id
      if (sid != null && seriesIdSet.has(String(sid))) return true
      return false
    })

    return {
      linkedCategories,
      linkedSeries,
      linkedTests,
      categoryCount: linkedCategories.length,
      seriesCount: linkedSeries.length,
      testCount: linkedTests.length
    }
  }

  // Get stages with their categories
  static async getStagesWithCategories() {
    const stages = await this.findActive()
    const categories = await dbHelpers.find('testCategories', { isActive: true })

    return stages.map((stage) => ({
      ...stage,
      categories: categories.filter((cat) => Stage.categoryLinkedToStage(cat, stage))
    }))
  }

  // Get stages with test counts and categories
  static async getStagesWithTestCounts() {
    const stages = await this.findActive()
    const tests = await dbHelpers.find('tests', { isActive: true })
    const categories = await dbHelpers.find('testCategories', { isActive: true })
    const testSeries = await dbHelpers.find('testSeries', { isActive: true })

    return stages.map((stage) => {
      const agg = Stage.getAggregatesForStage(stage, { categories, tests, testSeries })
      return {
        ...stage,
        testCount: agg.testCount,
        categoryCount: agg.categoryCount,
        seriesCount: agg.seriesCount,
        categories: agg.linkedCategories
      }
    })
  }
}

export default Stage