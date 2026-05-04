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

  return parsed
    .map(normalizeEnrollmentEntry)
    .filter((entry) => entry !== null && entry !== undefined && String(entry).trim() !== '')
}

export const hasLegacyEnrolledSeriesIds = (enrolledSeries) => {
  return getNormalizedEnrolledSeries(enrolledSeries).some((entry) => /^\d+$/.test(String(entry)))
}

export const isSeriesEnrolled = (userOrEnrolledSeries, series, extraIdentifiers = []) => {
  const enrolledSeries = Array.isArray(userOrEnrolledSeries)
    ? userOrEnrolledSeries
    : userOrEnrolledSeries?.enrolledSeries

  const enrolledIds = new Set(
    getNormalizedEnrolledSeries(enrolledSeries).map((entry) => String(entry))
  )

  return [series?._id, series?.id, series?.slug, ...extraIdentifiers]
    .filter((entry) => entry !== null && entry !== undefined && String(entry).trim() !== '')
    .some((entry) => enrolledIds.has(String(entry)))
}
