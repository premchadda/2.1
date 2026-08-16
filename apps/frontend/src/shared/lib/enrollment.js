import { clearDashboardCache } from './dashboardCache.js'

export const invalidateDashboardCache = () => {
  clearDashboardCache()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('trstprep:data-invalidated'))
  }
}

const normalizeEnrollmentEntry = (entry) => {
  if (entry === null || entry === undefined) {
    return null
  }

  if (typeof entry === 'object') {
    return entry.id || entry._id || entry.slug || null
  }

  return entry
}

/**
 * Parse enrolledSeries from various formats:
 * - JavaScript array: [1, 2, 3]
 * - PostgreSQL array string: "{1,2,3}"
 * - JSON array string: "[1,2,3]"
 * - Comma-separated string: "1,2,3"
 */
const parseEnrolledSeriesRaw = (enrolledSeries) => {
  if (enrolledSeries === null || enrolledSeries === undefined) {
    return []
  }

  if (Array.isArray(enrolledSeries)) {
    return enrolledSeries
  }

  if (typeof enrolledSeries === 'string') {
    const trimmed = enrolledSeries.trim()
    if (!trimmed) return []

    // PostgreSQL array format: "{1,2,3}"
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1)
      if (!inner.trim()) return []
      return inner.split(',').map((s) => s.trim()).filter(Boolean)
    }

    // JSON array format: "[1,2,3]"
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }

    // Comma-separated format: "1,2,3"
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
    }

    // Single value: "1"
    return [trimmed]
  }

  // Single number
  return [enrolledSeries]
}

export const getNormalizedEnrolledSeries = (enrolledSeries) => {
  const parsed = Array.isArray(enrolledSeries)
    ? enrolledSeries
    : parseEnrolledSeriesRaw(enrolledSeries)

  if (!Array.isArray(parsed)) {
    return []
  }

  const result = []
  for (const entry of parsed) {
    if (entry === null || entry === undefined) continue
    if (typeof entry === 'object') {
      const keys = [
        entry.id,
        entry._id,
        entry.dbId,
        entry.public_id,
        entry.publicId,
        entry.slug,
        entry.series_id,
        entry.seriesId,
      ].filter((k) => k !== null && k !== undefined && String(k).trim() !== '')
      keys.forEach((k) => result.push(String(k).trim()))
    } else {
      const s = String(entry).trim()
      if (s) result.push(s)
    }
  }
  return result
}

export const hasLegacyEnrolledSeriesIds = (enrolledSeries) => {
  return getNormalizedEnrolledSeries(enrolledSeries).some((entry) => /^\d+$/.test(String(entry)))
}

export const isSeriesEnrolled = (userOrEnrolledSeries, series, extraIdentifiers = []) => {
  if (!series) return false

  const rawEnrolled = Array.isArray(userOrEnrolledSeries)
    ? userOrEnrolledSeries
    : (
        userOrEnrolledSeries?.enrolledSeries ??
        userOrEnrolledSeries?.enrolled_series ??
        userOrEnrolledSeries?.enrolled ??
        userOrEnrolledSeries?.series ??
        []
      )

  const enrolledIds = new Set(
    getNormalizedEnrolledSeries(rawEnrolled).map((entry) => String(entry).trim())
  )

  if (enrolledIds.size === 0) return false

  const candidateIds = [
    series._id,
    series.id,
    series.dbId,
    series.public_id,
    series.publicId,
    series.slug,
    series.series_id,
    series.seriesId,
    ...extraIdentifiers,
  ]

  return candidateIds
    .filter((entry) => entry !== null && entry !== undefined && String(entry).trim() !== '')
    .some((entry) => enrolledIds.has(String(entry).trim()))
}
