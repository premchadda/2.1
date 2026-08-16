/**
 * Database maintenance jobs (M22: dead_letter_jobs has no TTL/cleanup).
 *
 * These are invoked from the app scheduler on a daily interval. They are
 * idempotent and MUST NOT throw (so a maintenance blip never breaks the app).
 */
import { pool } from '../../infrastructure/database/postgres-helpers.js'

const DEFAULT_RETENTION_DAYS = 30

/**
 * Permanently delete dead-letter jobs older than `retentionDays`.
 * Returns the number of rows removed.
 */
export const purgeDeadLetterJobs = async (retentionDays = DEFAULT_RETENTION_DAYS) => {
  try {
    const result = await pool.query(
      `DELETE FROM dead_letter_jobs
       WHERE failed_at < NOW() - ($1 || ' days')::interval`,
      [String(retentionDays)]
    )
    const removed = result.rowCount || 0
    if (removed > 0) {
      console.log(`[Maintenance] Purged ${removed} dead_letter_jobs older than ${retentionDays}d`)
    }
    return removed
  } catch (error) {
    // Maintenance failures must never break the app or the scheduler.
    console.error('[Maintenance] dead_letter_jobs purge failed:', error.message)
    return 0
  }
}

/**
 * Prune expired CSRF tokens / stale auth artifacts if not already handled
 * elsewhere. Kept as an extension point for future retention jobs.
 */
export const runDatabaseMaintenance = async () => {
  await purgeDeadLetterJobs()
}
