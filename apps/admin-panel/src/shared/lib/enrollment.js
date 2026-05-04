const normalizeEnrollmentEntry = (entry) => {
  if (entry === null || entry === undefined) {
    return null
  }

  if (typeof entry === 'object') {
    return entry.id || entry._id || entry.slug || null
  }

  return entry
}

export const getNormalizedEnrolledSeries = (enrolledSeries) => {
  if (!Array.isArray(enrolledSeries)) {
    return []
  }

  return enrolledSeries
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
