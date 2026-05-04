import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { idsMatch } from './common.js'

export const getActiveAttemptForUser = async (userId, testId) => {
  const attempts = await dbHelpers.find('attempts', { userId })
  return (
    attempts.find(
      (attempt) =>
        !attempt.isCompleted &&
        (String(attempt.status || '').toLowerCase() === 'in_progress' ||
          String(attempt.status || '').toLowerCase() === 'paused') &&
        (testId ? idsMatch(attempt.testId || attempt.test_id, testId) : true)
    ) || null
  )
}

export const saveAttemptProgress = async (
  attemptId,
  { answers, markedForReview, sectionTimers, currentSection, timeSpent } = {}
) => {
  const payload = {
    answers: Array.isArray(answers) ? answers : [],
    markedForReview: Array.isArray(markedForReview) ? markedForReview : [],
    sectionTimers: sectionTimers && typeof sectionTimers === 'object' ? sectionTimers : {},
    currentSection: typeof currentSection === 'string' ? currentSection : null,
    timeSpent: Number(timeSpent || 0),
    updatedAt: new Date().toISOString(),
  }

  return dbHelpers.updateById('attempts', attemptId, payload)
}

export const testEngineService = {
  getActiveAttemptForUser,
  saveAttemptProgress,
}

export default testEngineService

