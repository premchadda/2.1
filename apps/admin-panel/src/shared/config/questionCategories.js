/**
 * Question Categories Configuration
 * 
 * Shared configuration for question categorization across:
 * - QuestionsManager
 * - PracticeQuestionsManager
 * - QuizzesManager
 * - TestsManager
 */

import { ClipboardList, ScrollText, Sparkles, AlertTriangle } from 'lucide-react'

/**
 * Question category tabs configuration
 */
export const QUESTION_CATEGORIES = [
  {
    id: 'mock-tests',
    label: 'Mock Tests',
    icon: ClipboardList,
    description: 'Full-length & sectional mock test questions',
    gradient: 'from-indigo-500 to-blue-600',
    lightBg: 'bg-indigo-50',
    lightText: 'text-indigo-600',
    borderColor: 'border-indigo-500',
    ringColor: 'ring-indigo-200'
  },
  {
    id: 'pyp',
    label: 'Previous Year Papers',
    icon: ScrollText,
    description: 'Questions from past exam papers',
    gradient: 'from-amber-500 to-orange-600',
    lightBg: 'bg-amber-50',
    lightText: 'text-amber-600',
    borderColor: 'border-amber-500',
    ringColor: 'ring-amber-200'
  },
  {
    id: 'practice',
    label: 'Practice & Quiz',
    icon: Sparkles,
    description: 'Practice sets & quick quiz questions',
    gradient: 'from-emerald-500 to-teal-600',
    lightBg: 'bg-emerald-50',
    lightText: 'text-emerald-600',
    borderColor: 'border-emerald-500',
    ringColor: 'ring-emerald-200'
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: AlertTriangle,
    description: 'Incomplete drafts',
    gradient: 'from-rose-500 to-red-600',
    lightBg: 'bg-rose-50',
    lightText: 'text-rose-600',
    borderColor: 'border-rose-500',
    ringColor: 'ring-rose-200'
  }
]

/**
 * Mapping from question category IDs to database test category names
 */
export const QUESTION_CAT_TO_TEST_CAT_MAP = {
  'mock-tests': 'Mock Tests',
  'pyp': 'PYPs',
  'practice': 'Practice'
}

/**
 * Reverse map: DB test category value -> question category ID
 */
export const TEST_CAT_TO_QUESTION_CAT = Object.fromEntries(
  Object.entries(QUESTION_CAT_TO_TEST_CAT_MAP).map(([k, v]) => [v, k])
)

/**
 * Aliases for normalizing category values from database
 */
export const QUESTION_CATEGORY_ALIASES = {
  'mock-tests': ['mock-tests', 'mock', 'mock test', 'mock tests', 'Mock Tests'],
  'pyp': ['pyp', 'pyps', 'previous-year', 'previous year', 'previous year papers', 'Previous Year Papers', 'PYPs'],
  'practice': ['practice', 'quiz', 'practice-quiz', 'practice & quiz', 'Practice']
}

/**
 * Normalize a category value to a standard key
 */
export const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Get question category ID from a database test category value
 */
export const getQuestionCategoryId = (testCategoryValue) => {
  if (!testCategoryValue) return null
  
  const normalized = normalizeKey(testCategoryValue)
  
  // Check direct mapping first
  if (TEST_CAT_TO_QUESTION_CAT[testCategoryValue]) {
    return TEST_CAT_TO_QUESTION_CAT[testCategoryValue]
  }
  
  // Check aliases
  for (const [categoryId, aliases] of Object.entries(QUESTION_CATEGORY_ALIASES)) {
    if (aliases.some(alias => normalizeKey(alias) === normalized)) {
      return categoryId
    }
  }
  
  return null
}

export default {
  QUESTION_CATEGORIES,
  QUESTION_CAT_TO_TEST_CAT_MAP,
  TEST_CAT_TO_QUESTION_CAT,
  QUESTION_CATEGORY_ALIASES,
  normalizeKey,
  getQuestionCategoryId
}
