// QUESTION ENGINE FIX #3 (LOW): single source of truth for the difficulty
// taxonomy on the admin frontend. Mirrors backend `difficultyConfig.js`.
// Kept in one place so the taxonomy is configurable without editing every
// component that renders a difficulty badge/select.
export const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200 dark:border-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' },
  { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800' },
  { value: 'very_hard', label: 'Very Hard', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800' },
]

export const DIFFICULTY_KEYS = DIFFICULTY_LEVELS.map((d) => d.value)

export const getDifficultyMeta = (value) =>
  DIFFICULTY_LEVELS.find((d) => d.value === value) || DIFFICULTY_LEVELS[1]

export default DIFFICULTY_LEVELS
