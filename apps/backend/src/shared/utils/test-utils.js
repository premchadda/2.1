import { idsMatch } from './db-utils.js'
import { findEntityByIdentifier, getInternalId } from './identifier-utils.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

export async function findTestByIdentifier(testId, dbHelpers) {
  return findEntityByIdentifier(dbHelpers, 'tests', testId, { slugFields: ['slug'] })
}

export const getTestQuestionIds = async (testId) => {
  const rows = await dbHelpers.find('test_questions', { testId })
  return new Set(rows.map(r => String(r.questionId || r.question_id)))
}

export const filterQuestionsByTestId = async (questions, testId) => {
  const targetTestId = typeof testId === 'object' ? getInternalId(testId) : testId
  const questionIds = await getTestQuestionIds(targetTestId)
  return questions.filter((question) => questionIds.has(String(getInternalId(question))))
}

export async function getQuestionsByTestId(testId) {
  const result = await dbHelpers.query(
    `SELECT q.*, tq.marks as junction_marks, tq.negative_marks as junction_neg_marks,
            tq.order_index, tq.section_id
     FROM questions q
     JOIN test_questions tq ON q.id = tq.question_id
     WHERE tq.test_id = $1 AND q.is_active = true
     ORDER BY tq.order_index`,
    [testId]
  )
  return (result?.rows || []).map(row => dbHelpers.toCamel(row))
}
