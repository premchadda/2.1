import { idsMatch } from './db-utils.js'

/**
 * Common attempt status check
 * @param {object} attempt 
 * @returns {boolean}
 */
export const isCompletedAttempt = (attempt) => {
  if (!attempt) return false
  const status = String(attempt.status || '').toLowerCase()
  return (
    attempt.isCompleted === true ||
    status === 'completed' ||
    status === 'submitted'
  )
}

/**
 * Fetches and filters attempts for a user
 * @param {string|number} userId 
 * @param {object} dbHelpers 
 * @param {object} options 
 * @returns {Promise<Array>}
 */
export const getUserAttempts = async (userId, dbHelpers, { completedOnly = false } = {}) => {
  const userAttempts = await dbHelpers.find('attempts', { userId })
  
  if (completedOnly) {
    return userAttempts.filter(isCompletedAttempt)
  }
  
  return userAttempts
}

/**
 * Formats a single attempt for consistent API response
 * @param {object} attempt 
 * @returns {object}
 */
export const formatAttemptResponse = (attempt) => {
  return {
    id: attempt._id || attempt.id,
    testId: attempt.testId,
    testTitle: attempt.testTitle || 'Untitled Test',
    score: parseFloat(attempt.score) || 0,
    totalMarks: attempt.totalMarks || 0,
    totalQuestions: attempt.totalQuestions || 0,
    correct: attempt.correct || 0,
    wrong: attempt.wrong || 0,
    skipped: attempt.skipped || attempt.unattempted || 0,
    accuracy: attempt.accuracy || 0,
    rank: attempt.rank || null,
    totalParticipants: attempt.totalParticipants || null,
    timeSpent: attempt.timeSpent || 0,
    date: attempt.submittedAt || attempt.createdAt,
    submittedAt: attempt.submittedAt || attempt.createdAt,
    status: attempt.status,
    isCompleted: attempt.isCompleted || false
  }
}
