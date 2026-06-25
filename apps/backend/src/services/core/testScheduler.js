import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { testStateMachine } from './testStateMachine.js'

const TRANSITION_MAP = Object.freeze([
  { from: 'scheduled', to: 'live', field: 'scheduledAt' },
  { from: 'live', to: 'expired', field: 'expiredAt' },
])

const CHECK_INTERVAL_MS = 60_000

let intervalHandle = null

const processTransitions = async () => {
  const now = new Date().toISOString()

  for (const t of TRANSITION_MAP) {
    try {
      const tests = await dbHelpers.find('tests', { status: t.from, isActive: true })
      for (const test of tests) {
        const targetFieldValue = test[t.field] || test[t.field.replace('At', '_at')]
        if (!targetFieldValue || targetFieldValue > now) continue

        await dbHelpers.updateById('tests', test.id || test._id, {
          status: t.to,
          [`${t.to}At`]: now,
          stateUpdatedBy: null,
        })
        console.log(`[TestScheduler] Auto-transitioned test ${test.id} from ${t.from} → ${t.to}`)
      }
    } catch (err) {
      console.error(`[TestScheduler] Error processing ${t.from}→${t.to}:`, err.message)
    }
  }
}

export const startScheduler = () => {
  if (intervalHandle) return
  processTransitions()
  intervalHandle = setInterval(processTransitions, CHECK_INTERVAL_MS)
  console.log('[TestScheduler] Started (interval: 60s)')
}

export const stopScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
    console.log('[TestScheduler] Stopped')
  }
}

export const testScheduler = { startScheduler, stopScheduler }
