import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js'
import { responseCache } from '../../middleware/responseCache.middleware.js'

const router = express.Router()

router.use(protect)
router.use(admin)

// Tables that participate in the recycle bin. dbHelpers.softDelete() sets
// is_deleted = true / is_active = false (migration 032 pattern), so the trash
// list must query { is_deleted: true } — NOT { _orphaned: true }.
const TRASH_TABLES = ['tests', 'questions', 'test_series', 'subjects', 'topics', 'chapters', 'study_materials', 'banners', 'faqs', 'coupons', 'notifications', 'email_templates', 'tag_configs']

const TABLE_LABELS = {
  tests: 'Test',
  questions: 'Question',
  test_series: 'Test Series',
  subjects: 'Subject',
  topics: 'Topic',
  chapters: 'Chapter',
  study_materials: 'Study Material',
  banners: 'Banner',
  faqs: 'FAQ',
  coupons: 'Coupon',
  notifications: 'Notification',
  email_templates: 'Email Template',
  tag_configs: 'Tag Config',
}

// Trash rows are typically is_active = false, and dbHelpers.find() applies a
// default is_active = true scope — opt out so deleted rows are returned.
const TRASH_QUERY = { is_deleted: true, includeInactive: true }

/**
 * GET /api/admin/trash
 * List all soft-deleted items across the configurable trash tables.
 */
router.get('/', protect, admin, responseCache('admin-trash', 15), async (req, res) => {
  try {
    const results = await Promise.allSettled(
      TRASH_TABLES.map(async (table) => {
        const rows = await dbHelpers.find(table, TRASH_QUERY, 50)
        return rows.map((row) => ({
          id: row.id || row.public_id || row._id,
          publicId: row.public_id || row.publicId,
          name: row.name || row.title || row.question || `Item ${row.id || row._id}`,
          type: TABLE_LABELS[table] || table,
          table,
          deletedAt: row.deleted_at || row.deletedAt || row.updated_at || row.updatedAt || row.created_at || row.createdAt,
          deletedBy: row.deleted_by || row.deletedBy || null,
          original: row,
        }))
      })
    )

    const items = []
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        items.push(...res.value)
      }
    }

    items.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0))

    res.json({
      success: true,
      data: items,
      pagination: { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load trash', error: sanitizeErrorMessage(error) })
  }
})

/**
 * PUT /api/admin/trash/:id/restore
 * Restore a soft-deleted item: clear is_deleted, re-activate, and clear the
 * deletion audit fields. `_orphaned`/`isActive` camel aliases are included so
 * the update matches both legacy and standardized column names (toSnake
 * normalizes them; updateById filters out columns that don't exist).
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
    const restored = await dbHelpers.updateById(table, lookupId, {
      is_deleted: false,
      is_active: true,
      isActive: true,
      _orphaned: false,
      deleted_at: null,
      deleted_by: null,
    })
    if (!restored) {
      return res.status(404).json({ success: false, message: 'Item not found in trash' })
    }
    res.json({ success: true, message: 'Item restored' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to restore item', error: sanitizeErrorMessage(error) })
  }
})

const purgeAllTrash = async (_req, res) => {
  try {
    let purged = 0
    const results = await Promise.allSettled(
      TRASH_TABLES.map(async (table) => {
        try {
          const hasIsDeleted = await dbHelpers.columnExists(table, 'is_deleted')
          if (hasIsDeleted) {
            const deleteRes = await pool.query(`DELETE FROM "${table}" WHERE is_deleted = true`)
            return deleteRes.rowCount || 0
          }
          return 0
        } catch (err) {
          // If foreign key constraint prevents bulk delete, fall back to individual deleteById
          const rows = await dbHelpers.find(table, TRASH_QUERY, 500).catch(() => [])
          let subPurged = 0
          for (const row of rows) {
            const id = row.id || row._id
            if (id) {
              const ok = await dbHelpers.deleteById(table, id).catch(() => false)
              if (ok) subPurged += 1
            }
          }
          return subPurged
        }
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && typeof r.value === 'number') {
        purged += r.value
      }
    }

    if (purged === 0) {
      return res.json({ success: true, message: 'Trash is already empty', data: { purged: 0 } })
    }
    res.json({ success: true, message: `${purged} item(s) permanently deleted`, data: { purged } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to empty trash', error: sanitizeErrorMessage(error) })
  }
}

/**
 * DELETE /api/admin/trash
 * DELETE /api/admin/trash/empty
 * Permanently delete ALL soft-deleted items across all trash tables.
 */
router.delete('/empty', protect, admin, purgeAllTrash)
router.delete('/', protect, admin, purgeAllTrash)

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
    const deleted = await dbHelpers.deleteById(table, lookupId)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Item not found in trash' })
    }
    res.json({ success: true, message: 'Item permanently deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete item', error: sanitizeErrorMessage(error) })
  }
})

export default router