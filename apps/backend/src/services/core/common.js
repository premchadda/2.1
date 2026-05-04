export const toNumericId = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) return Number(value)
  return null
}

export const idsMatch = (left, right) => {
  if (left === undefined || left === null || right === undefined || right === null) return false
  if (left === right) return true

  const leftNum = toNumericId(left)
  const rightNum = toNumericId(right)
  if (leftNum !== null && rightNum !== null) return leftNum === rightNum

  return String(left) === String(right)
}

export const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const nullIfEmpty = (value) => {
  return (value === undefined || value === null || value === '') ? null : value
}

export const startOfDayIso = (date = new Date()) => {
  const clone = new Date(date)
  clone.setHours(0, 0, 0, 0)
  return clone.toISOString()
}

export const addDays = (date, days) => {
  const clone = new Date(date)
  clone.setDate(clone.getDate() + Number(days || 0))
  return clone
}

