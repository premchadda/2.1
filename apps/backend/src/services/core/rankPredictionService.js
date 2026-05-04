import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { idsMatch, safeNumber } from './common.js'

const percentileOfScore = (sortedScores, score) => {
  if (sortedScores.length === 0) return 0
  const belowOrEqual = sortedScores.filter((value) => value <= score).length
  return (belowOrEqual / sortedScores.length) * 100
}

const percentileValue = (sortedScores, percentile) => {
  if (sortedScores.length === 0) return 0
  const index = Math.min(sortedScores.length - 1, Math.max(0, Math.floor((percentile / 100) * (sortedScores.length - 1))))
  return sortedScores[index]
}

const stdDeviation = (values) => {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export const predictRankForScore = async ({ testId, score, totalStudents = null }) => {
  const numericScore = safeNumber(score)
  const attempts = await dbHelpers.find('attempts', {})
  const completed = attempts.filter((attempt) => {
    const status = String(attempt.status || '').toLowerCase()
    return (
      idsMatch(attempt.testId || attempt.test_id, testId) &&
      (attempt.isCompleted === true || status === 'completed' || status === 'submitted')
    )
  })

  const scores = completed.map((attempt) => safeNumber(attempt.score)).sort((left, right) => left - right)
  const participants = Math.max(safeNumber(totalStudents, 0), scores.length, 1)

  const percentile = percentileOfScore(scores, numericScore)
  const predictedRank = Math.max(1, Math.round(((100 - percentile) / 100) * participants))
  const cutoff = percentileValue(scores, 75)
  const mean = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0
  const spread = stdDeviation(scores)

  return {
    testId,
    inputScore: numericScore,
    totalStudents: participants,
    sampleSize: scores.length,
    percentile: Number(percentile.toFixed(2)),
    predictedRank,
    expectedCutoff: Number(cutoff.toFixed(2)),
    distribution: {
      mean: Number(mean.toFixed(2)),
      stdDev: Number(spread.toFixed(2)),
      p25: Number(percentileValue(scores, 25).toFixed(2)),
      p50: Number(percentileValue(scores, 50).toFixed(2)),
      p75: Number(percentileValue(scores, 75).toFixed(2)),
      p90: Number(percentileValue(scores, 90).toFixed(2)),
    },
  }
}

export const rankPredictionService = {
  predictRankForScore,
}

export default rankPredictionService

