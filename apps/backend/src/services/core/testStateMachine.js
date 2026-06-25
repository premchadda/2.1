const STATES = Object.freeze({
  DRAFT: 'draft',
  REVIEW: 'review',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  LIVE: 'live',
  EXPIRED: 'expired',
  ARCHIVED: 'archived',
})

const ALLOWED_TRANSITIONS = Object.freeze({
  [STATES.DRAFT]: [STATES.REVIEW, STATES.ARCHIVED],
  [STATES.REVIEW]: [STATES.DRAFT, STATES.SCHEDULED, STATES.PUBLISHED],
  [STATES.SCHEDULED]: [STATES.REVIEW, STATES.PUBLISHED, STATES.ARCHIVED],
  [STATES.PUBLISHED]: [STATES.LIVE, STATES.EXPIRED, STATES.ARCHIVED],
  [STATES.LIVE]: [STATES.EXPIRED, STATES.ARCHIVED],
  [STATES.EXPIRED]: [STATES.ARCHIVED],
  [STATES.ARCHIVED]: [STATES.DRAFT],
})

const GUARDS = Object.freeze({
  [STATES.REVIEW]: (test) => {
    if (!test.title) return 'Test must have a title'
    if (!test.duration) return 'Test must have a duration set'
    return null
  },
  [STATES.SCHEDULED]: (test) => {
    if (!test.publishDate && !test.scheduledAt) return 'Test must have a scheduled date'
    return null
  },
  [STATES.PUBLISHED]: (test, questions) => {
    if (!questions || questions.length < 1) return 'Test must have at least one question'
    for (const q of questions) {
      const opts = q.options || q.options_json
      if (!Array.isArray(opts) || opts.length < 2) return `Question ${q.id} must have at least 2 options`
    }
    return null
  },
})

export const testStateMachine = {
  STATES,

  canTransition(from, to) {
    const allowed = ALLOWED_TRANSITIONS[from]
    if (!allowed) return false
    return allowed.includes(to)
  },

  validateTransition(test, to, questions = []) {
    const guard = GUARDS[to]
    if (guard) return guard(test, questions)
    return null
  },

  getNextStates(state) {
    return ALLOWED_TRANSITIONS[state] || []
  },

  isAvailableToUsers(state) {
    return state === STATES.PUBLISHED || state === STATES.LIVE
  },

  isActive(state) {
    return state !== STATES.ARCHIVED && state !== STATES.EXPIRED
  },
}
