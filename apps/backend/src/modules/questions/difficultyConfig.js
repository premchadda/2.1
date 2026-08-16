/**
 * QUESTION ENGINE FIX #3 (LOW): configurable difficulty taxonomy.
 *
 * Previously the allowed difficulty values were hardcoded in two places
 * (the admin UI `DIFFICULTY_LEVELS` and `questionBuilder.service.js`
 * `validDifficulties`). That made the taxonomy impossible to extend without
 * code changes. This module is the single source of truth for the backend.
 *
 * To extend the taxonomy, add an entry to `DIFFICULTY_TAXONOMY` (and mirror it
 * on the frontend in `difficultyConfig.js`). The list can also be overridden at
 * runtime via the `QUESTION_DIFFICULTY_LEVELS` env var, which expects a
 * comma-separated list of keys (e.g. "easy,medium,hard,very_hard,expert").
 */

const DEFAULT_TAXONOMY = [
  { key: 'easy', label: 'Easy', weight: 1, color: 'bg-green-100 text-green-700' },
  { key: 'medium', label: 'Medium', weight: 2, color: 'bg-yellow-100 text-yellow-700' },
  { key: 'hard', label: 'Hard', weight: 3, color: 'bg-red-100 text-red-700' },
  { key: 'very_hard', label: 'Very Hard', weight: 4, color: 'bg-purple-100 text-purple-700' },
]

function loadTaxonomy() {
  const override = process.env.QUESTION_DIFFICULTY_LEVELS
  if (!override) return DEFAULT_TAXONOMY

  const allowed = override
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // Map any known keys in the requested order; unknown keys are ignored.
  const byKey = new Map(DEFAULT_TAXONOMY.map((d) => [d.key, d]))
  const ordered = allowed
    .map((key) => byKey.get(key))
    .filter(Boolean)

  return ordered.length ? ordered : DEFAULT_TAXONOMY
}

export const DIFFICULTY_TAXONOMY = loadTaxonomy()

export const DIFFICULTY_KEYS = DIFFICULTY_TAXONOMY.map((d) => d.key)

export const isValidDifficulty = (value) =>
  !!value && DIFFICULTY_KEYS.includes(String(value).toLowerCase())

export const getDifficultyMeta = (value) =>
  DIFFICULTY_TAXONOMY.find((d) => d.key === String(value).toLowerCase()) || null

export default DIFFICULTY_TAXONOMY
