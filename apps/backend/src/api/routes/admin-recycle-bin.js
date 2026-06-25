import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// Tables that participate in the recycle bin (have the _orphaned column)
const TRASH_TABLES = ['tests', 'questions', 'test_series', 'subjects', 'topics', 'chapters', 'study_materials']

const TABLE_LABELS = {
  tests: 'Test',
  questions: 'Question',
  test_series: 'Test Series',
  subjects: 'Subject',
  topics: 'Topic',
  chapters: 'Chapter',
  study_materials: 'Study Material',
}

/**
 * GET /api/admin/trash
 * List all soft-deleted items across the configurable trash tables.
 */
router.get('/', protect, admin, async (req, res) => {
  try {
    const items = []
    for (const table of TRASH_TABLES) {
      try {
        const rows = await dbHelpers.find(table, { _orphaned: true }, 50)
        for (const row of rows) {
          items.push({
            id: row.id || row.public_id || row._id,
            publicId: row.public_id || row.publicId,
            name: row.name || row.title || row.question || `Item ${row.id || row._id}`,
            type: TABLE_LABELS[table] || table,
            table,
            deletedAt: row.deleted_at || row.updated_at || row.created_at,
            deletedBy: row.deleted_by || null,
            original: row,
          })
        }
      } catch (tableErr) {
        // Skip tables that don't exist or don't have _orphaned
        continue
      }
    }

    items.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0))

    res.json({
      success: true,
      data: items,
      pagination: { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load trash', error: error.message })
  }
})

/**
 * PUT /api/admin/trash/:id/restore
 * Restore a soft-deleted item by clearing its _orphaned flag.
 */
router.put('/:id/restore', protect, admin, async (req, res) => {
  try {
    const { id } = req.params
    const { table } = req.query
    if (!table || !TRASH_TABLES.includes(table)) {
      return res.status(400).json({ success: false, message: 'Missing or invalid table name' })
    }
    const numericId = parseInt(id, 10)
    const lookupId = Number.isNaN(numericId) ? id : numericId
    await dbHelpers.updateById(table, lookupId, { _orphaned: false, deleted_at: null, deleted_by: null })
    res.json({ success: true, message: 'Item restored' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to restore item', error: error.message })
  }
})

/**
 * DELETE /api/admin/trash/:id
 * Permanently delete an item.
 */
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params
    const { table } = req.query
    if (!table || !TRASH_TABLES.includes(table)) {
      return res.status(400).json({ success: false, message: 'Missing or invalid table name' })
    }
    const numericId = parseInt(id, 10)
    const lookupId = Number.isNaN(numericId) ? id : numericId
    await dbHelpers.deleteById(table, lookupId)
    res.json({ success: true, message: 'Item permanently deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete item', error: error.message })
  }
})

/**
 * DELETE /api/admin/trash
 * Permanently delete ALL soft-deleted items across all trash tables.
 */
router.delete('/', protect, admin, async (_req, res) => {
  let purged = 0
  for (const table of TRASH_TABLES) {
    try {
      const rows = await dbHelpers.find(table, { _orphaned: true }, { limit: 500 })
      for (const row of rows) {
        const id = row.id || row._id
        if (id) {
          await dbHelpers.deleteById(table, id)
          purged += 1
        }
      }
    } catch {
      // skip tables we can't touch
    }
  }
  res.json({ success: true, message: `${purged} item(s) permanently deleted`, data: { purged } })
})

export default router