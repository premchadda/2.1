import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import analyticsService from './analyticsService.js'
import { idsMatch, safeNumber } from './common.js'

const normalizeText = (value) => String(value || '').toLowerCase()

const scoreTestForTopics = (test, weakTopics) => {
  const searchable = [
    test.title,
    test.category,
    test.subCategory,
    ...(Array.isArray(test.tags) ? test.tags : []),
  ]
    .map(normalizeText)
    .join(' ')

  let score = 0
  weakTopics.forEach((topicRow) => {
    const topic = normalizeText(topicRow.topic)
    const subject = normalizeText(topicRow.subject)
    if (topic && searchable.includes(topic)) score += 3
    if (subject && searchable.includes(subject)) score += 2
    score += Math.max(0, (100 - safeNumber(topicRow.accuracy)) / 50)
  })

  return score
}

const saveRecommendations = async (userId, payload) => {
  await pool.query(
    `
    INSERT INTO user_recommendations (user_id, recommendation_type, payload, score, generated_at, is_active)
    VALUES ($1, 'dashboard', $2::jsonb, $3, NOW(), true)
    `,
    [userId, JSON.stringify(payload), safeNumber(payload.score, 0)]
  )
}

export const getRecommendationsForUser = async (userId, { limit = 6 } = {}) => {
  const weakTopics = await analyticsService.getUserWeakTopics(userId, { minAttempts: 2, limit: 10 })
  const allTests = await dbHelpers.find('tests', { isActive: true })
  const attempts = await dbHelpers.find('attempts', { userId })
  const attemptedTestIds = new Set(
    attempts
      .filter((attempt) => attempt.isCompleted === true || String(attempt.status || '').toLowerCase() === 'completed')
      .map((attempt) => String(attempt.testId || attempt.test_id))
  )

  const candidateTests = allTests
    .filter((test) => !attemptedTestIds.has(String(test.id || test._id)))
    .map((test) => ({
      ...test,
      recommendationScore: scoreTestForTopics(test, weakTopics),
    }))
    .filter((test) => test.recommendationScore > 0)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)

  // Fallback: if no weak topics or no matching tests, recommend recent tests
  let finalCandidates = candidateTests
  if (finalCandidates.length === 0) {
    finalCandidates = allTests
      .filter((test) => !attemptedTestIds.has(String(test.id || test._id)))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, limit)
      .map((test) => ({
        ...test,
        recommendationScore: 1, // Default score for fallback
      }))
  } else {
    finalCandidates = finalCandidates.slice(0, limit)
  }

  const allTopics = await dbHelpers.find('topics', { isActive: true }).catch(() => [])
  const chapterSuggestions = allTopics
    .map((topic) => {
      const topicName = normalizeText(topic.name || topic.title)
      const matchingWeakTopic = weakTopics.find(
        (weak) => topicName && (topicName.includes(normalizeText(weak.topic)) || topicName.includes(normalizeText(weak.subject)))
      )
      if (!matchingWeakTopic) return null
      return {
        id: topic.id || topic._id,
        name: topic.name || topic.title,
        subject: topic.subject || matchingWeakTopic.subject,
        score: 100 - safeNumber(matchingWeakTopic.accuracy),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const dashboardSuggestions = weakTopics.slice(0, 3).map((topicRow) => ({
    type: 'weak_topic',
    title: `Improve ${topicRow.topic}`,
    description: `Your accuracy is ${topicRow.accuracy.toFixed(1)}%. Attempt focused practice tests.`,
    topic: topicRow.topic,
    subject: topicRow.subject,
  }))

  const payload = {
    weakTopics,
    recommendedTests: candidateTests.map((test) => ({
      id: test.id || test._id,
      title: test.title,
      category: test.category,
      subCategory: test.subCategory || test.subcategory,
      recommendationScore: Number(test.recommendationScore.toFixed(2)),
    })),
    recommendedChapters: chapterSuggestions,
    dashboardSuggestions,
    score: candidateTests.reduce((sum, test) => sum + safeNumber(test.recommendationScore), 0),
  }

  await saveRecommendations(userId, payload)

  return payload
}

export const refreshRecommendationsFromEvent = async ({ userId, testId }) => {
  if (!userId) {
    if (!testId) return { refreshed: 0 }
    const attempts = await dbHelpers.find('attempts', {})
    const usersForTest = Array.from(
      new Set(
        attempts
          .filter((attempt) => idsMatch(attempt.testId || attempt.test_id, testId))
          .map((attempt) => attempt.userId || attempt.user_id)
          .filter(Boolean)
      )
    )
    await Promise.all(usersForTest.map((entryUserId) => getRecommendationsForUser(entryUserId, { limit: 6 })))
    return { refreshed: usersForTest.length }
  }

  await getRecommendationsForUser(userId, { limit: 6 })
  return { refreshed: 1 }
}

export const recommendationService = {
  getRecommendationsForUser,
  refreshRecommendationsFromEvent,
}

export default recommendationService

