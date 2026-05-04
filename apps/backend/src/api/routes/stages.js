import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import Stage from '../../data/models/Stage.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

// FIX BUG-018: Use JSON arrays instead of PostgreSQL array format
const parseExamIds = (value) => {
  if (Array.isArray(value)) {
    return value.map(id => Number(id)).filter(id => !isNaN(id))
  }
  // Handle incoming PostgreSQL array format by converting to JSON array
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value.slice(1, -1).split(',').map(id => Number(id.trim())).filter(id => !isNaN(id))
  }
  return value
}

const router = express.Router()

// ===== PUBLIC ROUTES =====

// @route   GET /api/stages
// @desc    Get all active stages
// @access  Public
router.get('/', async (req, res) => {
  try {
    const stages = await Stage.findActive()
    res.json({ success: true, data: stages })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/with-categories
// @desc    Get stages with their associated categories
// @access  Public
router.get('/with-categories', async (req, res) => {
  try {
    const stages = await Stage.getStagesWithCategories()
    res.json({ success: true, data: stages })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/with-test-counts
// @desc    Get stages with test counts
// @access  Public
router.get('/with-test-counts', async (req, res) => {
  try {
    const stages = await Stage.getStagesWithTestCounts()
    res.json({ success: true, data: stages })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/:id
// @desc    Get stage by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }
    res.json({ success: true, data: stage })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/slug/:slug
// @desc    Get stage by slug
// @access  Public
router.get('/slug/:slug', async (req, res) => {
  try {
    const stage = await Stage.findBySlug(req.params.slug)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }
    res.json({ success: true, data: stage })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/:id/categories
// @desc    Get categories for a specific stage
// @access  Public
router.get('/:id/categories', async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }
    const all = await dbHelpers.find('testCategories', { isActive: true })
    const categories = all.filter((cat) => Stage.categoryLinkedToStage(cat, stage))
    res.json({ success: true, data: categories })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/:id/categories/tree
// @desc    Get categories for a specific stage as tree structure
// @access  Public
router.get('/:id/categories/tree', async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }
    const all = await dbHelpers.find('testCategories', { isActive: true })
    const categories = all.filter((cat) => Stage.categoryLinkedToStage(cat, stage))

    const normParent = (v) => (v == null || v === '' ? null : String(v))
    const buildTree = (items, parentId = null) => {
      const want = parentId == null ? null : String(parentId)
      return items
        .filter((item) => {
          const pid = item.parentId ?? item.parent_id ?? null
          return normParent(pid) === want
        })
        .map((item) => {
          const itemId = item._id ?? item.id
          return {
            ...item,
            children: buildTree(items, itemId)
          }
        })
    }

    const tree = buildTree(categories)
    res.json({ success: true, data: tree })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/:id/tests
// @desc    Get tests for a specific stage
// @access  Public
router.get('/:id/tests', async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }

    const categories = await dbHelpers.find('testCategories', { isActive: true })
    const testSeries = await dbHelpers.find('testSeries', { isActive: true })
    const allTests = await dbHelpers.find('tests', { isActive: true })
    const agg = Stage.getAggregatesForStage(stage, { categories, tests: allTests, testSeries })

    res.json({ success: true, count: agg.linkedTests.length, data: agg.linkedTests })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/stages/:id/details
// @desc    Get detailed stage statistics (linked exams, categories, series, tests)
// @access  Public
router.get('/:id/details', async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }

    const stageId = stage.id || stage._id
    const testCategories = await dbHelpers.find('testCategories', { isActive: true })
    const tests = await dbHelpers.find('tests', { isActive: true })
    const testSeries = await dbHelpers.find('testSeries', { isActive: true })
    const exams = await dbHelpers.find('exams', { isActive: true })
    const agg = Stage.getAggregatesForStage(stage, { categories: testCategories, tests, testSeries })

    const examRefs = Stage.coerceIdArray(stage.examIds)
    const linkedExams = exams
      .filter((exam) =>
        examRefs.some((ref) => Stage.idEquals(ref, exam.id) || Stage.idEquals(ref, exam.examId))
      )
      .map((exam) => ({
        id: exam.id,
        name: exam.title || exam.name,
        slug: exam.examId || exam.slug
      }))

    const linkedCategories = agg.linkedCategories.map((cat) => ({
      id: cat.id,
      name: cat.name || cat.label,
      slug: cat.slug
    }))

    const linkedSeries = agg.linkedSeries.map((series) => ({
      id: series.id,
      name: series.title || series.name,
      slug: series.slug
    }))

    const catNameMap = {}
    testCategories.forEach((c) => {
      const cid = c._id || c.id
      if (cid) catNameMap[String(cid)] = c.name
      if (c.slug) catNameMap[c.slug] = c.name
    })

    res.json({
      success: true,
      data: {
        stage: {
          id: stageId,
          name: stage.name,
          slug: stage.slug,
          icon: stage.icon,
          order: stage.order
        },
        linkedExams,
        linkedCategories,
        linkedSeries,
        tests: {
          total: agg.testCount,
          byCategory: agg.linkedTests.reduce((acc, test) => {
            const catId = test.categoryId || test.category
            const catName = (catId && catNameMap[String(catId)]) || catId || 'Uncategorized'
            acc[catName] = (acc[catName] || 0) + 1
            return acc
          }, {})
        }
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== ADMIN ROUTES =====

// @route   POST /api/stages/initialize
// @desc    Initialize default stages for common exam patterns
// @access  Admin
router.post('/initialize', protect, admin, async (req, res) => {
  try {
    // Check if stages already exist
    const existingStages = await Stage.findActive()
    if (existingStages.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Stages already exist (${existingStages.length} found). Delete them first or create manually.` 
      })
    }

    // Default stages for common exam patterns
    const defaultStages = [
      {
        name: 'Tier 1 (Pre)',
        slug: 'tier-1-pre',
        description: 'Staff Selection Commission - Preliminary Examination',
        icon: '📋',
        order: 1,
        examIds: [1, 2, 3, 4, 5, 6, 7, 8],
        isActive: true
      },
      {
        name: 'Tier 2 (Mains)',
        slug: 'tier-2-mains',
        description: 'Staff Selection Commission - Mains Examination',
        icon: '📝',
        order: 2,
        examIds: [1, 2, 3, 4, 5, 6, 7, 8],
        isActive: true
      },
      {
        name: 'CBT 1',
        slug: 'cbt-1',
        description: 'Railway - Computer Based Test 1',
        icon: '💻',
        order: 3,
        examIds: [21, 22, 23, 24, 25],
        isActive: true
      },
      {
        name: 'CBT 2',
        slug: 'cbt-2',
        description: 'Railway - Computer Based Test 2',
        icon: '🖥️',
        order: 4,
        examIds: [21, 22, 23, 24, 25],
        isActive: true
      },
      {
        name: 'Prelims',
        slug: 'prelims',
        description: 'Preliminary Examination',
        icon: '📄',
        order: 5,
        examIds: [],
        isActive: true
      },
      {
        name: 'Mains',
        slug: 'mains',
        description: 'Main Examination',
        icon: '📑',
        order: 6,
        examIds: [],
        isActive: true
      },
      {
        name: 'Interview',
        slug: 'interview',
        description: 'Personality Test / Interview',
        icon: '🎯',
        order: 7,
        examIds: [],
        isActive: true
      }
    ]

    const createdStages = []
    for (const stageData of defaultStages) {
      const stage = await Stage.create(stageData)
      createdStages.push(stage)
    }

    res.status(201).json({ 
      success: true, 
      message: `Created ${createdStages.length} default stages`,
      data: createdStages
    })
  } catch (error) {
    console.error('Failed to initialize stages:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/stages
// @desc    Create a new stage
// @access  Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, slug, description, order, icon, isActive } = req.body
    
    if (!name || !slug) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and slug are required' 
      })
    }
    
    // Check if slug already exists
    const existing = await Stage.findBySlug(slug)
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Stage with this slug already exists' 
      })
    }
    
    const stage = await Stage.create({
      name,
      slug,
      description,
      order: order || 0,
      icon,
      examIds: req.body.examIds || [],
      categoryIds: req.body.categoryIds || [],
      isActive: isActive !== undefined ? isActive : true
    })
    
    res.status(201).json({ success: true, data: stage })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/stages/:id
// @desc    Update a stage
// @access  Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { name, slug, description, order, icon, isActive } = req.body
    
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) {
      // Check if slug already exists for another stage
      const existing = await Stage.findBySlug(slug)
      if (existing && existing._id !== req.params.id && existing.id !== parseInt(req.params.id)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Stage with this slug already exists' 
        })
      }
      updateData.slug = slug
    }
    if (description !== undefined) updateData.description = description
    if (order !== undefined) updateData.order = order
    if (icon !== undefined) updateData.icon = icon
    if (req.body.examIds !== undefined) updateData.examIds = parseExamIds(req.body.examIds)
    if (req.body.categoryIds !== undefined) updateData.categoryIds = parseExamIds(req.body.categoryIds)
    if (isActive !== undefined) updateData.isActive = isActive
    
    const stage = await Stage.updateById(req.params.id, updateData)
    
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }

    // ✅ AUTO INVERSE RELATIONSHIP SYNC
    // Automatically update exam.stageIds when stage.examIds changes
    if (req.body.examIds !== undefined) {
      try {
        const exams = await dbHelpers.find('exams', { isActive: true })
        const stageId = stage.id || stage._id
        
        // Remove this stage from all exams first
        for (const exam of exams) {
          let currentStageIds = exam.stageIds || []
          if (typeof currentStageIds === 'string') {
            try { currentStageIds = JSON.parse(currentStageIds) } catch { currentStageIds = [] }
          }
          
          const hadStage = currentStageIds.some(id => String(id) === String(stageId))
          const shouldHaveStage = updateData.examIds.some(id => String(id) === String(exam.id) || String(id) === String(exam.examId))
          
          if (hadStage && !shouldHaveStage) {
            // Remove stage from this exam
            const newStageIds = currentStageIds.filter(id => String(id) !== String(stageId))
            await dbHelpers.updateById('exams', exam.id, { stageIds: newStageIds })
          } else if (!hadStage && shouldHaveStage) {
            // Add stage to this exam
            const newStageIds = [...currentStageIds, stageId]
            await dbHelpers.updateById('exams', exam.id, { stageIds: newStageIds })
          }
        }
      } catch (syncError) {
        console.error('Auto sync failed:', syncError)
        // Don't fail the request if sync fails - stage was still updated successfully
      }
    }
    
    res.json({ success: true, data: stage })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   DELETE /api/stages/:id
// @desc    Delete a stage
// @access  Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }
    
    const stageId = req.params.id
    
    // Check all tables that reference stages
    // Note: examCategories no longer linked to stages
    const checks = [
      { table: 'tests', field: 'stageId', label: 'tests' },
      { table: 'testCategories', field: 'stageId', label: 'test categories' },
      { table: 'exams', field: 'stageIds', label: 'exams', isArray: true },
      { table: 'testSeries', field: 'stages', label: 'test series', isArray: true },
      { table: 'subjects', field: 'stage_ids', label: 'subjects', isArray: true },
      { table: 'studyMaterials', field: 'stage_ids', label: 'study materials', isArray: true },
      { table: 'pypPapers', field: 'stage_id', label: 'previous year papers' },
    ]
    
    const associations = []
    
    for (const check of checks) {
      let items
      if (check.isArray) {
        // For array fields, we need to check if the stageId is in the array
        const allItems = await dbHelpers.find(check.table, { isActive: true })
        items = allItems.filter(item => {
          const arr = item[check.field]
          if (!arr) return false
          if (typeof arr === 'string') {
            try {
              return JSON.parse(arr).includes(Number(stageId)) || JSON.parse(arr).includes(stageId)
            } catch {
              return false
            }
          }
          if (Array.isArray(arr)) {
            return arr.includes(Number(stageId)) || arr.includes(stageId) || arr.includes(String(stageId))
          }
          return false
        })
      } else {
        items = await dbHelpers.find(check.table, { [check.field]: stageId, isActive: true })
      }
      
      if (items.length > 0) {
        associations.push({ table: check.label, count: items.length })
      }
    }
    
    if (associations.length > 0) {
      const details = associations.map(a => `${a.count} ${a.label}`).join(', ')
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete stage. It is referenced by: ${details}. Please reassign or remove them first.` 
      })
    }
    
    await Stage.softDelete(req.params.id, req.user.id)
    res.json({ success: true, message: 'Stage deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})


// @route   PUT /api/stages/:id/reorder
// @desc    Reorder stages
// @access  Admin
router.put('/:id/reorder', protect, admin, async (req, res) => {
  try {
    const { newOrder } = req.body
    
    if (typeof newOrder !== 'number') {
      return res.status(400).json({ 
        success: false, 
        message: 'newOrder must be a number' 
      })
    }
    
    const stage = await Stage.findById(req.params.id)
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Stage not found' })
    }
    
    await Stage.updateById(req.params.id, { order: newOrder })
    
    res.json({ success: true, message: 'Stage order updated' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/stages/sync-exam-ids
// @desc    Sync exam stage_ids based on stages' exam_ids (bidirectional linking)
// @access  Admin
router.post('/sync-exam-ids', protect, admin, async (req, res) => {
  try {
    const stages = await dbHelpers.find('stages', { isActive: true })
    const exams = await dbHelpers.find('exams', { isActive: true })
    
    let updatedCount = 0
    
    for (const stage of stages) {
      const examIds = stage.examIds || []
      
      for (const examRef of examIds) {
        // Find exam by id or examId
        const exam = exams.find(e => 
          String(e.id) === String(examRef) || 
          String(e.examId) === String(examRef)
        )
        
        if (exam) {
          // Get current stage_ids for this exam
          let currentStageIds = exam.stageIds || []
          if (typeof currentStageIds === 'string') {
            try {
              currentStageIds = JSON.parse(currentStageIds)
            } catch {
              currentStageIds = []
            }
          }
          
          // Add this stage if not already present
          if (!currentStageIds.includes(stage.id) && !currentStageIds.includes(stage._id)) {
            const newStageIds = [...currentStageIds, stage.id]
            await dbHelpers.updateById('exams', exam.id, { stageIds: newStageIds })
            updatedCount++
          }
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Synced exam stage_ids. Updated ${updatedCount} exam(s).`,
      updatedCount
    })
  } catch (error) {
    console.error('Failed to sync exam stage_ids:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/stages/update-exam-ids
// @desc    Update exam IDs for SSC (1-8) and Railway (21-25) and sync stages
// @access  Admin
router.post('/update-exam-ids', protect, admin, async (req, res) => {
  try {
    const exams = await dbHelpers.find('exams', { isActive: true })
    const stages = await dbHelpers.find('stages', { isActive: true })
    
    // ID mapping: SSC -> 1-8, Railway -> 21-25
    const idMapping = {
      // SSC exams
      'ssc-cgl': 1,
      'ssc-chsl': 2,
      'ssc-mts': 3,
      'ssc-gd': 4,
      'ssc-steno': 5,
      'ssc-cpo': 6,
      'ssc-je': 7,
      'ssc-selection-post': 8,
      // Railway exams
      'rrb-ntpc': 21,
      'rrb-group-d': 22,
      'rrb-alp': 23,
      'rrb-je': 24,
      'rrb-technician': 25
    }
    
    let examsUpdated = 0
    let stagesUpdated = 0
    
    // First pass: Update exam IDs
    for (const exam of exams) {
      const newId = idMapping[exam.examId]
      if (newId && exam.id !== newId) {
        // Check if new ID is not already taken
        const existingWithNewId = exams.find(e => e.id === newId)
        if (!existingWithNewId) {
          await dbHelpers.updateById('exams', exam.id, { id: newId })
          examsUpdated++
        }
      }
    }
    
    // Re-fetch exams after ID updates
    const updatedExams = await dbHelpers.find('exams', { isActive: true })
    
    // Second pass: Update stage examIds arrays
    for (const stage of stages) {
      let examIds = stage.examIds || []
      if (typeof examIds === 'string') {
        try { examIds = JSON.parse(examIds) } catch { examIds = [] }
      }
      
      // Map old IDs to new IDs
      const newExamIds = examIds.map(oldId => {
        // Check if this old ID matches an exam's examId
        const exam = updatedExams.find(e => String(e.id) === String(oldId))
        if (exam) return exam.id
        
        // Check if this is a slug that needs mapping
        const examBySlug = updatedExams.find(e => e.examId === oldId)
        if (examBySlug) return examBySlug.id
        
        // Check mapping
        const mappedId = idMapping[oldId]
        if (mappedId) return mappedId
        
        return oldId
      }).filter(id => {
        // Only keep IDs that exist in exams
        return updatedExams.some(e => e.id === id)
      })
      
      if (JSON.stringify(newExamIds) !== JSON.stringify(examIds)) {
        await dbHelpers.updateById('stages', stage.id, { examIds: newExamIds })
        stagesUpdated++
      }
    }
    
    // Third pass: Update stageIds in exams based on stages
    const finalExams = await dbHelpers.find('exams', { isActive: true })
    const finalStages = await dbHelpers.find('stages', { isActive: true })
    
    for (const exam of finalExams) {
      const stagesForExam = finalStages.filter(s => {
        const examIds = s.examIds || []
        return examIds.some(id => String(id) === String(exam.id))
      })
      
      const stageIds = stagesForExam.map(s => s.id)
      await dbHelpers.updateById('exams', exam.id, { stageIds })
    }
    
    res.json({ 
      success: true, 
      message: `Updated ${examsUpdated} exam IDs and ${stagesUpdated} stage exam lists. Data synced.`,
      examsUpdated,
      stagesUpdated,
      mapping: idMapping
    })
  } catch (error) {
    console.error('Failed to update exam IDs:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/stages/sync-all
// @desc    Run sync-exam-ids then update-exam-ids in one operation
// @access  Admin
router.post('/sync-all', protect, admin, async (req, res) => {
  try {
    const stages = await dbHelpers.find('stages', { isActive: true })
    const exams = await dbHelpers.find('exams', { isActive: true })
    
    const idMapping = {
      'ssc-cgl': 1,
      'ssc-chsl': 2,
      'ssc-mts': 3,
      'ssc-gd': 4,
      'ssc-steno': 5,
      'ssc-cpo': 6,
      'ssc-je': 7,
      'ssc-selection-post': 8,
      'rrb-ntpc': 21,
      'rrb-group-d': 22,
      'rrb-alp': 23,
      'rrb-je': 24,
      'rrb-technician': 25
    }

    let syncCount = 0
    let examsUpdated = 0
    let stagesUpdated = 0

    // Step 1: Sync exam stage_ids from stages' exam_ids
    for (const stage of stages) {
      const examIds = stage.examIds || []
      for (const examRef of examIds) {
        const exam = exams.find(e =>
          String(e.id) === String(examRef) ||
          String(e.examId) === String(examRef)
        )
        if (exam) {
          let currentStageIds = exam.stageIds || []
          if (typeof currentStageIds === 'string') {
            try { currentStageIds = JSON.parse(currentStageIds) } catch { currentStageIds = [] }
          }
          if (!currentStageIds.includes(stage.id) && !currentStageIds.includes(stage._id)) {
            await dbHelpers.updateById('exams', exam.id, { stageIds: [...currentStageIds, stage.id] })
            syncCount++
          }
        }
      }
    }

    // Step 2: Update exam IDs to canonical numeric values
    const examsAfterSync = await dbHelpers.find('exams', { isActive: true })
    for (const exam of examsAfterSync) {
      const newId = idMapping[exam.examId]
      if (newId && exam.id !== newId) {
        const existingWithNewId = examsAfterSync.find(e => e.id === newId)
        if (!existingWithNewId) {
          await dbHelpers.updateById('exams', exam.id, { id: newId })
          examsUpdated++
        }
      }
    }

    // Step 3: Update stage examIds arrays
    const stagesAfterExams = await dbHelpers.find('stages', { isActive: true })
    const updatedExams = await dbHelpers.find('exams', { isActive: true })
    for (const stage of stagesAfterExams) {
      let examIds = stage.examIds || []
      if (typeof examIds === 'string') {
        try { examIds = JSON.parse(examIds) } catch { examIds = [] }
      }
      const newExamIds = examIds.map(oldId => {
        const exam = updatedExams.find(e => String(e.id) === String(oldId))
        if (exam) return exam.id
        const examBySlug = updatedExams.find(e => e.examId === oldId)
        if (examBySlug) return examBySlug.id
        const mappedId = idMapping[oldId]
        if (mappedId) return mappedId
        return oldId
      }).filter(id => updatedExams.some(e => e.id === id))
      
      if (JSON.stringify(newExamIds) !== JSON.stringify(examIds)) {
        await dbHelpers.updateById('stages', stage.id, { examIds: newExamIds })
        stagesUpdated++
      }
    }

    // Step 4: Final sync of stageIds in exams
    const finalExams = await dbHelpers.find('exams', { isActive: true })
    const finalStages = await dbHelpers.find('stages', { isActive: true })
    for (const exam of finalExams) {
      const stagesForExam = finalStages.filter(s => {
        const examIds = s.examIds || []
        return examIds.some(id => String(id) === String(exam.id))
      })
      const stageIds = stagesForExam.map(s => s.id)
      await dbHelpers.updateById('exams', exam.id, { stageIds })
    }

    res.json({
      success: true,
      message: `Sync complete: ${syncCount} exam stage_ids synced, ${examsUpdated} exam IDs updated, ${stagesUpdated} stage exam lists updated.`,
      syncCount,
      examsUpdated,
      stagesUpdated
    })
  } catch (error) {
    console.error('Failed to sync all:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router