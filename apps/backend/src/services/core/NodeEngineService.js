import { pool } from '../../infrastructure/database/postgres-helpers.js'
import logger from '../../infrastructure/logger/logger.js'

export class NodeEngineService {
  constructor(dbHelpers = pool) {
    this.db = dbHelpers
  }

  // 1. Calculate student mastery score (0.0 to 1.0)
  calculateMastery(correct, total, timeSpentSeconds = 60) {
    if (!total || total <= 0) return 0.0
    const accuracy = correct / total
    // Speed factor: optimal time per question is ~60s
    const speedFactor = timeSpentSeconds > 0 ? Math.min(1.2, 60 / timeSpentSeconds) : 1.0
    const mastery = accuracy * Math.min(1.0, speedFactor)
    return Math.min(1.0, Math.max(0.0, Number(mastery.toFixed(4))))
  }

  // 2. Compute time decay score (0.0 to 1.0) based on forgetting curve
  getTimeDecay(lastAttemptedAt) {
    if (!lastAttemptedAt) return 1.0 // Never attempted = maximum freshness needed
    const daysSince = (Date.now() - new Date(lastAttemptedAt).getTime()) / (1000 * 60 * 60 * 24)
    return Math.min(1.0, Math.max(0.0, Number((daysSince / 30.0).toFixed(4))))
  }

  // 3. Compute AI recommendation score for a node & student
  getRecommendationScore(node, userSkill) {
    const aiMeta = typeof node.ai_meta === 'string' ? JSON.parse(node.ai_meta || '{}') : (node.ai_meta || {})
    const mastery = userSkill?.mastery_score ?? 0.0
    const difficulty = aiMeta.difficulty_score ?? 0.5
    const freshness = this.getTimeDecay(userSkill?.last_attempted_at)

    const priority = (1 - mastery) * 0.5 + difficulty * 0.3 + freshness * 0.2
    return Number(priority.toFixed(4))
  }

  // 4. Forgetting curve threshold check for spaced repetition
  shouldRevise(userSkill) {
    if (!userSkill || !userSkill.last_attempted_at) return true
    const daysSince = (Date.now() - new Date(userSkill.last_attempted_at).getTime()) / (1000 * 60 * 60 * 24)
    const thresholdDays = 1 / ((userSkill.mastery_score || 0) + 0.1)
    return daysSince > thresholdDays
  }

  // 5. Get top personalized node recommendations for student
  async getRecommendations(userId, limit = 5) {
    const nodesRes = await this.db.query(`
      SELECT id, title, slug, parent_id, node_type, exam_id, subject_id, display_order, ai_meta
      FROM nodes
      WHERE is_active = true
      ORDER BY id ASC
      LIMIT 100
    `)

    if (nodesRes.rows.length === 0) return []

    const skillsRes = await this.db.query(`
      SELECT node_id, mastery_score, confidence_score, attempt_count, correct_count, last_attempted_at
      FROM user_node_skill
      WHERE user_id = $1
    `, [userId])

    const skillMap = new Map()
    for (const skill of skillsRes.rows) {
      skillMap.set(skill.node_id, skill)
    }

    const scoredNodes = nodesRes.rows.map(node => {
      const userSkill = skillMap.get(node.id)
      const priority = this.getRecommendationScore(node, userSkill)
      const mastery = userSkill?.mastery_score ?? 0.0
      
      let reason = 'High-priority core topic'
      if (mastery < 0.4) {
        reason = `Weak area (Mastery: ${Math.round(mastery * 100)}%)`
      } else if (this.shouldRevise(userSkill)) {
        reason = 'Scheduled for revision (Forgetting curve)'
      }

      return {
        id: node.id,
        title: node.title,
        nodeType: node.node_type,
        mastery: Math.round(mastery * 100),
        priority,
        reason,
        aiMeta: node.ai_meta,
      }
    })

    scoredNodes.sort((a, b) => b.priority - a.priority)
    return scoredNodes.slice(0, limit)
  }

  // 6. Generate dynamic personalized learning path
  async generateLearningPath(userId, rootNodeId = null) {
    let query = `SELECT id, title, slug, parent_id, node_type, ai_meta FROM nodes WHERE is_active = true`
    const params = []
    if (rootNodeId) {
      query += ` AND (id = $1 OR parent_id = $1)`
      params.push(rootNodeId)
    }
    query += ` ORDER BY display_order ASC`

    const nodesRes = await this.db.query(query, params)
    const skillsRes = await this.db.query(`SELECT * FROM user_node_skill WHERE user_id = $1`, [userId])

    const skillMap = new Map()
    for (const s of skillsRes.rows) skillMap.set(s.node_id, s)

    const path = nodesRes.rows.map(node => {
      const skill = skillMap.get(node.id)
      const score = this.getRecommendationScore(node, skill)
      return {
        id: node.id,
        title: node.title,
        nodeType: node.node_type,
        score,
        mastery: Math.round((skill?.mastery_score || 0) * 100),
        status: (skill?.mastery_score || 0) >= 0.8 ? 'mastered' : (skill?.attempt_count || 0) > 0 ? 'in_progress' : 'locked',
      }
    })

    return path.sort((a, b) => b.score - a.score)
  }

  // 7. Get due spaced repetition topics
  async getSpacedRepetitions(userId) {
    const skillsRes = await this.db.query(`
      SELECT uns.*, n.title, n.node_type
      FROM user_node_skill uns
      JOIN nodes n ON n.id = uns.node_id
      WHERE uns.user_id = $1 AND n.is_active = true
    `, [userId])

    const due = []
    for (const skill of skillsRes.rows) {
      if (this.shouldRevise(skill)) {
        due.push({
          nodeId: skill.node_id,
          title: skill.title,
          nodeType: skill.node_type,
          mastery: Math.round((skill.mastery_score || 0) * 100),
          lastAttemptedAt: skill.last_attempted_at,
        })
      }
    }

    return due
  }

  // 8. Record user attempt & dynamically update Node Engine AI state
  async recordAttempt(userId, nodeId, isCorrect, timeSpentSeconds = 45) {
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')

      // Get current skill
      const currentSkillRes = await client.query(`
        SELECT * FROM user_node_skill WHERE user_id = $1 AND node_id = $2 FOR UPDATE
      `, [userId, nodeId])

      let skill = currentSkillRes.rows[0]
      const attemptCount = (skill?.attempt_count || 0) + 1
      const correctCount = (skill?.correct_count || 0) + (isCorrect ? 1 : 0)
      const newMastery = this.calculateMastery(correctCount, attemptCount, timeSpentSeconds)

      if (skill) {
        await client.query(`
          UPDATE user_node_skill
          SET attempt_count = $1,
              correct_count = $2,
              mastery_score = $3,
              last_attempted_at = NOW(),
              updated_at = NOW()
          WHERE user_id = $4 AND node_id = $5
        `, [attemptCount, correctCount, newMastery, userId, nodeId])
      } else {
        await client.query(`
          INSERT INTO user_node_skill (user_id, node_id, mastery_score, attempt_count, correct_count, last_attempted_at)
          VALUES ($1, $2, $3, 1, $4, NOW())
        `, [userId, nodeId, newMastery, isCorrect ? 1 : 0])
      }

      // Update node difficulty signal in ai_meta
      const nodeRes = await client.query(`SELECT ai_meta FROM nodes WHERE id = $1 FOR UPDATE`, [nodeId])
      if (nodeRes.rows.length > 0) {
        const aiMeta = typeof nodeRes.rows[0].ai_meta === 'string'
          ? JSON.parse(nodeRes.rows[0].ai_meta || '{}')
          : (nodeRes.rows[0].ai_meta || {})

        const nodeAttempts = (aiMeta.attempt_count || 0) + 1
        const nodeCorrect = (aiMeta.correct_count || 0) + (isCorrect ? 1 : 0)
        const correctRate = nodeCorrect / nodeAttempts
        const difficultyScore = Number((1 - correctRate).toFixed(4))

        const updatedMeta = {
          ...aiMeta,
          attempt_count: nodeAttempts,
          correct_count: nodeCorrect,
          correct_rate: Number(correctRate.toFixed(4)),
          difficulty_score: difficultyScore,
        }

        await client.query(`UPDATE nodes SET ai_meta = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(updatedMeta), nodeId])
      }

      await client.query('COMMIT')
      logger.info(`[NodeEngine] Updated skill & node difficulty for user ${userId}, node ${nodeId} (mastery: ${newMastery})`)

      return {
        success: true,
        masteryScore: newMastery,
        attemptCount,
        correctCount,
      }
    } catch (err) {
      await client.query('ROLLBACK')
      logger.error(`[NodeEngine] Error recording attempt:`, err.message)
      throw err
    } finally {
      client.release()
    }
  }
}

export const nodeEngineService = new NodeEngineService()
