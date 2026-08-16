/**
 * Canonical Question & Quiz Constants
 *
 * Single source of truth for Question Types and Status Options across admin panel.
 */

export const QUESTION_TYPES = [
  { value: 'mcq', label: 'MCQ', description: 'Single correct answer' },
  { value: 'msq', label: 'MSQ', description: 'Multiple correct answers' },
  { value: 'numeric', label: 'Numeric', description: 'Numerical answer' },
  { value: 'true-false', label: 'True/False', description: 'True or false answer' },
  { value: 'match', label: 'Match', description: 'Match the following' },
  { value: 'comprehension', label: 'Comprehension', description: 'Reading comprehension' },
  { value: 'descriptive', label: 'Descriptive', description: 'Text / descriptive answer' }
]

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'archived', label: 'Archived', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' }
]

export default {
  QUESTION_TYPES,
  STATUS_OPTIONS
}
