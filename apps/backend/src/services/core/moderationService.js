import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

const MODERATION_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
})

const VALID_TRANSITIONS = Object.freeze({
  [MODERATION_STATUS.PENDING_REVIEW]: [MODERATION_STATUS.APPROVED, MODERATION_STATUS.CHANGES_REQUESTED, MODERATION_STATUS.REJECTED],
  [MODERATION_STATUS.CHANGES_REQUESTED]: [MODERATION_STATUS.PENDING_REVIEW, MODERATION_STATUS.APPROVED],
  [MODERATION_STATUS.REJECTED]: [MODERATION_STATUS.PENDING_REVIEW],
  [MODERATION_STATUS.APPROVED]: [MODERATION_STATUS.PENDING_REVIEW],
})

export const moderationService = {
  MODERATION_STATUS,

  async submitForReview(entityType, entityId, userId) {
    const table = entityType === 'question' ? 'questions' : 'tests'
    const entity = await dbHelpers.findById(table, entityId)
    if (!entity) return { error: `${entityType} not found` }
    return dbHelpers.updateById(table, entityId, {
      moderationStatus: MODERATION_STATUS.PENDING_REVIEW,
      submittedBy: userId,
      submittedForReviewAt: new Date().toISOString(),
    })
  },

  async review(entityType, entityId, decision, reviewerId, notes = null) {
    if (!Object.values(MODERATION_STATUS).includes(decision)) {
      return { error: `Invalid decision: ${decision}` }
    }
    const table = entityType === 'question' ? 'questions' : 'tests'
    const entity = await dbHelpers.findById(table, entityId)
    if (!entity) return { error: `${entityType} not found` }
    const current = entity.moderationStatus || 'approved'
    const allowed = VALID_TRANSITIONS[current]
    if (allowed && !allowed.includes(decision)) {
      return { error: `Cannot transition from '${current}' to '${decision}'` }
    }
    // Optimistic locking: only update if the status hasn't changed since we
    // read it. Two concurrent reviews will race — the second one's WHERE
    // clause will match 0 rows because the first already changed the status.
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const result = await pool.query(
      `UPDATE ${table} SET moderation_status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $4 AND (moderation_status = $5 OR (moderation_status IS NULL AND $5 = 'approved'))
       RETURNING *`,
      [decision, reviewerId, notes, entityId, current]
    )
    if (result.rows.length === 0) {
      return { error: `Status was already changed by another reviewer. Please refresh and try again.` }
    }
    return result.rows[0]
  },

  async getPendingCount(entityType) {
    const table = entityType === 'question' ? 'questions' : 'tests'
    return dbHelpers.count(table, { moderationStatus: MODERATION_STATUS.PENDING_REVIEW, isActive: true })
  },

  async listPending(entityType) {
    const table = entityType === 'question' ? 'questions' : 'tests'
    return dbHelpers.find(table, { moderationStatus: MODERATION_STATUS.PENDING_REVIEW, isActive: true })
  },
}
