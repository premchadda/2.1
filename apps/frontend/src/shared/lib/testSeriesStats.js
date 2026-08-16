const normalizeIdentity = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

const uniqueValues = (values) => (
  Array.from(new Set(values.map(normalizeIdentity).filter(Boolean)))
)

export const getSeriesIdentityKeys = (series = {}) => uniqueValues([
  series.dbId,
  series._id,
  series.id,
  series.slug,
  series.public_id,
  series.publicId
])

export const getTestSeriesIdentityKeys = (test = {}) => uniqueValues([
  test.seriesId,
  test.testSeriesId,
  test.series_id,
  test.test_series_id
])

export const testBelongsToSeries = (test = {}, series = {}) => {
  const seriesKeys = new Set(getSeriesIdentityKeys(series))
  return getTestSeriesIdentityKeys(test).some((key) => seriesKeys.has(key))
}

const prettifyLabel = (value) => {
  if (Array.isArray(value)) {
    return prettifyLabel(value.filter(Boolean).at(-1))
  }

  const label = normalizeIdentity(value)
  if (!label) return ''

  return label
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const getTestCategoryLabel = (test = {}) => {
  const categoryPathNames = Array.isArray(test.categoryPathNames)
    ? test.categoryPathNames.filter(Boolean)
    : []

  return prettifyLabel(
    test.testCategoryName ||
    test.test_category_name ||
    test.categoryName ||
    test.category_name ||
    categoryPathNames.at(-1) ||
    test.subCategory ||
    test.subcategory ||
    test.sub_category ||
    test.category ||
    test.type ||
    'Tests'
  )
}

const isFreeTest = (test = {}) => (
  test.isPro === false ||
  test.is_pro === false ||
  String(test.type || '').toLowerCase() === 'free'
)

const toCountObject = (counts = {}) => {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return {}

  return Object.entries(counts).reduce((acc, [key, value]) => {
    const label = prettifyLabel(key)
    const count = Number(value) || 0
    if (label && count > 0) {
      acc[label] = count
    }
    return acc
  }, {})
}

export const getSeriesTestStats = (series = {}, tests = []) => {
  const activeSeriesTests = tests.filter((test) => (
    testBelongsToSeries(test, series) &&
    test.isActive !== false &&
    test.status !== 'archived'
  ))

  const testCounts = activeSeriesTests.reduce((counts, test) => {
    const label = getTestCategoryLabel(test)
    counts[label] = (counts[label] || 0) + 1
    return counts
  }, toCountObject(series.testCounts || series.test_counts))

  const configuredTypes = Array.isArray(series.testTypes || series.test_types)
    ? (series.testTypes || series.test_types).map(prettifyLabel).filter(Boolean)
    : []
  const countedTypes = Object.keys(testCounts)
  const testTypes = uniqueValues([
    ...configuredTypes.filter((type) => (testCounts[type] || 0) > 0),
    ...countedTypes
  ])

  return {
    ...series,
    totalTests: activeSeriesTests.length || Number(series.totalTests || series.total_tests || 0),
    freeTests: activeSeriesTests.length
      ? activeSeriesTests.filter(isFreeTest).length
      : Number(series.freeTests || series.free_tests || 0),
    testCounts,
    testTypes
  }
}
