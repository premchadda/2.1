/**
 * Helper to parse IDs that might be numeric or strings
 * @param {any} value 
 * @returns {number|null}
 */
export const parseNumericId = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) {
    return Number(value)
  }
  return null
}

/**
 * Helper to compare two IDs that might be in different formats (string vs number)
 * @param {any} left 
 * @param {any} right 
 * @returns {boolean}
 */
export const idsMatch = (left, right) => {
  if (left === undefined || left === null || right === undefined || right === null) return false
  if (left === right) return true

  const leftNum = parseNumericId(left)
  const rightNum = parseNumericId(right)
  if (leftNum !== null && rightNum !== null) return leftNum === rightNum

  return String(left) === String(right)
}
