import { Router } from 'express'
import crypto from 'crypto'
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

function fisherYatesShuffle(arr) {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const router = Router()

// @route   GET /api/search
router.get('/search', async (req, res) => {
  try {
    const { q, type, limit = 20, page = 1 } = req.query

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      })
    }

    const searchTerm = q.toLowerCase().trim()
    const parsedLimit = parseInt(limit, 10) || 20
    const offset = (parseInt(page, 10) - 1 || 0) * parsedLimit
    const searchPattern = `%${searchTerm}%`

    const results = {
      tests: [],
      series: [],
      exams: [],
      studyMaterials: [],
      total: 0,
    }

    // Search tests
    if (!type || type === 'tests' || type === 'all') {
      const testsRes = await pool.query(`
        SELECT id, series_id, slug, title, category, sub_category, type, total_questions, total_marks, duration, passing_marks, negative_marking, tags, is_live, live_schedule, scheduled_at, difficulty, is_active, created_at, updated_at, subject_id, is_pro, stage_id, banner_asset_id, promotion_banner_asset_id, is_coming_soon, public_id_uuid, public_id, category_path_ids, category_path_names, languages, coming_soon_date, test_category_id, stage_ids, section_id, status, year, is_deleted, deleted_by, deleted_at, _orphaned, _deleted_series_id, orphaned_at, cutoff_marks, published_at, live_at, expired_at, archived_at, state_updated_by, moderation_status, reviewed_by, reviewed_at, review_notes, instructions, test_type, start_time, end_time, shuffle_questions, shuffle_options, allow_review, max_attempts, version, attempt_count, imported_from, source_test_id, ai_explanation_enabled, _deleted_test_id, short_title, question_language_mode, is_pyq, pyq_year, show_config, timing_config, optional_section_config, attempt_rules, analysis_config, access_config, availability, is_featured, seo, exam_category_id, proctoring, adaptive, features, shift, pdf_asset_id, content_source, content_path, exam_id FROM tests 
        WHERE is_active = true 
        AND (title ILIKE $1 OR description ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset])
      results.tests = testsRes.rows.map(row => dbHelpers.toCamel(row))
    }

    // Search test series
    if (!type || type === 'series' || type === 'all') {
      const seriesRes = await pool.query(`
        SELECT id, slug, title, category, subcategory, description, image, thumbnail, icon, total_tests, free_tests, active_users, users_count, rating, tags, test_types, is_pro, price, difficulty, is_active, created_at, updated_at, is_pinned, sections, languages, colour_hex, total_attempts, stages, public_id_uuid, public_id, is_coming_soon, "order", season_id, is_deleted, deleted_by, deleted_at, _orphaned_exam_category_id, _orphaned_at, orphaned_at, exam_id, stage_id, _orphaned, _deleted_test_id, exam_category_id, exam_id_fk FROM test_series 
        WHERE is_active = true 
        AND (name ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset])
      results.series = seriesRes.rows.map(row => dbHelpers.toCamel(row))
    }

    // Search exams
    if (!type || type === 'exams' || type === 'all') {
      const examsRes = await pool.query(`
        SELECT id, category_id, exam_id, year, title, full_name, description, notification, series_id, eligibility, age_limit, syllabus, is_active, created_at, updated_at, is_deleted, deleted_at, deleted_by, series_id_int FROM exam_info 
        WHERE is_active = true 
        AND (title ILIKE $1 OR full_name ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset])
      results.exams = examsRes.rows.map(row => dbHelpers.toCamel(row))
    }

    // Search study materials
    if (!type || type === 'study' || type === 'all') {
      const materialsRes = await pool.query(`
        SELECT id, slug, title, icon, description, topics, videos, pdf, tests, color, bg, is_active, created_at, updated_at, "order", public_id_uuid, public_id, is_deleted, deleted_at, deleted_by, type, url, file_path, file_size, mime_type, thumbnail_url, duration, subject_id, chapter_id, topic_id, is_pro, display_order, metadata, _orphaned FROM study_materials 
        WHERE is_active = true 
        AND (title ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset])
      results.studyMaterials = materialsRes.rows.map(row => dbHelpers.toCamel(row))
    }

    results.total =
      results.tests.length +
      results.series.length +
      results.exams.length +
      results.studyMaterials.length

    res.json({
      success: true,
      data: results,
      query: q,
      total: results.total,
    })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({
      success: false,
      message: 'Search failed',
    })
  }
})

// @route   GET /api/exams/:examId/year/:year
router.get('/exams/:examId/year/:year', async (req, res) => {
  try {
    const { examId, year } = req.params

    const yearlyData = await dbHelpers.findOne('examYearlyData', {
      examId: parseInt(examId),
      year: parseInt(year),
      isActive: true,
    })

    if (!yearlyData) {
      return res.status(404).json({
        success: false,
        message: 'Yearly data not found for this exam and year',
      })
    }

    res.json({
      success: true,
      data: yearlyData,
    })
  } catch (error) {
    console.error('Get yearly data error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/exams/:examId/years
router.get('/exams/:examId/years', async (req, res) => {
  try {
    const { examId } = req.params

    const yearlyData = await dbHelpers.find('examYearlyData', {
      examId: parseInt(examId),
      isActive: true,
    })

    const years = yearlyData.map((data) => data.year).sort((a, b) => b - a)

    res.json({
      success: true,
      data: years,
      count: years.length,
    })
  } catch (error) {
    console.error('Get years error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/exams/:examId/updates
router.get('/exams/:examId/updates', async (req, res) => {
  try {
    const { examId } = req.params
    const { limit = 10, page = 1, type } = req.query

    const query = {
      examId: parseInt(examId),
      isActive: true,
    }

    if (type) {
      query.updateType = type
    }

    const updates = await dbHelpers.find('examUpdates', query)

    // Sort by date (newest first) and paginate
    const sortedUpdates = updates
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice((page - 1) * limit, page * limit)

    res.json({
      success: true,
      data: sortedUpdates,
      count: sortedUpdates.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: updates.length,
      },
    })
  } catch (error) {
    console.error('Get updates error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/exams/:examId/compare
router.get('/exams/:examId/compare', async (req, res) => {
  try {
    const { examId } = req.params
    const { years } = req.query

    const yearArray = years ? years.split(',').map(Number) : []

    const comparisonData = await dbHelpers.find('examYearlyData', {
      examId: parseInt(examId),
      year: { $in: yearArray },
      isActive: true,
    })

    // Format for comparison table
    const formatted = comparisonData
      .sort((a, b) => b.year - a.year)
      .map((data) => ({
        year: data.year,
        vacancies: data.vacancies,
        notificationDate: data.notificationDate,
        applicationStart: data.applicationStart,
        examDateStart: data.examDateStart,
        resultDate: data.resultDate,
      }))

    res.json({
      success: true,
      data: formatted,
    })
  } catch (error) {
    console.error('Get comparison error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/videos
router.get('/videos', async (req, res) => {
  try {
    let videos = await dbHelpers.find('videos', { isActive: true })
    if (!videos || videos.length === 0) {
      videos = await dbHelpers.find('studyMaterials', {
        isActive: true,
        type: 'video',
      })
    }

    res.json({
      success: true,
      data: videos,
      count: videos.length,
    })
  } catch (error) {
    console.error('Get videos error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/videos/:id
router.get('/videos/:id', async (req, res) => {
  try {
    const { id } = req.params
    let video = await dbHelpers.findById('videos', id)
    if (!video) {
      video = await dbHelpers.findById('studyMaterials', id)
    }

    const isVideoType =
      video?.type === 'video' || video?.videoUrl || video?.url
    if (!video || !video.isActive || !isVideoType) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      })
    }

    res.json({
      success: true,
      data: video,
    })
  } catch (error) {
    console.error('Get video error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/subscription-plans
router.get('/subscription-plans', async (req, res) => {
  try {
    const plans = await dbHelpers.find('subscriptionPlans', { isActive: true })
    res.json({
      success: true,
      data: plans,
      count: plans.length,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/leaderboards
router.get('/leaderboards', async (req, res) => {
  try {
    const { testId, seriesId, examId, limit = 50 } = req.query
    const query = { isActive: true }

    if (testId) query.testId = testId
    if (seriesId) query.seriesId = seriesId
    if (examId) query.examId = examId

    const leaderboards = await dbHelpers.find('leaderboards', query)

    // If no leaderboards found, generate from results
    if (!leaderboards || leaderboards.length === 0) {
      const resultsQuery = { isCompleted: true }
      if (seriesId) resultsQuery.seriesId = seriesId
      if (testId) resultsQuery.testId = testId

      const results = await dbHelpers.find('results', resultsQuery)

      if (!results || results.length === 0) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          source: 'empty',
        })
      }

      // Sort by score (descending) and then by time taken (ascending for tie-breaking)
      const sortedResults = results
        .sort((a, b) => {
          const scoreA = parseFloat(a.score) || 0
          const scoreB = parseFloat(b.score) || 0
          if (scoreB !== scoreA) return scoreB - scoreA
          const timeA = parseFloat(a.timeTaken || a.timeSpent) || Infinity
          const timeB = parseFloat(b.timeTaken || b.timeSpent) || Infinity
          return timeA - timeB
        })
        .slice(0, limit)

      // SEC-08: Anonymize user data - use rank-based pseudonyms instead of real names
      const totalParticipants = results.length
      const rankings = await Promise.all(sortedResults.map(async (result, index) => {
        const participantsBelow = totalParticipants - (index + 1)
        const realPercentile =
          totalParticipants > 1
            ? ((participantsBelow / totalParticipants) * 100).toFixed(1)
            : '100.0'

        // Return only pseudonymous display name and rank, no PII
        let isProUser = false
        try {
          const user = await dbHelpers.findById('users', result.userId)
          isProUser = user?.isProUser || user?.isPro || false
        } catch (e) {
          // User lookup failed, default to false
        }

        return {
          rank: index + 1,
          name: `Student #${index + 1}`,
          score: parseFloat(result.score || 0).toFixed(2),
          percentile: realPercentile,
          testsCompleted: result.testsCompleted || result.tests_completed || 1,
          accuracy: result.accuracy ?? 0,
          isPro: isProUser,
        }
      }))

      return res.json({
        success: true,
        data: rankings,
        count: rankings.length,
        totalParticipants,
        source: 'calculated',
      })
    }

    // SEC-08: Anonymize leaderboard rankings for public access
    const populatedLeaderboards = await Promise.all(
      leaderboards.map(async (lb) => {
        const rankings = lb.rankings || []
        const anonymizedRankings = rankings
          .sort((a, b) => a.rank - b.rank)
          .slice(0, limit)
          .map((r) => ({
            rank: r.rank,
            name: r.name ? `Student #${r.rank}` : `Student #${r.rank}`,
            score: r.score,
            percentile: r.percentile,
            testsCompleted: r.testsCompleted,
            accuracy: r.accuracy,
            isPro: r.isPro,
          }))

        return {
          ...lb,
          rankings: anonymizedRankings,
        }
      }),
    )

    res.json({
      success: true,
      data: populatedLeaderboards,
      count: populatedLeaderboards.length,
    })
  } catch (error) {
    console.error('Get leaderboards error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
})

// @route   GET /api/leaderboards/:id
router.get('/leaderboards/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 50 } = req.query

    const leaderboard = await dbHelpers.findById('leaderboards', id)

    if (!leaderboard || !leaderboard.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard not found',
      })
    }

    // Paginate rankings
    const rankings = leaderboard.rankings || []
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + parseInt(limit)
    const paginatedRankings = rankings
      .sort((a, b) => a.rank - b.rank)
      .slice(startIndex, endIndex)

    res.json({
      success: true,
      data: {
        ...leaderboard,
        rankings: paginatedRankings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: rankings.length,
          totalPages: Math.ceil(rankings.length / limit),
        },
      },
    })
  } catch (error) {
    console.error('Get leaderboard error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/test-series
router.get('/test-series', async (req, res) => {
  try {
    const series = await dbHelpers.find('testSeries', { isPro: false })

    res.json({
      success: true,
      data: series,
      count: series.length,
    })
  } catch (error) {
    console.error('Get test series error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/live-tests
router.get('/live-tests', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query

    // Get tests tagged as live tests
    const allTests = await dbHelpers.find('tests', { isActive: true })
    const liveTests = allTests.filter(
      (test) => test.isLive === true || test.tags?.includes('live-tests'),
    )

    // Sort by date (newest first)
    liveTests.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    )

    // Paginate
    const startIndex = (page - 1) * limit
    const paginatedTests = liveTests.slice(
      startIndex,
      startIndex + parseInt(limit),
    )

    res.json({
      success: true,
      data: paginatedTests,
      count: paginatedTests.length,
      total: liveTests.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: liveTests.length,
        totalPages: Math.ceil(liveTests.length / limit),
      },
    })
  } catch (error) {
    console.error('Get live tests error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/current-affairs
router.get('/current-affairs', async (req, res) => {
  try {
    const { date, month, year, limit = 20, page = 1, category } = req.query

    // Get study materials tagged as current-affairs
    const query = { isActive: true }
    if (category) query.category = category

    const allMaterials = await dbHelpers.find('studyMaterials', query)
    let articles = allMaterials.filter(
      (m) =>
        m.tags?.includes('current-affairs') || m.type === 'current-affairs',
    )

    // Filter by date if provided
    if (date) {
      const targetDate = new Date(date).toDateString()
      articles = articles.filter(
        (a) => new Date(a.date || a.createdAt).toDateString() === targetDate,
      )
    }

    // Filter by month/year if provided
    if (month && year) {
      articles = articles.filter((a) => {
        const aDate = new Date(a.date || a.createdAt)
        return (
          aDate.getMonth() + 1 === parseInt(month) &&
          aDate.getFullYear() === parseInt(year)
        )
      })
    }

    // Sort by date (newest first)
    articles.sort(
      (a, b) =>
        new Date(b.date || b.createdAt || 0) -
        new Date(a.date || a.createdAt || 0),
    )

    // Paginate
    const startIndex = (page - 1) * limit
    const paginatedArticles = articles.slice(
      startIndex,
      startIndex + parseInt(limit),
    )

    res.json({
      success: true,
      data: paginatedArticles,
      count: paginatedArticles.length,
      total: articles.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: articles.length,
        totalPages: Math.ceil(articles.length / limit),
      },
    })
  } catch (error) {
    console.error('Get current affairs error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/previous-year-papers
router.get('/previous-year-papers', async (req, res) => {
  try {
    const { exam, year, limit = 20, page = 1 } = req.query

    // Get tests tagged as PYPs
    let allTests = await dbHelpers.find('tests', { isActive: true })
    let pypTests = allTests.filter(
      (test) =>
        test.tags?.includes('pyp') ||
        test.tags?.includes('previous-year') ||
        test.category === 'PYPs' ||
        test.type === 'Previous Year Papers',
    )

    // Filter by exam category if provided
    if (exam) {
      pypTests = pypTests.filter(
        (t) =>
          t.examType?.toLowerCase() === exam.toLowerCase() ||
          t.examCategory?.toLowerCase() === exam.toLowerCase(),
      )
    }

    // Filter by year if provided
    if (year) {
      pypTests = pypTests.filter((t) => t.year === parseInt(year))
    }

    // Sort by year (newest first)
    pypTests.sort((a, b) => (b.year || 0) - (a.year || 0))

    // Paginate
    const startIndex = (page - 1) * limit
    const paginatedPapers = pypTests.slice(
      startIndex,
      startIndex + parseInt(limit),
    )

    // Extract unique years for filter
    const availableYears = [
      ...new Set(
        allTests
          .filter(
            (t) =>
              t.tags?.includes('pyp') ||
              t.tags?.includes('previous-year') ||
              t.category === 'PYPs',
          )
          .map((t) => t.year)
          .filter(Boolean),
      ),
    ].sort((a, b) => b - a)

    res.json({
      success: true,
      data: paginatedPapers,
      count: paginatedPapers.length,
      total: pypTests.length,
      availableYears,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: pypTests.length,
        totalPages: Math.ceil(pypTests.length / limit),
      },
    })
  } catch (error) {
    console.error('Get previous year papers error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/public-stats
router.get('/public-stats', async (req, res) => {
  try {
    const userCount = await dbHelpers.count('users')
    const testSeriesCount = await dbHelpers.count('testSeries')
    const testCount = await dbHelpers.count('tests')
    const questionCount = await dbHelpers.count('questions')
    const examCatCount = await dbHelpers.count('examCategories')

    // Get real total attempts from test_series
    const attemptRes = await pool.query(
      'SELECT SUM(total_attempts) as count FROM test_series',
    )
    const totalAttempts = parseInt(attemptRes.rows[0].count) || 0

    // Calculate real stats (no hardcoded minimums)
    const activeLearners = userCount + totalAttempts
    const successStories = Math.floor(activeLearners / 50)

    // Import validation utility
    const { validateStats } =
      await import('../../shared/utils/stats-validation.js')

    // Validate stats before returning
    const validatedStats = validateStats({
      users: userCount,
      testSeries: testSeriesCount,
      tests: testCount,
      questions: questionCount,
      examCategories: examCatCount,
      activeLearners: activeLearners || 0,
      mockTests: testCount || 0,
      practiceQuestions: questionCount || 0,
      successStories: successStories || 0,
      examsCovered: examCatCount || 0,
      satisfaction: null,
    })

    res.json({
      success: true,
      data: {
        ...validatedStats,
        // Keep original counts for admin use
        users: userCount,
        testSeries: testSeriesCount,
        tests: testCount,
        questions: questionCount,
        examCategories: examCatCount,
      },
    })
  } catch (error) {
    console.error('Get public stats error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

// @route   GET /api/testimonials
router.get('/testimonials', async (req, res) => {
  try {
    const testimonials = await dbHelpers.find('testimonials', {
      isActive: true,
    })

    res.json({
      success: true,
      data: testimonials || [],
    })
  } catch (error) {
    // Return empty array if table doesn't exist yet
    res.json({
      success: true,
      data: [],
      message: 'Testimonials feature coming soon',
    })
  }
})

// @route   GET /api/practice-questions
router.get('/practice-questions', async (req, res) => {
  try {
    const { category, subject, topic, limit = 50, page = 1 } = req.query

    // Get questions tagged for practice
    let allQuestions = await dbHelpers.find('questions', { isActive: true })
    let practiceQuestions = allQuestions.filter(
      (q) =>
        q.tags?.includes('practice') ||
        q.isPractice === true ||
        q.category === 'Practice',
    )

    // Filter by category if provided
    if (category) {
      practiceQuestions = practiceQuestions.filter(
        (q) => q.category?.toLowerCase() === category.toLowerCase(),
      )
    }

    // Filter by subject if provided
    if (subject) {
      practiceQuestions = practiceQuestions.filter(
        (q) => q.subject?.toLowerCase() === subject.toLowerCase(),
      )
    }

    // Filter by topic if provided
    if (topic) {
      practiceQuestions = practiceQuestions.filter(
        (q) => q.topic?.toLowerCase() === topic.toLowerCase(),
      )
    }

    // Sort randomly for practice variety
    practiceQuestions = fisherYatesShuffle(practiceQuestions)

    // Paginate
    const startIndex = (page - 1) * limit
    const paginatedQuestions = practiceQuestions.slice(
      startIndex,
      startIndex + parseInt(limit),
    )

    // Remove all answer-key aliases for practice mode
    const sanitizedQuestions = paginatedQuestions.map((q) => {
      const {
        correctAnswer,
        correct_option,
        correctOption,
        correct,
        answer,
        isCorrect,
        is_correct,
        explanation,
        ...safeQuestion
      } = q

      return safeQuestion
    })

    res.json({
      success: true,
      data: sanitizedQuestions,
      count: sanitizedQuestions.length,
      total: practiceQuestions.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: practiceQuestions.length,
        totalPages: Math.ceil(practiceQuestions.length / limit),
      },
    })
  } catch (error) {
    console.error('Get practice questions error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

export default router
