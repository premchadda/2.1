/**
 * AI Model Router - Client-side task-based routing
 * Selects model configuration based on task type and complexity.
 */

export const TASK_TYPES = {
  CHAT: 'CHAT',
  DOUBT: 'DOUBT',
  STUDY_PLAN: 'STUDY_PLAN',
  EXAM_STRATEGY: 'EXAM_STRATEGY',
  DAILY_TIP: 'DAILY_TIP',
}

export const COMPLEXITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
}

const ROUTES = {
  [TASK_TYPES.CHAT]: {
    [COMPLEXITY.LOW]:    { model: 'gpt-4o-mini', maxTokens: 512,  temperature: 0.7 },
    [COMPLEXITY.MEDIUM]: { model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.7 },
    [COMPLEXITY.HIGH]:   { model: 'gpt-4o',     maxTokens: 2048, temperature: 0.7 },
  },
  [TASK_TYPES.DOUBT]: {
    [COMPLEXITY.LOW]:    { model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.3 },
    [COMPLEXITY.MEDIUM]: { model: 'gpt-4o',     maxTokens: 2048, temperature: 0.3 },
    [COMPLEXITY.HIGH]:   { model: 'gpt-4o',     maxTokens: 4096, temperature: 0.3 },
  },
  [TASK_TYPES.STUDY_PLAN]: {
    [COMPLEXITY.LOW]:    { model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.6 },
    [COMPLEXITY.MEDIUM]: { model: 'gpt-4o',     maxTokens: 2048, temperature: 0.6 },
    [COMPLEXITY.HIGH]:   { model: 'gpt-4o',     maxTokens: 4096, temperature: 0.6 },
  },
  [TASK_TYPES.EXAM_STRATEGY]: {
    [COMPLEXITY.LOW]:    { model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.5 },
    [COMPLEXITY.MEDIUM]: { model: 'gpt-4o',     maxTokens: 2048, temperature: 0.5 },
    [COMPLEXITY.HIGH]:   { model: 'gpt-4o',     maxTokens: 4096, temperature: 0.4 },
  },
  [TASK_TYPES.DAILY_TIP]: {
    [COMPLEXITY.LOW]:    { model: 'gpt-4o-mini', maxTokens: 256,  temperature: 0.9 },
    [COMPLEXITY.MEDIUM]: { model: 'gpt-4o-mini', maxTokens: 512,  temperature: 0.9 },
    [COMPLEXITY.HIGH]:   { model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.9 },
  },
}

const DEFAULT_ROUTE = { model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.7 }

/**
 * Route a task to the appropriate model configuration.
 * @param {string} taskType   - one of TASK_TYPES
 * @param {string} complexity - one of COMPLEXITY
 * @returns {{ model: string, maxTokens: number, temperature: number }}
 */
export function routeTask(taskType, complexity = COMPLEXITY.MEDIUM) {
  const typeRoutes = ROUTES[taskType]
  if (!typeRoutes) return { ...DEFAULT_ROUTE }
  return { ...(typeRoutes[complexity] || typeRoutes[COMPLEXITY.MEDIUM]) }
}

/**
 * Infer complexity from a text prompt (simple heuristic).
 */
export function inferComplexity(text) {
  if (!text) return COMPLEXITY.LOW
  const len = text.length
  if (len < 80) return COMPLEXITY.LOW
  if (len < 300) return COMPLEXITY.MEDIUM
  return COMPLEXITY.HIGH
}
