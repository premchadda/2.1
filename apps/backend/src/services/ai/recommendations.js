import { pool } from '../../infrastructure/database/postgres-helpers.js'

export const analyzeUserPerformance = async (userId) => {
  const userAttempts = await pool.query(`
    SELECT 
      a.*,
      jsonb_array_elements(CASE WHEN jsonb_typeof(a.answers) = 'array' THEN a.answers ELSE '[]'::jsonb END) as user_answer
    FROM attempts a
    WHERE a.user_id = $1 AND a.status = 'completed'
    ORDER BY a.submitted_at DESC
    LIMIT 100
  `, [userId])

  if (userAttempts.rows.length === 0) {
    return { isReady: false, message: 'No completed tests yet' }
  }

  const topicPerformance = await pool.query(`
    SELECT 
      t.name as topic_name,
      t.id as topic_id,
      s.name as subject_name,
      COUNT(*) as total_attempted,
      SUM(CASE WHEN (ua.answer->>'selectedOption')::int = q.correct_option THEN 1 ELSE 0 END) as correct,
       AVG(CASE WHEN LOWER(q.difficulty) = 'easy' THEN 1 WHEN LOWER(q.difficulty) = 'medium' THEN 2 WHEN LOWER(q.difficulty) = 'hard' THEN 3 ELSE 2 END) as avg_difficulty_numeric
    FROM attempts a
    CROSS JOIN jsonb_array_elements(CASE WHEN jsonb_typeof(a.answers) = 'array' THEN a.answers ELSE '[]'::jsonb END) as ua(answer)
    JOIN questions q ON q.id = (ua.answer->>'questionId')::int
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s ON s.id = q.subject
    WHERE a.user_id = $1 AND a.status = 'completed'
    GROUP BY t.id, t.name, s.name
  `, [userId])

  const topicStats = topicPerformance.rows.map(row => ({
    topicId: row.topic_id,
    topicName: row.topic_name,
    subjectName: row.subject_name,
    attempted: parseInt(row.total_attempted),
    correct: parseInt(row.correct),
    accuracy: parseInt(row.total_attempted) > 0 
      ? Math.round((parseInt(row.correct) / parseInt(row.total_attempted)) * 100) 
      : 0,
    difficulty: !row.avg_difficulty_numeric ? 'medium' : row.avg_difficulty_numeric < 1.5 ? 'easy' : row.avg_difficulty_numeric < 2.5 ? 'medium' : 'hard'
  }))

  return {
    isReady: true,
    topics: topicStats,
    weakTopics: topicStats.filter(t => t.accuracy < 50).sort((a, b) => a.accuracy - b.accuracy),
    strongTopics: topicStats.filter(t => t.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy),
    averageTimePerTopic: topicStats.reduce((sum, t) => sum + t.attempted, 0) / (topicStats.length || 1)
  }
}

export const generateRecommendations = async (userId) => {
  const performance = await analyzeUserPerformance(userId)
  
  if (!performance.isReady) {
    return []
  }

  const recommendations = []

  if (performance.weakTopics?.length > 0) {
    for (const topic of performance.weakTopics.slice(0, 3)) {
      recommendations.push({
        type: 'weak_topic',
        priority: 'high',
        title: 'Focus on ' + topic.topicName,
        description: `Your accuracy in ${topic.topicName} is only ${topic.accuracy}%. Practice more questions from this topic.`,
        action: { type: 'practice_topic', topicId: topic.topicId },
        reason: 'accuracy',
        metric: topic.accuracy
      })
    }
  }

  const slowTopics = performance.topics?.filter(t => t.attempted > 5 && t.avgTime > 120) || []
  if (slowTopics.length > 0) {
    recommendations.push({
      type: 'speed',
      priority: 'medium',
      title: 'Improve speed in ' + slowTopics[0].topicName,
      description: `You spend too much time on ${slowTopics[0].topicName}. Try to solve faster with practice.`,
      action: { type: 'timed_practice', topicId: slowTopics[0].topicId },
      reason: 'time'
    })
  }

  const hardestTopics = performance.topics?.filter(t => t.difficulty === 'hard' && t.accuracy < 30) || []
  if (hardestTopics.length > 0) {
    recommendations.push({
      type: 'difficulty',
      priority: 'medium',
      title: 'Build concepts for ' + hardestTopics[0].topicName,
      description: `You struggle with harder questions in ${hardestTopics[0].topicName}. Review fundamentals first.`,
      action: { type: 'study_concept', topicId: hardestTopics[0].topicId },
      reason: 'difficulty'
    })
  }

  return recommendations
}