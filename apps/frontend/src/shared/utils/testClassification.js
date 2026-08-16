/**
 * Shared test classification utilities — single source of truth for
 * determining test type (live, quiz, upcoming, expired) and extracting
 * date fields. All pages must import from here instead of re-implementing
 * the logic inline (was causing 5+ different isLive definitions).
 *
 * Canonical field priority: camelCase first, then snake_case, then aliases.
 */

// ── Type checks ──────────────────────────────────────────────────────────

/**
 * Is this a live test?
 * Matches: isLive, type='live'/'live-tests', test_category_id=20, tags containing 'live'
 */
export const checkIsLive = (test) => {
  if (!test) return false
  return (
    test.isLive === true ||
    test.is_live === true ||
    test.type === 'live' ||
    test.type === 'live-tests' ||
    test.test_type === 'live' ||
    test.test_type === 'live-tests' ||
    test.testType === 'live' ||
    test.testType === 'live-tests' ||
    test.testCategoryId === 20 ||
    test.test_category_id === 20 ||
    String(test.test_category_id) === '20' ||
    String(test.testCategoryId) === '20' ||
    test.category === 'live-tests' ||
    String(test.subCategory || test.sub_category || '').toLowerCase().includes('live') ||
    (Array.isArray(test.tags) && test.tags.some(t =>
      String(t).toLowerCase() === 'live' ||
      String(t).toLowerCase() === 'live-tests'
    ))
  )
}

/**
 * Is this a quiz?
 * Matches: type='quiz', tags containing 'quiz', category/subCategory containing 'quiz'
 */
export const checkIsQuiz = (test) => {
  if (!test) return false
  if (test.itemType === 'quiz' || test.item_type === 'quiz') return true
  if (test.isQuiz === true || test.is_quiz === true) return true
  const type = (test.type || test.test_type || test.testType || '').toLowerCase()
  const category = (test.category || '').toLowerCase()
  const subCategory = (test.subCategory || test.sub_category || '').toLowerCase()
  const tags = Array.isArray(test.tags) ? test.tags.map(t => String(t).toLowerCase()) : []

  return (
    type === 'quiz' ||
    type === 'quizzes' ||
    type === 'live-quiz' ||
    type === 'live-quizzes' ||
    category === 'quiz' ||
    category === 'quizzes' ||
    category.includes('quiz') ||
    subCategory === 'quiz' ||
    subCategory === 'quizzes' ||
    subCategory.includes('quiz') ||
    tags.includes('quiz') ||
    tags.includes('quizzes') ||
    tags.includes('live-quiz') ||
    tags.includes('live-quizzes') ||
    tags.includes('daily-quiz') ||
    tags.includes('speed-quiz')
  )
}

/**
 * Is this a permanent test? (Part of permanent test series inventory)
 * Excludes transient Live Tests and Live Quizzes.
 */
export const checkIsPermanentTest = (test) => {
  if (!test) return false
  if (checkIsLive(test)) return false
  if (checkIsQuiz(test)) return false
  const type = (test.type || test.test_type || test.testType || '').toLowerCase()
  if (type === 'live-tests' || type === 'live' || type === 'quiz' || type === 'live-quiz' || type === 'live-quizzes') return false
  const cat = (test.category || '').toLowerCase()
  if (cat === 'live-tests' || cat === 'live' || cat === 'quiz') return false
  if (test.testCategoryId === 20 || test.test_category_id === 20 || String(test.test_category_id) === '20' || String(test.testCategoryId) === '20') return false
  return true
}

/**
 * Is this test upcoming (scheduled but not yet started)?
 */
export const checkIsUpcoming = (test) => {
  if (!test) return false
  const dateVal = getTestStartDate(test)
  if (!dateVal) return false
  const d = new Date(dateVal)
  return !isNaN(d.getTime()) && d > new Date()
}

/**
 * Is this live test or quiz expired (ended)?
 */
export const checkIsLiveExpired = (test) => {
  if (!test) return false
  if (test.status === 'expired') return true
  const endDate = getTestEndDate(test)
  if (!endDate) return false
  const d = new Date(endDate)
  return !isNaN(d.getTime()) && d < new Date()
}

/**
 * 7-Day post-live availability constants and helpers
 */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Get the effective end date timestamp of a live test
 */
export const getEffectiveTestEndDate = (test) => {
  const endDate = getTestEndDate(test)
  if (endDate) {
    const d = new Date(endDate)
    if (!isNaN(d.getTime())) return d
  }
  const startDate = getTestStartDate(test)
  if (startDate) {
    const s = new Date(startDate)
    if (!isNaN(s.getTime())) {
      const durationMins = Number(test.duration || test.durationMinutes || test.duration_minutes || 60)
      return new Date(s.getTime() + durationMins * 60000)
    }
  }
  return null
}

/**
 * Check if a live test is in its 7-day Post-Live / Solution Window.
 * (Contest has ended, but 7 days have not yet elapsed since end_time)
 */
export const checkIsPostLiveWindow = (test) => {
  if (!test) return false
  const isLiveItem = checkIsLive(test) || checkIsQuiz(test) || test.type === 'live-tests' || test.test_category_id === 20 || test.testCategoryId === 20
  if (!isLiveItem) return false
  
  const end = getEffectiveTestEndDate(test)
  if (!end) return false
  
  const now = new Date()
  if (now <= end) return false // Still live or upcoming
  
  const postLiveUntil = new Date(end.getTime() + SEVEN_DAYS_MS)
  return now <= postLiveUntil
}

/**
 * Check if a live test is fully archived (more than 7 days have passed since end_time).
 * When true, the test is hidden from Test Series / Live Test / Search discovery,
 * and if viewed in user's Attempted Tests, solutions are marked as expired.
 */
export const checkIsArchivedLive = (test) => {
  if (!test) return false
  const isLiveItem = checkIsLive(test) || checkIsQuiz(test) || test.type === 'live-tests' || test.test_category_id === 20 || test.testCategoryId === 20
  if (!isLiveItem) return false
  
  const end = getEffectiveTestEndDate(test)
  if (!end) return false
  
  const now = new Date()
  const postLiveUntil = new Date(end.getTime() + SEVEN_DAYS_MS)
  return now > postLiveUntil
}

/**
 * Check if the solution for a test has expired (live tests past their 7-day window).
 */
export const checkIsSolutionExpired = (test) => {
  return checkIsArchivedLive(test)
}

/**
 * Helper to determine if a live test should be visible in general listings (LiveTests, TestSeries).
 * Returns true if the test is upcoming, live, or within the 7-day post-live window.
 * Returns false if it is a live test that has exceeded 7 days past expiry.
 */
export const checkShouldShowInLiveOrSeriesListing = (test) => {
  if (!test) return true
  const isLiveItem = checkIsLive(test) || checkIsQuiz(test) || test.type === 'live-tests' || test.test_category_id === 20 || test.testCategoryId === 20
  if (!isLiveItem) return true
  
  // If it's a live item, check if it has passed the 7-day archive cutoff
  return !checkIsArchivedLive(test)
}

/**
 * Is this live test currently ongoing (started AND not expired)?
 */
export const checkIsLiveOngoing = (test) => {
  if (!test || !checkIsLive(test)) return false
  if (checkIsLiveExpired(test)) return false
  if (checkIsUpcoming(test)) return false
  return true
}

/**
 * Is this test "Coming Soon" (auto-release date hasn't passed)?
 */
export const checkIsComingSoon = (test) => {
  if (!test) return false
  if (checkIsLive(test) || checkIsUpcoming(test)) return false
  const isComingSoon = test.isComingSoon || test.is_coming_soon
  if (!isComingSoon) return false
  const releaseDate = test.comingSoonDate || test.coming_soon_date
  if (!releaseDate) return true
  return new Date(releaseDate) > new Date()
}

// ── Date extraction ──────────────────────────────────────────────────────

/**
 * Get the start date of a test (when it goes live / becomes available).
 * Priority: scheduledAt > liveSchedule > startTime > publishedAt > createdAt
 */
export const getTestStartDate = (test) => {
  if (!test) return null
  return (
    test.scheduledAt ||
    test.scheduled_at ||
    test.liveSchedule ||
    test.live_schedule ||
    test.startTime ||
    test.start_time ||
    test.dateStart ||
    test.date_start ||
    test.publishedAt ||
    test.published_at ||
    test.createdAt ||
    test.created_at ||
    null
  )
}

/**
 * Get the end date of a test (when it expires / becomes unavailable).
 * Priority: endTime > scheduledEnd > dateEnd > expiredAt > availability.scheduledEnd
 */
export const getTestEndDate = (test) => {
  if (!test) return null
  return (
    test.endTime ||
    test.end_time ||
    test.scheduledEnd ||
    test.scheduled_end ||
    test.dateEnd ||
    test.date_end ||
    test.expiredAt ||
    test.expired_at ||
    test.availability?.scheduledEnd ||
    test.availability?.availableTill ||
    null
  )
}

// ── Formatting ───────────────────────────────────────────────────────────

/**
 * Format a date range for display on live test cards.
 * - Not started: "From: DD/MM/YYYY, HH:MM To: DD/MM/YYYY, HH:MM"
 * - Started: "Till: DD/MM/YYYY, HH:MM"
 */
export const formatDateRange = (startDate, endDate, durationMins = 60) => {
  if (!startDate) return null
  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  let end = endDate ? new Date(endDate) : null
  if (!end || isNaN(end.getTime())) {
    end = new Date(start.getTime() + Number(durationMins || 60) * 60000)
  }

  const fmt = (d) => {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year}, ${hours}:${mins}`
  }

  const now = new Date()
  if (now >= start) return `Till: ${fmt(end)}`
  return `From: ${fmt(start)} To: ${fmt(end)}`
}

/**
 * Get a human-readable countdown string for an upcoming test.
 */
export const getTimeUntil = (dateStr) => {
  if (!dateStr) return ''
  const diff = new Date(dateStr) - new Date()
  if (diff <= 0) return 'Live Now!'
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/**
 * Get the test ID from a test object (handles multiple ID formats).
 */
export const getTestId = (test) =>
  String(test?.public_id_uuid || test?.public_id || test?.uuid || test?.id || test?._id || test?.slug || '')
