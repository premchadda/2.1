const normalizeIdentity = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const uniqueValues = (values) =>
  Array.from(new Set(values.map(normalizeIdentity).filter(Boolean)));

export const getSeriesIdentityKeys = (series = {}) =>
  uniqueValues(
    [
      series.dbId,
      series._id,
      series.id,
      series.slug,
      series.public_id,
      series.publicId,
      series.seriesId,
      series.series_id,
      series.examId,
      series.exam_id,
    ].filter(Boolean),
  );

export const getTestSeriesIdentityKeys = (test = {}) =>
  uniqueValues(
    [
      test.seriesId,
      test.testSeriesId,
      test.series_id,
      test.test_series_id,
      test.seriesSlug,
      test.series_slug,
      test.series?.id,
      test.series?._id,
      test.series?.slug,
      test.series?.public_id,
      test.series?.publicId,
      test.examId,
      test.exam_id,
    ].filter(Boolean),
  );

export const testBelongsToSeries = (test = {}, series = {}) => {
  const seriesKeys = new Set(getSeriesIdentityKeys(series));
  return getTestSeriesIdentityKeys(test).some((key) => seriesKeys.has(key));
};

const prettifyLabel = (value) => {
  if (Array.isArray(value)) {
    return prettifyLabel(value.filter(Boolean).at(-1));
  }

  const label = normalizeIdentity(value);
  if (!label) return "";

  return label.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
};

export const categorizeTestsList = (tests = []) => {
  const pypYears = [];
  let pypCount = 0;
  let liveCount = 0;
  let fullMockCount = 0;
  let quizCount = 0;
  const otherCounts = {};

  tests.forEach((t) => {
    const cat = String(t.categoryName || t.category_name || t.category || "");
    const sub = String(
      t.testCategoryName ||
        t.test_category_name ||
        t.subCategory ||
        t.subcategory ||
        t.sub_category ||
        "",
    );
    const type = String(t.type || "");
    const isLive = Boolean(t.isLive || t.is_live);

    if (cat.toLowerCase() === "pyps" || /^\d{4}$/.test(sub.trim())) {
      pypCount++;
      const year = parseInt(sub.trim(), 10);
      if (year && !isNaN(year)) pypYears.push(year);
    } else if (
      type.toLowerCase() === "quiz" ||
      sub.toLowerCase().includes("quiz") ||
      cat.toLowerCase().includes("quiz")
    ) {
      quizCount++;
    } else if (isLive || sub.toLowerCase().includes("live")) {
      liveCount++;
    } else if (
      sub.toLowerCase().includes("full mock") ||
      type.toLowerCase().includes("mock")
    ) {
      fullMockCount++;
    } else {
      const label = prettifyLabel(sub || cat || type || "Mock Tests");
      if (label) otherCounts[label] = (otherCounts[label] || 0) + 1;
    }
  });

  const testTypesMap = {};
  if (pypCount > 0) {
    if (pypYears.length > 0) {
      const minYear = Math.min(...pypYears);
      const maxYear = Math.max(...pypYears);
      const label =
        minYear === maxYear
          ? `Previous Year Papers (${minYear})`
          : `Previous Year Papers (${minYear} - ${maxYear})`;
      testTypesMap[label] = pypCount;
    } else {
      testTypesMap["Previous Year Papers"] = pypCount;
    }
  }

  if (liveCount > 0) testTypesMap["Live Tests"] = liveCount;
  if (fullMockCount > 0) testTypesMap["Full Mock Tests"] = fullMockCount;
  if (quizCount > 0) testTypesMap["Speed & Topic Quizzes"] = quizCount;
  Object.entries(otherCounts).forEach(([k, v]) => {
    testTypesMap[k] = v;
  });

  return testTypesMap;
};

export const getTestCategoryLabel = (test = {}) => {
  const categoryPathNames = Array.isArray(test.categoryPathNames)
    ? test.categoryPathNames.filter(Boolean)
    : [];

  const sub = test.subCategory || test.subcategory || test.sub_category || "";
  const cat = test.categoryName || test.category_name || test.category || "";

  if (sub && /^\d{4}$/.test(String(sub).trim())) {
    return `Previous Year Papers (${String(sub).trim()})`;
  }

  return prettifyLabel(
    test.testCategoryName ||
      test.test_category_name ||
      categoryPathNames.at(-1) ||
      sub ||
      cat ||
      test.type ||
      "Tests",
  );
};

const isFreeTest = (test = {}) =>
  test.isPro === false ||
  test.is_pro === false ||
  String(test.type || "").toLowerCase() === "free";

const toCountObject = (counts = {}) => {
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) return {};

  return Object.entries(counts).reduce((acc, [key, value]) => {
    const label = key;
    const count = Number(value) || 0;
    if (label && count > 0) {
      acc[label] = count;
    }
    return acc;
  }, {});
};

export const getSeriesTestStats = (series = {}, tests = []) => {
  const activeSeriesTests = Array.isArray(tests)
    ? tests.filter(
        (test) =>
          testBelongsToSeries(test, series) &&
          test.isActive !== false &&
          test.status !== "archived",
      )
    : [];

  // 1. Base counts from backend API response (calculated from real DB active test rows)
  const baseTestCounts = toCountObject(
    series.testCounts || series.test_counts || {},
  );

  // 2. Counts from individual active loaded tests
  const loadedCounts =
    activeSeriesTests.length > 0 ? categorizeTestsList(activeSeriesTests) : {};

  const testCounts =
    activeSeriesTests.length > 0 ? loadedCounts : baseTestCounts;
  const countedTypes = Object.keys(testCounts);
  const configuredTypes = Array.isArray(series.testTypes || series.test_types)
    ? (series.testTypes || series.test_types).filter(Boolean)
    : [];
  const testTypes = countedTypes.length > 0 ? countedTypes : configuredTypes;

  const sumCategoryCounts = Object.values(testCounts).reduce(
    (sum, c) => sum + (Number(c) || 0),
    0,
  );
  const rawTotal = Number(series.totalTests ?? series.total_tests ?? 0);
  const totalTests =
    activeSeriesTests.length > 0
      ? activeSeriesTests.length
      : rawTotal > 0
        ? rawTotal
        : sumCategoryCounts;

  const rawFree = Number(series.freeTests ?? series.free_tests ?? 0);
  const loadedFree = activeSeriesTests.filter(isFreeTest).length;
  const freeTests = activeSeriesTests.length > 0 ? loadedFree : rawFree;

  return {
    ...series,
    totalTests,
    total_tests: totalTests,
    freeTests,
    free_tests: freeTests,
    testCounts,
    testTypes,
  };
};
