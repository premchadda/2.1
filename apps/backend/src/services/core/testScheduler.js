import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { testStateMachine } from './testStateMachine.js'
import { runDatabaseMaintenance } from './maintenance.js'
import logger from '../../infrastructure/logger/logger.js'

const TRANSITION_MAP = Object.freeze([
  { from: 'scheduled', to: 'live', field: 'scheduledAt' },
  { from: 'live', to: 'expired', field: 'expiredAt' },
])

const CHECK_INTERVAL_MS = 60_000
// M22: run DB maintenance (DLQ cleanup, etc.) once per day.
const MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000

let intervalHandle = null
let maintenanceHandle = null

import { getRedisClient } from '../../infrastructure/cache/redisClient.js'

const LOCK_KEY = 'scheduler:lock'
const LOCK_TTL_MS = 55_000 // Slightly less than CHECK_INTERVAL_MS

const processTransitions = async () => {
  const redis = getRedisClient()
  if (redis) {
    // Attempt to acquire distributed lock
    const locked = await redis.set(LOCK_KEY, 'locked', 'PX', LOCK_TTL_MS, 'NX')
    if (!locked) return // Another instance holds the lock
  }

  const now = new Date().toISOString()

  for (const t of TRANSITION_MAP) {
    try {
      const tests = await dbHelpers.find('tests', { status: t.from, isActive: true })
      for (const test of tests) {
        let targetFieldValue = test[t.field] || test[t.field.replace('At', '_at')] || test.startTime || test.start_time
        if (t.to === 'expired' && !targetFieldValue) {
          targetFieldValue = test.endTime || test.end_time || test.scheduledEnd || test.scheduled_end || test.dateEnd || test.date_end
        }
        if (!targetFieldValue || targetFieldValue > now) continue

        // Validate state machine transition
        const isValid = testStateMachine.validateTransition(test.status, t.to)
        if (!isValid) {
          logger.warn(`[TestScheduler] Invalid transition for test ${test.id} from ${test.status} → ${t.to}`)
          continue
        }

        await dbHelpers.updateById('tests', test.id || test._id, {
          status: t.to,
          [`${t.to}At`]: now,
          is_live: t.to === 'live',
          stateUpdatedBy: null,
        })
        logger.info(`[TestScheduler] Auto-transitioned test ${test.id} from ${t.from} → ${t.to} (is_live: ${t.to === 'live'})`)
      }
    } catch (err) {
      logger.error(`[TestScheduler] Error processing ${t.from}→${t.to}:`, err.message)
    }
  }
}

export const startScheduler = () => {
  if (intervalHandle) return
  processTransitions()
  intervalHandle = setInterval(processTransitions, CHECK_INTERVAL_MS)
  // M22: lightweight daily maintenance (idempotent; never throws).
  maintenanceHandle = setInterval(runDatabaseMaintenance, MAINTENANCE_INTERVAL_MS)
  runDatabaseMaintenance()
  logger.info('[TestScheduler] Started (interval: 60s)')
}

export const stopScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  if (maintenanceHandle) {
    clearInterval(maintenanceHandle)
    maintenanceHandle = null
  }
  logger.info('[TestScheduler] Stopped')
}

export const testScheduler = { startScheduler, stopScheduler }
