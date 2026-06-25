/**
 * Locale-aware formatting helpers used across the admin panel.
 *
 * These centralise the locale and currency so we don't sprinkle
 * `toLocaleString('en-IN')` and `₹` literals throughout the codebase.
 * When localisation is added later, this is the only file to change.
 */

const LOCALE = 'en-IN'
const CURRENCY = 'INR'

export const formatCurrency = (amount, currency = CURRENCY) => {
  if (amount === null || amount === undefined || amount === '') return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(n)
}

export const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(LOCALE).format(n)
}

export const formatDate = (date, opts = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(LOCALE, opts)
}

export const formatDateTime = (date) => {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(LOCALE, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const formatTimeAgo = (date) => {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.round(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.round(diffHrs / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`
  const diffYears = Math.round(diffMonths / 12)
  return `${diffYears}y ago`
}

export { LOCALE, CURRENCY }
