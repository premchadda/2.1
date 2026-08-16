import { dbHelpers } from '../../../infrastructure/database/postgres-helpers.js'

const pickVersionFields = (question) => ({
  text: question.questionText || question.question_text || question.text || '',
  options: question.options || [],
  correctAnswer: question.correctAnswer ?? question.correctOption ?? question.correct_answer ?? question.correct ?? 0,
  explanation: question.explanation ?? null,
  marks: question.marks ?? 1,
  negativeMarks: question.negativeMarks ?? question.negative_marks ?? 0,
  difficulty: question.difficulty ?? 'medium',
  questionType: question.questionType ?? question.question_type ?? 'single_correct',
})

const createVersionRecord = async (questionId, versionNumber, question, snapshotType = 'admin_edit', userId = null, changeSummary = null) => {
  const fields = pickVersionFields(question)
  return dbHelpers.insertOne('questionVersions', {
    questionId,
    versionNumber,
    ...fields,
    isCurrent: true,
    snapshotType,
    changeSummary,
    changedBy: userId,
    createdAt: new Date().toISOString(),
  })
}

class Question {
  static collection = 'questions'

  static async find(query = {}) {
    return dbHelpers.find(this.collection, query)
  }

  static async findById(id) {
    return dbHelpers.findById(this.collection, id)
  }

  static async findOne(query) {
    return dbHelpers.findOne(this.collection, query)
  }

  static async findByPublicId(publicId) {
    return dbHelpers.findByPublicId(this.collection, publicId)
  }

  static async findByIdentifier(identifier) {
    if (!identifier) return null
    if (!isNaN(identifier)) {
      const byId = await this.findById(identifier)
      if (byId) return byId
    }
    if (String(identifier).startsWith('qst_')) {
      const byPublicId = await this.findByPublicId(identifier)
      if (byPublicId) return byPublicId
    }
    return null
  }

  /**
   * Find a question by its external ID and import source.
   * Used for deduplication during ClassX/external imports.
   */
  static async findByExternalId(externalId, source = 'classx') {
    if (!externalId) return null
    return dbHelpers.findOne(this.collection, {
      externalQuestionId: String(externalId),
      importedFrom: source,
    })
  }

  static async findByTestId(testId) {
    return dbHelpers.queryRaw(
      `SELECT q.* FROM questions q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1 AND q.is_active = true ORDER BY q.question_number`,
      [testId]
    )
  }

  static async create(data) {
    const question = await dbHelpers.insertOne(this.collection, {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      questionNumber: data.questionNumber || 1,
      correctOption: data.correctOption !== undefined ? data.correctOption : 0,
      marks: data.marks || 1,
      negativeMarks: data.negativeMarks || 0,
      difficulty: data.difficulty || 'medium'
    })

    const questionId = question._id || question.id
    if (questionId) {
      await createVersionRecord(
        questionId, 1, data,
        'admin_edit', data.createdBy || null,
        'Initial version'
      )
    }

    return question
  }

  static async updateById(id, data, userId = null) {
    const existing = await this.findById(id)
    if (!existing) return null

    const updated = await dbHelpers.updateById(this.collection, id, {
      ...data,
      updatedAt: new Date().toISOString()
    })

    const existingVersion = await dbHelpers.findOne('questionVersions', { questionId: id, isCurrent: true })
    if (existingVersion) {
      await dbHelpers.updateById('questionVersions', existingVersion._id || existingVersion.id, { isCurrent: false })
    }

    const nextVersion = (existingVersion?.versionNumber ?? 0) + 1
    await createVersionRecord(
      id, nextVersion, { ...existing, ...data },
      'admin_edit', userId,
      'Edited'
    )

    return updated
  }

  static async deleteById(id) {
    return dbHelpers.deleteById(this.collection, id)
  }

  static async softDelete(id, userId) {
    return dbHelpers.softDelete(this.collection, id, userId)
  }

  static async bulkCreate(questions) {
    // PERF FIX (H13): previously this looped `create()` sequentially, issuing
    // 2 queries per question (insert + version record) = 2N round-trips. Now we
    // batch inserts via `insertMany`. Questions are grouped by their column
    // signature so each batch has a uniform column set (insertMany derives its
    // columns from the first row), then version records are inserted in a single
    // batch — reducing 2N queries to O(groups)+1.
    if (!questions || questions.length === 0) return []

    const now = new Date().toISOString()
    const normalized = questions.map((data) => ({
      ...data,
      createdAt: now,
      updatedAt: now,
      isActive: data.isActive !== undefined ? data.isActive : true,
      questionNumber: data.questionNumber || 1,
      correctOption: data.correctOption !== undefined ? data.correctOption : 0,
      marks: data.marks || 1,
      negativeMarks: data.negativeMarks || 0,
      difficulty: data.difficulty || 'medium',
    }))

    const groups = new Map()
    normalized.forEach((item, idx) => {
      const signature = Object.keys(item).sort().join('|')
      if (!groups.has(signature)) groups.set(signature, [])
      groups.get(signature).push({ item, idx })
    })

    const inserted = new Array(normalized.length)
    for (const group of groups.values()) {
      const rows = await dbHelpers.insertMany('questions', group.map((g) => g.item))
      group.forEach((g, i) => { inserted[g.idx] = rows[i] })
    }

    const versionRecords = []
    inserted.forEach((q, idx) => {
      const questionId = q?._id || q?.id
      if (!questionId) return
      versionRecords.push({
        questionId,
        versionNumber: 1,
        ...pickVersionFields(normalized[idx]),
        isCurrent: true,
        snapshotType: 'admin_edit',
        changeSummary: 'Initial version',
        changedBy: normalized[idx].createdBy || null,
        createdAt: new Date().toISOString(),
      })
    })

    if (versionRecords.length > 0) {
      await dbHelpers.insertMany('questionVersions', versionRecords)
    }

    return inserted.filter(Boolean)
  }

  static async count(query = {}) {
    return dbHelpers.count(this.collection, query)
  }

  static async getCurrentVersion(questionId) {
    return dbHelpers.findOne('questionVersions', { questionId, isCurrent: true })
  }

  static async getVersions(questionId) {
    return dbHelpers.find('questionVersions', { questionId }, { sort: { versionNumber: -1 } })
  }

  static async ensureVersion(questionId) {
    const existing = await dbHelpers.findOne('questionVersions', { questionId, isCurrent: true })
    if (existing) return existing

    const question = await this.findById(questionId)
    if (!question) return null

    const versionCount = await dbHelpers.count('questionVersions', { questionId })
    return createVersionRecord(
      questionId, versionCount + 1, question,
      'system', null,
      'Auto-created version'
    )
  }
}

export default Question
